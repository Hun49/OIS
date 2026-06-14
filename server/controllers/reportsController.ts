import { Request, Response } from 'express';
import { db } from '../database/db.ts';

export function queryReport(req: Request, res: Response) {
  const { type, start_date, end_date } = req.query;

  try {
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
        salesData = db.prepare(`
          SELECT s.*, u.username as cashier 
          FROM sales s 
          LEFT JOIN users u ON s.sold_by_user_id = u.id 
          WHERE s.created_at LIKE ? AND s.status = 'completed'
          ORDER BY s.created_at DESC
        `).all(todayStr + '%');
        
        const refunds = db.prepare(`
          SELECT 
            IFNULL(SUM(rr.refund_amount), 0) as total_refund,
            IFNULL(SUM(
              CASE 
                WHEN rr.sale_item_id IS NOT NULL THEN (SELECT (si.buy_price * si.quantity) FROM sale_items si WHERE si.id = rr.sale_item_id)
                ELSE (SELECT IFNULL(SUM(si.buy_price * si.quantity), 0) FROM sale_items si WHERE si.sale_id = rr.sale_id)
              END
            ), 0) as total_refund_cost
          FROM return_requests rr
          WHERE rr.status = 'approved' AND rr.approved_at LIKE ?
        `).get(todayStr + '%') as any;

        const sumRevenue = salesData.reduce((acc, s) => acc + s.total_amount, 0) - refunds.total_refund;
        const sumCost = salesData.reduce((acc, s) => acc + s.total_cost, 0) - refunds.total_refund_cost;
        const sumProfit = salesData.reduce((acc, s) => acc + s.total_profit, 0) - (refunds.total_refund - refunds.total_refund_cost);

        summary = {
          total_revenue: sumRevenue,
          total_cost: sumCost,
          total_profit: sumProfit
        };
        break;
      }
      case 'weekly_revenue':
      case 'weekly_profit': {
        const weekStartStr = getWeekBoundaries();
        salesData = db.prepare(`
          SELECT s.*, u.username as cashier 
          FROM sales s 
          LEFT JOIN users u ON s.sold_by_user_id = u.id 
          WHERE s.created_at >= ? AND s.status = 'completed'
          ORDER BY s.created_at DESC
        `).all(weekStartStr);

        const refunds = db.prepare(`
          SELECT 
            IFNULL(SUM(rr.refund_amount), 0) as total_refund,
            IFNULL(SUM(
              CASE 
                WHEN rr.sale_item_id IS NOT NULL THEN (SELECT (si.buy_price * si.quantity) FROM sale_items si WHERE si.id = rr.sale_item_id)
                ELSE (SELECT IFNULL(SUM(si.buy_price * si.quantity), 0) FROM sale_items si WHERE si.sale_id = rr.sale_id)
              END
            ), 0) as total_refund_cost
          FROM return_requests rr
          WHERE rr.status = 'approved' AND rr.approved_at >= ?
        `).get(weekStartStr) as any;

        const sumRevenue = salesData.reduce((acc, s) => acc + s.total_amount, 0) - refunds.total_refund;
        const sumCost = salesData.reduce((acc, s) => acc + s.total_cost, 0) - refunds.total_refund_cost;
        const sumProfit = salesData.reduce((acc, s) => acc + s.total_profit, 0) - (refunds.total_refund - refunds.total_refund_cost);

        summary = {
          total_revenue: sumRevenue,
          total_cost: sumCost,
          total_profit: sumProfit
        };
        break;
      }
      case 'monthly_revenue':
      case 'monthly_profit': {
        const monthStartStr = getMonthBoundaries();
        salesData = db.prepare(`
          SELECT s.*, u.username as cashier 
          FROM sales s 
          LEFT JOIN users u ON s.sold_by_user_id = u.id 
          WHERE s.created_at >= ? AND s.status = 'completed'
          ORDER BY s.created_at DESC
        `).all(monthStartStr);

        const refunds = db.prepare(`
          SELECT 
            IFNULL(SUM(rr.refund_amount), 0) as total_refund,
            IFNULL(SUM(
              CASE 
                WHEN rr.sale_item_id IS NOT NULL THEN (SELECT (si.buy_price * si.quantity) FROM sale_items si WHERE si.id = rr.sale_item_id)
                ELSE (SELECT IFNULL(SUM(si.buy_price * si.quantity), 0) FROM sale_items si WHERE si.sale_id = rr.sale_id)
              END
            ), 0) as total_refund_cost
          FROM return_requests rr
          WHERE rr.status = 'approved' AND rr.approved_at >= ?
        `).get(monthStartStr) as any;

        const sumRevenue = salesData.reduce((acc, s) => acc + s.total_amount, 0) - refunds.total_refund;
        const sumCost = salesData.reduce((acc, s) => acc + s.total_cost, 0) - refunds.total_refund_cost;
        const sumProfit = salesData.reduce((acc, s) => acc + s.total_profit, 0) - (refunds.total_refund - refunds.total_refund_cost);

        summary = {
          total_revenue: sumRevenue,
          total_cost: sumCost,
          total_profit: sumProfit
        };
        break;
      }
      case 'custom_range': {
        if (!start_date || !end_date) {
          return res.status(400).json({ error: 'Start and End dates are required for custom report search' });
        }
        salesData = db.prepare(`
          SELECT s.*, u.username as cashier 
          FROM sales s 
          LEFT JOIN users u ON s.sold_by_user_id = u.id 
          WHERE s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'
          ORDER BY s.created_at DESC
        `).all((start_date as string) + 'T00:00:00', (end_date as string) + 'T23:59:59');

        const refunds = db.prepare(`
          SELECT 
            IFNULL(SUM(rr.refund_amount), 0) as total_refund,
            IFNULL(SUM(
              CASE 
                WHEN rr.sale_item_id IS NOT NULL THEN (SELECT (si.buy_price * si.quantity) FROM sale_items si WHERE si.id = rr.sale_item_id)
                ELSE (SELECT IFNULL(SUM(si.buy_price * si.quantity), 0) FROM sale_items si WHERE si.sale_id = rr.sale_id)
              END
            ), 0) as total_refund_cost
          FROM return_requests rr
          WHERE rr.status = 'approved' AND rr.approved_at >= ? AND rr.approved_at <= ?
        `).get((start_date as string) + 'T00:00:00', (end_date as string) + 'T23:59:59') as any;

        const sumRevenue = salesData.reduce((acc, s) => acc + s.total_amount, 0) - refunds.total_refund;
        const sumCost = salesData.reduce((acc, s) => acc + s.total_cost, 0) - refunds.total_refund_cost;
        const sumProfit = salesData.reduce((acc, s) => acc + s.total_profit, 0) - (refunds.total_refund - refunds.total_refund_cost);

        summary = {
          total_revenue: sumRevenue,
          total_cost: sumCost,
          total_profit: sumProfit
        };
        break;
      }
      case 'top_selling': {
        salesData = db.prepare(`
          SELECT 
            si.product_name,
            si.variant_name,
            si.sku,
            (SUM(si.quantity) - IFNULL(ret.returned_units, 0)) as total_units,
            (SUM(si.line_total) - IFNULL(ret.returned_revenue, 0)) as total_revenue,
            (SUM(si.line_profit) - IFNULL(ret.returned_profit, 0)) as total_profit
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
