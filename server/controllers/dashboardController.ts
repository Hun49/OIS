import { Request, Response } from 'express';
import { db } from '../database/db.ts';

export function getStats(req: Request, res: Response) {
  try {
    const todayStr = new Date().toISOString().split('T')[0] + '%'; // match dates starting with YYYY-MM-DD

    // 1. Sales today
    const salesStmt = db.prepare("SELECT COUNT(*) as count, SUM(total_amount) as total_rev, SUM(total_profit) as total_prof FROM sales WHERE created_at LIKE ?");
    const salesToday = salesStmt.get(todayStr) as any;

    const returnsTodayStmt = db.prepare("SELECT COUNT(*) as count, SUM(refund_amount) as total_refund FROM return_requests WHERE status = 'approved' AND approved_at LIKE ?");
    const returnsToday = returnsTodayStmt.get(todayStr) as any;

    const netSalesCount = (salesToday?.count || 0);
    const netRevenueToday = (salesToday?.total_rev || 0) - (returnsToday?.total_refund || 0);
    const netProfitToday = (salesToday?.total_prof || 0) - (returnsToday?.total_refund || 0);

    // 2. Low stock alert counter
    // A product or variant is low stock if current inventory is <= threshold.
    // We sum up both products (without variants) and variant items that fall below threshold.
    const simpleLowStock = db.prepare(`
      SELECT COUNT(*) as count FROM products 
      WHERE has_variants = 0 AND is_active = 1 AND id IN (
        SELECT product_id FROM stock_batches
        GROUP BY product_id
        HAVING SUM(quantity_added) <= low_stock_threshold
      )
    `).get() as any;

    // For variants stock tracking, we query product_variants
    const variantLowStock = db.prepare(`
      SELECT COUNT(*) as count FROM product_variants 
      WHERE is_active = 1 AND stock_quantity <= low_stock_threshold
    `).get() as any;

    const totalLowStockCount = (simpleLowStock?.count || 0) + (variantLowStock?.count || 0);

    // 3. Top selling product today
    const topProdStmt = db.prepare(`
      SELECT 
        si.product_name, 
        (SUM(si.quantity) - IFNULL(ret.returned_qty, 0)) as net_qty
      FROM sale_items si
      INNER JOIN sales s ON si.sale_id = s.id
      LEFT JOIN (
        SELECT 
          si2.product_id, 
          si2.variant_id,
          SUM(si2.quantity) as returned_qty
        FROM return_requests rr
        INNER JOIN sale_items si2 ON (rr.sale_item_id IS NOT NULL AND rr.sale_item_id = si2.id) OR (rr.sale_item_id IS NULL AND rr.sale_id = si2.sale_id)
        WHERE rr.status = 'approved' AND rr.approved_at LIKE ?
        GROUP BY si2.product_id, si2.variant_id
      ) ret ON si.product_id = ret.product_id AND (si.variant_id = ret.variant_id OR (si.variant_id IS NULL AND ret.variant_id IS NULL))
      WHERE s.created_at LIKE ?
      GROUP BY si.product_id, si.variant_id
      ORDER BY net_qty DESC 
      LIMIT 1
    `);
    const topProduct = topProdStmt.get(todayStr, todayStr) as any;

    // 4. Employee count (if >= 2, show top seller employee)
    const empCountStmt = db.prepare("SELECT COUNT(*) as count FROM users WHERE role_type = 'employee' AND is_active = 1");
    const empCount = (empCountStmt.get() as any).count;

    let topEmployee: any = null;
    if (empCount >= 2) {
      // Find top performing employee today (subtracting returns processed by or associated with them)
      const topEmpStmt = db.prepare(`
        SELECT 
          u.full_name as name, 
          COUNT(s.id) as tx_count, 
          (SUM(s.total_amount) - IFNULL(ret.returned_amt, 0)) as revenue
        FROM sales s
        INNER JOIN users u ON s.sold_by_user_id = u.id
        LEFT JOIN (
          SELECT rr.requested_by_user_id, SUM(rr.refund_amount) as returned_amt
          FROM return_requests rr
          WHERE rr.status = 'approved' AND rr.approved_at LIKE ?
          GROUP BY rr.requested_by_user_id
        ) ret ON u.id = ret.requested_by_user_id
        WHERE s.created_at LIKE ? AND u.role_type = 'employee'
        GROUP BY s.sold_by_user_id
        ORDER BY revenue DESC
        LIMIT 1
      `);
      topEmployee = topEmpStmt.get(todayStr, todayStr) as any;
    }

    return res.json({
      total_sales_count: netSalesCount,
      total_revenue_today: netRevenueToday,
      total_profit_today: netProfitToday,
      low_stock_count: totalLowStockCount,
      top_selling_product: topProduct ? `${topProduct.product_name} (${topProduct.net_qty} units)` : 'No sales today',
      employee_count: empCount,
      top_employee: topEmployee
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export function getLowStockAlerts(req: Request, res: Response) {
  try {
    const user = db.prepare('SELECT role_type FROM users WHERE id = ?').get(req.session.userId) as any;
    if (user?.role_type !== 'owner') {
      const perms = db.prepare('SELECT * FROM user_permissions WHERE user_id = ?').get(req.session.userId) as any;
      const hasAny = perms && (
        perms.can_view_dashboard === 1 ||
        perms.can_manage_products === 1 ||
        perms.can_manage_stock === 1 ||
        perms.can_adjust_stock === 1 ||
        perms.can_sell === 1
      );
      if (!hasAny) {
        return res.status(403).json({ error: "Permission Denied: Access to low stock alerts restricted" });
      }
    }

    // Select all products without variants below threshold
    const productStocks = db.prepare(`
      SELECT p.id, p.product_id_display as display_id, p.name, p.low_stock_threshold, p.has_variants,
             IFNULL((SELECT SUM(stock_quantity) FROM product_variants WHERE product_id = p.id AND is_active=1), 0) as var_stock
      FROM products p
      WHERE p.is_active = 1
    `).all() as any[];

    const list: any[] = [];

    // Evaluate each
    productStocks.forEach(p => {
      if (p.has_variants === 1) {
        // Query low stock variants
        const vars = db.prepare(`
          SELECT id, variant_name, stock_quantity, low_stock_threshold, sku_variant
          FROM product_variants
          WHERE product_id = ? AND is_active = 1 AND stock_quantity <= low_stock_threshold
        `).all(p.id) as any[];

        vars.forEach(v => {
          list.push({
            type: 'variant',
            id: v.id,
            display_id: v.sku_variant,
            name: `${p.name} - ${v.variant_name}`,
            stock: v.stock_quantity,
            threshold: v.low_stock_threshold
          });
        });
      } else {
        // Simple products stock calculations: query total stock of this simple product.
        const addedSet = db.prepare('SELECT SUM(quantity_added) as qty FROM stock_batches WHERE product_id = ?').get(p.id) as any;
        const soldSet = db.prepare('SELECT SUM(quantity) as qty FROM sale_items WHERE product_id = ?').get(p.id) as any;
        const currentStock = (addedSet?.qty || 0) - (soldSet?.qty || 0);

        if (currentStock <= p.low_stock_threshold) {
          list.push({
            type: 'product',
            id: p.id,
            display_id: p.display_id,
            name: p.name,
            stock: currentStock,
            threshold: p.low_stock_threshold
          });
        }
      }
    });

    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
