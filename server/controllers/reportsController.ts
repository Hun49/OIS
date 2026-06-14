import { Request, Response } from 'express';
import { db } from '../database/db.ts';
import { getRefundsCost, calculateNetTotals } from '../utils/financial.ts';

export function queryReport(req: Request, res: Response) {
  const { type, start_date, end_date } = req.query;

  try {
    const actorId = req.session.userId!;
    const actor = db.prepare('SELECT role_type FROM users WHERE id = ?').get(actorId) as any;
    const permissions = db.prepare('SELECT * FROM user_permissions WHERE user_id = ?').get(actorId) as any;

    const canViewAllSales = actor?.role_type === 'owner' || (permissions && permissions.can_view_reports === 1);

    if (!canViewAllSales) {
      const allowedSalesTypes = [
        'daily_sales',
        'weekly_revenue',
        'weekly_profit',
        'monthly_revenue',
        'monthly_profit',
        'custom_range'
      ];
      if (!type || !allowedSalesTypes.includes(type as string)) {
        return res.status(403).json({ error: 'Permission Denied: Access to detailed reports restricted' });
      }
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Helper to calculate date boundaries
    const getWeekBoundaries = () => {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      return start.toISOString().split('T')[0];
    };

    const getMonthBoundaries = () => {
      return now.toISOString().substring(0, 8) + '01'; // YYYY-MM-01
    };

    let salesData: any[] = [];
    let summary: any = {};

    switch (type) {
      case 'daily_sales': {
        if (canViewAllSales) {
          salesData = db.prepare(`
            SELECT s.*, u.username as cashier 
            FROM sales s 
            LEFT JOIN users u ON s.sold_by_user_id = u.id 
            WHERE s.created_at LIKE ? AND s.status = 'completed'
            ORDER BY s.created_at DESC
          `).all(todayStr + '%');
        } else {
          salesData = db.prepare(`
            SELECT s.*, u.username as cashier 
            FROM sales s 
            LEFT JOIN users u ON s.sold_by_user_id = u.id 
            WHERE s.created_at LIKE ? AND s.status = 'completed' AND s.sold_by_user_id = ?
            ORDER BY s.created_at DESC
          `).all(todayStr + '%', actorId);
        }
        
        const refunds = getRefundsCost(todayStr + '%', undefined, undefined, canViewAllSales ? undefined : actorId);
        summary = calculateNetTotals(salesData, refunds);
        break;
      }
      case 'weekly_revenue':
      case 'weekly_profit': {
        const weekStartStr = getWeekBoundaries();
        if (canViewAllSales) {
          salesData = db.prepare(`
            SELECT s.*, u.username as cashier 
            FROM sales s 
            LEFT JOIN users u ON s.sold_by_user_id = u.id 
            WHERE s.created_at >= ? AND s.status = 'completed'
            ORDER BY s.created_at DESC
          `).all(weekStartStr);
        } else {
          salesData = db.prepare(`
            SELECT s.*, u.username as cashier 
            FROM sales s 
            LEFT JOIN users u ON s.sold_by_user_id = u.id 
            WHERE s.created_at >= ? AND s.status = 'completed' AND s.sold_by_user_id = ?
            ORDER BY s.created_at DESC
          `).all(weekStartStr, actorId);
        }

        const refunds = getRefundsCost(undefined, weekStartStr, undefined, canViewAllSales ? undefined : actorId);
        summary = calculateNetTotals(salesData, refunds);
        break;
      }
      case 'monthly_revenue':
      case 'monthly_profit': {
        const monthStartStr = getMonthBoundaries();
        if (canViewAllSales) {
          salesData = db.prepare(`
            SELECT s.*, u.username as cashier 
            FROM sales s 
            LEFT JOIN users u ON s.sold_by_user_id = u.id 
            WHERE s.created_at >= ? AND s.status = 'completed'
            ORDER BY s.created_at DESC
          `).all(monthStartStr);
        } else {
          salesData = db.prepare(`
            SELECT s.*, u.username as cashier 
            FROM sales s 
            LEFT JOIN users u ON s.sold_by_user_id = u.id 
            WHERE s.created_at >= ? AND s.status = 'completed' AND s.sold_by_user_id = ?
            ORDER BY s.created_at DESC
          `).all(monthStartStr, actorId);
        }

        const refunds = getRefundsCost(undefined, monthStartStr, undefined, canViewAllSales ? undefined : actorId);
        summary = calculateNetTotals(salesData, refunds);
        break;
      }
      case 'custom_range': {
        if (!start_date || !end_date) {
          return res.status(400).json({ error: 'Start and End dates are required for custom report search' });
        }
        if (canViewAllSales) {
          salesData = db.prepare(`
            SELECT s.*, u.username as cashier 
            FROM sales s 
            LEFT JOIN users u ON s.sold_by_user_id = u.id 
            WHERE s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'
            ORDER BY s.created_at DESC
          `).all((start_date as string) + 'T00:00:00', (end_date as string) + 'T23:59:59');
        } else {
          salesData = db.prepare(`
            SELECT s.*, u.username as cashier 
            FROM sales s 
            LEFT JOIN users u ON s.sold_by_user_id = u.id 
            WHERE s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed' AND s.sold_by_user_id = ?
            ORDER BY s.created_at DESC
          `).all((start_date as string) + 'T00:00:00', (end_date as string) + 'T23:59:59', actorId);
        }

        const refunds = getRefundsCost(undefined, (start_date as string) + 'T00:00:00', (end_date as string) + 'T23:59:59', canViewAllSales ? undefined : actorId);
        summary = calculateNetTotals(salesData, refunds);
        break;
      }
      case 'top_selling': {
        salesData = db.prepare(`
          SELECT 
            si.product_name,
            si.variant_name,
            si.sku,
            (SUM(si.quantity) - IFNULL(ret.returned_units, 0)) as total_units,
            ROUND(SUM(si.line_total) - IFNULL(ret.returned_revenue, 0), 2) as total_revenue,
            ROUND(SUM(si.line_profit) - IFNULL(ret.returned_profit, 0), 2) as total_profit
          FROM sale_items si
          INNER JOIN sales s ON si.sale_id = s.id
          LEFT JOIN (
            SELECT 
              si2.product_id, 
              si2.variant_id,
              SUM(si2.quantity) as returned_units,
              SUM(si2.line_total) as returned_revenue,
              SUM(si2.line_profit) as returned_profit
            FROM return_requests rr
            INNER JOIN sale_items si2 ON (rr.sale_item_id IS NOT NULL AND rr.sale_item_id = si2.id) OR (rr.sale_item_id IS NULL AND rr.sale_id = si2.sale_id)
            WHERE rr.status = 'approved'
            GROUP BY si2.product_id, si2.variant_id
          ) ret ON si.product_id = ret.product_id AND (si.variant_id = ret.variant_id OR (si.variant_id IS NULL AND ret.variant_id IS NULL))
          GROUP BY si.product_id, si.variant_id
          ORDER BY total_units DESC
          LIMIT 25
        `).all();
        summary = {
          total_products_tracked: salesData.length
        };
        break;
      }
      case 'top_employees': {
        salesData = db.prepare(`
          SELECT 
            u.full_name,
            u.username,
            COUNT(s.id) as total_transactions,
            ROUND(SUM(s.total_amount) - IFNULL(ret.returned_revenue, 0), 2) as net_revenue,
            ROUND(SUM(s.total_profit) - IFNULL(ret.returned_profit, 0), 2) as net_profit
          FROM users u
          INNER JOIN sales s ON u.id = s.sold_by_user_id
          LEFT JOIN (
            SELECT 
              s2.sold_by_user_id,
              SUM(rr.refund_amount) as returned_revenue,
              SUM(rr.refund_amount - IFNULL(ret_cost.cost, 0)) as returned_profit
            FROM return_requests rr
            INNER JOIN sales s2 ON rr.sale_id = s2.id
            LEFT JOIN (
               SELECT 
                rr2.id as return_id,
                CASE 
                  WHEN rr2.sale_item_id IS NOT NULL THEN (SELECT (si.buy_price * si.quantity) FROM sale_items si WHERE si.id = rr2.sale_item_id)
                  ELSE (SELECT IFNULL(SUM(si.buy_price * si.quantity), 0) FROM sale_items si WHERE si.sale_id = rr2.sale_id)
                END as cost
               FROM return_requests rr2
            ) ret_cost ON rr.id = ret_cost.return_id
            WHERE rr.status = 'approved'
            GROUP BY s2.sold_by_user_id
          ) ret ON u.id = ret.sold_by_user_id
          WHERE u.role_type = 'employee' AND s.status = 'completed'
          GROUP BY u.id
          ORDER BY net_revenue DESC
        `).all();
        summary = {
          total_employees_ranked: salesData.length
        };
        break;
      }
      case 'low_stock': {
        // Find simple products below target
        const simple = db.prepare(`
          SELECT p.sku, p.product_id_display as display_id, p.name, '' as variant_name, p.low_stock_threshold,
                 (SELECT IFNULL(SUM(quantity_added), 0) FROM stock_batches WHERE product_id = p.id) - 
                 (SELECT IFNULL(SUM(quantity), 0) FROM sale_items WHERE product_id = p.id) as current_stock
          FROM products p
          WHERE p.has_variants = 0 AND p.is_active = 1
        `).all() as any[];

        const variants = db.prepare(`
          SELECT pv.sku_variant as sku, pv.sku_variant as display_id, p.name, pv.variant_name, pv.low_stock_threshold, pv.stock_quantity as current_stock
          FROM product_variants pv
          INNER JOIN products p ON pv.product_id = p.id
          WHERE pv.is_active = 1
        `).all() as any[];

        const combined = [...simple, ...variants];
        salesData = combined.filter((c: any) => c.current_stock <= c.low_stock_threshold);
        summary = {
          total_low_stock_items: salesData.length
        };
        break;
      }
      default:
        return res.status(400).json({ error: 'Unsupported report type' });
    }

    return res.json({
      success: true,
      sales: salesData,
      summary
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
