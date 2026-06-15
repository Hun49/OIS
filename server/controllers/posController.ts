import { Request, Response } from 'express';
import { db } from '../database/db.ts';

export function searchPos(req: Request, res: Response) {
  const { query, category_id } = req.query;

  try {
    let sql = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
    `;
    const params: any[] = [];

    if (category_id) {
      sql += ' AND p.category_id = ?';
      params.push(category_id);
    }

    if (query) {
      sql += ' AND (p.name LIKE ? OR p.brand LIKE ? OR p.product_type LIKE ? OR p.sku LIKE ? OR p.product_id_display LIKE ? OR p.description LIKE ?)';
      const term = `%${query}%`;
      params.push(term, term, term, term, term, term);
    }

    // Rank products inside selected category by most sold items first
    sql += `
      ORDER BY (
        (SELECT IFNULL(SUM(si.quantity), 0) FROM sale_items si
         INNER JOIN sales s ON si.sale_id = s.id
         WHERE si.product_id = p.id)
        -
        (SELECT IFNULL(SUM(si2.quantity), 0) FROM return_requests rr
         INNER JOIN sale_items si2 ON (rr.sale_item_id IS NOT NULL AND rr.sale_item_id = si2.id) OR (rr.sale_item_id IS NULL AND rr.sale_id = si2.sale_id)
         WHERE rr.status = 'approved' AND si2.product_id = p.id)
      ) DESC, p.name ASC
    `;

    sql += ' LIMIT 50';

    const products = db.prepare(sql).all(...params) as any[];

    // Batch fetch all variants for these products
    const pIds = products.map(p => p.id);
    const variantsMap = new Map<number, any[]>();
    if (pIds.length > 0) {
      const placeholders = pIds.map(() => '?').join(',');
      const variants = db.prepare(`SELECT * FROM product_variants WHERE product_id IN (${placeholders}) AND is_active = 1`).all(...pIds) as any[];
      variants.forEach(v => {
        if (!variantsMap.has(v.product_id)) variantsMap.set(v.product_id, []);
        variantsMap.get(v.product_id)!.push(v);
      });
    }

    // Batch fetch stock summaries for simple products to avoid N+1
    const simpleProductStockMap = new Map<number, number>();
    const simplePIds = products.filter(p => !p.has_variants).map(p => p.id);
    if (simplePIds.length > 0) {
      const placeholders = simplePIds.map(() => '?').join(',');
      
      const batches = db.prepare(`SELECT product_id, SUM(quantity_added) as total FROM stock_batches WHERE product_id IN (${placeholders}) GROUP BY product_id`).all(...simplePIds) as any[];
      const sales = db.prepare(`SELECT product_id, SUM(quantity) as total FROM sale_items WHERE product_id IN (${placeholders}) GROUP BY product_id`).all(...simplePIds) as any[];
      
      const batchValues = new Map(batches.map(b => [b.product_id, b.total]));
      const saleValues = new Map(sales.map(s => [s.product_id, s.total]));
      
      simplePIds.forEach(id => {
        const qty = (batchValues.get(id) || 0) - (saleValues.get(id) || 0);
        simpleProductStockMap.set(id, qty);
      });
    }

    for (const p of products) {
      const variants = variantsMap.get(p.id) || [];
      p.variants = variants;
      if (p.has_variants) {
        p.stock = variants.reduce((acc, v) => acc + (v.stock_quantity || 0), 0);
      } else {
        p.stock = simpleProductStockMap.get(p.id) || 0;
      }
    }

    return res.json(products);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
