import { db } from '../database/db.ts';

/**
 * Calculates the total cost of items returned in one or more return requests.
 * Factors in whether a return was for a specific sale item or an entire sale.
 * @param returnIds Array of return request IDs to aggregate
 * @returns Total cost of goods returned
 */
export function getRefundsCost(approvedAtPattern?: string, startDate?: string, endDate?: string, userId?: number): { total_refund: number, total_refund_cost: number } {
  let query = `
    SELECT 
      IFNULL(SUM(rr.refund_amount), 0) as total_refund,
      IFNULL(SUM(
        CASE 
          WHEN rr.sale_item_id IS NOT NULL THEN (SELECT (si.buy_price * si.quantity) FROM sale_items si WHERE si.id = rr.sale_item_id)
          ELSE (SELECT IFNULL(SUM(si.buy_price * si.quantity), 0) FROM sale_items si WHERE si.sale_id = rr.sale_id)
        END
      ), 0) as total_refund_cost
    FROM return_requests rr
  `;
  
  const conditions: string[] = ["rr.status = 'approved'"];
  const params: any[] = [];

  if (approvedAtPattern) {
    conditions.push("rr.approved_at LIKE ?");
    params.push(approvedAtPattern);
  } else if (startDate && endDate) {
    conditions.push("rr.approved_at >= ? AND rr.approved_at <= ?");
    params.push(startDate, endDate);
  } else if (startDate) {
     conditions.push("rr.approved_at >= ?");
     params.push(startDate);
  }

  if (userId) {
    query += " INNER JOIN sales s ON rr.sale_id = s.id";
    conditions.push("s.sold_by_user_id = ?");
    params.push(userId);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  const result = db.prepare(query).get(...params) as any;
  return {
    total_refund: result.total_refund || 0,
    total_refund_cost: result.total_refund_cost || 0
  };
}

/**
 * Shared logic for calculating net financial totals from a set of sales and returns.
 */
export function calculateNetTotals(sales: any[], refunds: { total_refund: number, total_refund_cost: number }) {
  const sumRevenue = sales.reduce((acc, s) => acc + s.total_amount, 0) - refunds.total_refund;
  const sumCost = sales.reduce((acc, s) => acc + s.total_cost, 0) - refunds.total_refund_cost;
  const sumProfit = sales.reduce((acc, s) => acc + s.total_profit, 0) - (refunds.total_refund - refunds.total_refund_cost);

  return {
    total_revenue: parseFloat(sumRevenue.toFixed(2)),
    total_cost: parseFloat(sumCost.toFixed(2)),
    total_profit: parseFloat(sumProfit.toFixed(2))
  };
}
