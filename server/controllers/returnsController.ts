import { Request, Response } from 'express';
import { db, logAudit } from '../database/db.ts';

export function getReturns(req: Request, res: Response) {
  try {
    const user = db.prepare('SELECT role_type FROM users WHERE id = ?').get(req.session.userId) as any;
    if (user?.role_type !== 'owner') {
      const perms = db.prepare('SELECT * FROM user_permissions WHERE user_id = ?').get(req.session.userId) as any;
      const hasAny = perms && (
        perms.can_view_dashboard === 1 ||
        perms.can_create_returns === 1 ||
        perms.can_approve_returns === 1
      );
      if (!hasAny) {
        return res.status(403).json({ error: "Permission Denied: Access to return records restricted" });
      }
    }

    const returns = db.prepare(`
      SELECT return_requests.*, sales.sale_number, users.username as requester_name, approver.username as approver_name
      FROM return_requests
      INNER JOIN sales ON return_requests.sale_id = sales.id
      INNER JOIN users ON return_requests.requested_by_user_id = users.id
      LEFT JOIN users approver ON return_requests.approved_by_user_id = approver.id
      ORDER BY return_requests.created_at DESC
    `).all();
    return res.json(returns);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

const requestReturnTransaction = db.transaction((data: any) => {
  const { sale_id, sale_item_id, reason, refund_method, refund_amount, transaction_reference, filename, userId, timestamp } = data;

  const insert = db.prepare(`
    INSERT INTO return_requests (sale_id, sale_item_id, requested_by_user_id, reason, refund_method, refund_amount, transaction_reference, receipt_file_name, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `);
  const resId = insert.run(
    sale_id,
    sale_item_id ? parseInt(sale_item_id) : null,
    userId,
    reason,
    refund_method,
    parseFloat(refund_amount),
    transaction_reference || null,
    filename,
    timestamp
  );

  const retId = resId.lastInsertRowid as number;

  logAudit(
    userId,
    'return requested',
    'return_requests',
    retId,
    null,
    { refund_amount },
    `Created return request ID ${retId} for Sale ID ${sale_id}. Status: pending.`
  );

  return retId;
});

export function requestReturn(req: Request, res: Response) {
  const { sale_id, sale_item_id, reason, refund_method, refund_amount, transaction_reference } = req.body;
  if (!sale_id || !reason || !refund_amount) {
    return res.status(400).json({ error: 'Sale, reason, and refund amount are required.' });
  }

  try {
    const timestamp = new Date().toISOString();
    const filename = req.file ? req.file.filename : null;

    const returnId = requestReturnTransaction({
      sale_id,
      sale_item_id,
      reason,
      refund_method,
      refund_amount,
      transaction_reference,
      filename,
      userId: req.session.userId!,
      timestamp
    });

    return res.json({ success: true, returnId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

const approveReturnTransaction = db.transaction((data: any) => {
  const { retId, decision, userId, timestamp } = data;

  const ret = db.prepare('SELECT * FROM return_requests WHERE id = ?').get(retId) as any;
  if (!ret) throw new Error('Return request not found.');
  if (ret.status !== 'pending') throw new Error('This return is already processed.');

  if (decision === 'approved') {
    // 1. Set return as approved
    db.prepare('UPDATE return_requests SET status = "approved", approved_by_user_id = ?, approved_at = ? WHERE id = ?')
      .run(userId, timestamp, retId);

    // 2. Replenish stock quantities back into the database physical pools
    if (ret.sale_item_id) {
      const item = db.prepare('SELECT * FROM sale_items WHERE id = ?').get(ret.sale_item_id) as any;
      if (item) {
        if (item.variant_id) {
          db.prepare('UPDATE product_variants SET stock_quantity = stock_quantity + ?, updated_at = ? WHERE id = ?')
            .run(item.quantity, timestamp, item.variant_id);
        } else {
          db.prepare('INSERT INTO stock_batches (product_id, variant_id, quantity_added, buy_price, sell_price, reason, added_by_user_id, created_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)')
            .run(item.product_id, item.quantity, item.buy_price, item.sell_price, `Customer return approved (Request ID: ${retId})`, userId, timestamp);
        }
      }
    } else {
      // If entire sale was returned, fetch all sale items and replenish
      const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(ret.sale_id) as any[];
      items.forEach(itm => {
        if (itm.variant_id) {
          db.prepare('UPDATE product_variants SET stock_quantity = stock_quantity + ?, updated_at = ? WHERE id = ?')
            .run(itm.quantity, timestamp, itm.variant_id);
        } else {
          db.prepare('INSERT INTO stock_batches (product_id, variant_id, quantity_added, buy_price, sell_price, reason, added_by_user_id, created_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)')
            .run(itm.product_id, itm.quantity, itm.buy_price, itm.sell_price, `Customer return approved: whole purchase (Request ID: ${retId})`, userId, timestamp);
        }
      });
    }

    // Original Sale is preserved 100% untouched to adhere strictly to the IMSO immutable sales policy.
    // Returns are tracked entirely via return_requests and dynamically reflected in reports and dashboards.

  } else {
    // Set return as rejected
    db.prepare('UPDATE return_requests SET status = "rejected", approved_by_user_id = ?, approved_at = ? WHERE id = ?')
      .run(userId, timestamp, retId);
  }

  logAudit(
    userId,
    `return ${decision}`,
    'return_requests',
    retId,
    { status: 'pending' },
    { status: decision },
    `Return request ID ${retId} was ${decision} by owner.`
  );
});

export function approveReturn(req: Request, res: Response) {
  const retId = parseInt(req.params.id);
  const { decision } = req.body; // 'approved' or 'rejected'

  if (decision !== 'approved' && decision !== 'rejected') {
    return res.status(400).json({ error: 'Decision must be approved or rejected.' });
  }

  try {
    const timestamp = new Date().toISOString();

    approveReturnTransaction({
      retId,
      decision,
      userId: req.session.userId!,
      timestamp
    });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
