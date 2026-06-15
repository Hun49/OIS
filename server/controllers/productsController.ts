import { Request, Response } from 'express';
import { db, logAudit } from '../database/db.ts';

export function getProducts(req: Request, res: Response) {
  try {
    const user = db.prepare('SELECT role_type FROM users WHERE id = ?').get(req.session.userId) as any;
    if (user?.role_type !== 'owner') {
      const perms = db.prepare('SELECT * FROM user_permissions WHERE user_id = ?').get(req.session.userId) as any;
      const hasAny = perms && (
        perms.can_manage_products === 1 ||
        perms.can_manage_stock === 1 ||
        perms.can_adjust_stock === 1 ||
        perms.can_sell === 1 ||
        perms.can_create_returns === 1 ||
        perms.can_approve_returns === 1
      );
      if (!hasAny) {
        return res.status(403).json({ error: "Permission Denied: Product catalog view restricted" });
      }
    }

    // List all products with their categories
    const products = db.prepare(`
      SELECT products.*, categories.name as category_name
      FROM products
      LEFT JOIN categories ON products.category_id = categories.id
      ORDER BY products.name ASC
    `).all() as any[];

    // Optimize performance: Fetch all relevant variants in one batch instead of N individual queries
    const allVariants = db.prepare('SELECT * FROM product_variants').all() as any[];
    const variantsMap = new Map<number, any[]>();
    allVariants.forEach(v => {
      if (!variantsMap.has(v.product_id)) variantsMap.set(v.product_id, []);
      variantsMap.get(v.product_id)!.push(v);
    });

    // Map variant stocks and expiry alerts onto the items
    for (const p of products) {
      if (p.has_variants) {
        const variants = variantsMap.get(p.id) || [];
        p.variants = variants;
        p.stock = variants.reduce((acc, v) => acc + (v.stock_quantity || 0), 0);
      } else {
        // Find stock based on batches and sold items
        const added = db.prepare('SELECT SUM(quantity_added) as qty FROM stock_batches WHERE product_id = ?').get(p.id) as any;
        const sold = db.prepare('SELECT SUM(quantity) as qty FROM sale_items WHERE product_id = ?').get(p.id) as any;
        p.stock = (added?.qty || 0) - (sold?.qty || 0);
        p.variants = [];
      }
    }

    return res.json(products);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

const createProductTransaction = db.transaction((data: any) => {
  const {
    category_id, brand, name, product_type, description, unit_type,
    has_variants, expiry_required, low_stock_threshold, buy_price,
    profit_percentage, variants, userId, timestamp, sku, displayId,
    pPct, bPrice, sPrice, initial_quantity
  } = data;

  const insertProduct = db.prepare(`
    INSERT INTO products (
      sku, product_id_display, category_id, brand, name, product_type,
      description, unit_type, has_variants, expiry_required, low_stock_threshold,
      buy_price, sell_price, profit_percentage, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  const result = insertProduct.run(
    sku,
    displayId,
    category_id,
    brand || '',
    name,
    product_type || '',
    description || '',
    unit_type || 'pcs',
    has_variants ? 1 : 0,
    expiry_required ? 1 : 0,
    parseInt(low_stock_threshold) || 0,
    bPrice,
    sPrice,
    pPct,
    timestamp,
    timestamp
  );

  const productId = result.lastInsertRowid as number;

  const initQty = parseInt(initial_quantity) || 0;
  if (!has_variants && initQty > 0) {
    const insertBatch = db.prepare(`
      INSERT INTO stock_batches (product_id, variant_id, quantity_added, buy_price, sell_price, reason, added_by_user_id, created_at)
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?)
    `);
    insertBatch.run(productId, initQty, bPrice, sPrice, 'Initial Stock', userId, timestamp);
  }

  if (has_variants && Array.isArray(variants)) {
    const insertVariant = db.prepare(`
      INSERT INTO product_variants (
        product_id, sku_variant, variant_name, variant_label_1, variant_label_2, variant_label_3,
        description, stock_quantity, buy_price, sell_price, low_stock_threshold, expiry_date,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    variants.forEach((v: any) => {
      const vRandomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
      const vSku = `VAR-${vRandomHex}`;
      const vName = v.variant_name || `${v.label1 || ''} / ${v.label2 || ''}`;
      
      const vPct = parseFloat(v.profit_percentage) || pPct;
      const vBPrice = parseFloat(v.buy_price) || bPrice;
      if (vBPrice < 0) throw new Error(`Buy price for variant ${vName} cannot be negative.`);
      if (vPct < -100) throw new Error(`Profit percentage for variant ${vName} cannot be less than -100%.`);
      const vSPrice = parseFloat((vBPrice * (1 + vPct / 100)).toFixed(2));
      const vQty = parseInt(v.initial_quantity) || 0;
      if (vQty < 0) throw new Error(`Initial quantity for variant ${vName} cannot be negative.`);

      const vResult = insertVariant.run(
        productId,
        vSku,
        vName,
        v.label1 || '',
        v.label2 || '',
        v.label3 || '',
        v.description || '',
        vQty,
        vBPrice,
        vSPrice,
        parseInt(v.low_stock_threshold) || parseInt(low_stock_threshold) || 0,
        v.expiry_date || '',
        timestamp,
        timestamp
      );

      const variantId = vResult.lastInsertRowid as number;

      if (vQty > 0) {
        const insertBatch = db.prepare(`
          INSERT INTO stock_batches (product_id, variant_id, quantity_added, buy_price, sell_price, reason, added_by_user_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insertBatch.run(productId, variantId, vQty, vBPrice, vSPrice, 'Initial Stock', userId, timestamp);
      }
    });
  }

  logAudit(userId, 'product created', 'products', productId, null, { name, sku, displayId }, `Product '${name}' created.`);

  return { productId, product_id_display: displayId };
});

export function createProduct(req: Request, res: Response) {
  const {
    category_id, brand, name, product_type, description, unit_type,
    has_variants, expiry_required, low_stock_threshold, buy_price,
    profit_percentage, variants, initial_quantity
  } = req.body;

  if (!name || !category_id) {
    return res.status(400).json({ error: 'Product name and category are required.' });
  }

  const thresholdVal = parseInt(low_stock_threshold);
  if (low_stock_threshold !== undefined && (isNaN(thresholdVal) || thresholdVal < 0)) {
    return res.status(400).json({ error: 'Low stock threshold must be a non-negative numeric value.' });
  }

  try {
    const timestamp = new Date().toISOString();
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const sku = `PROD-${randomHex}`;
    const displayId = `ID-${Math.floor(1000 + Math.random() * 9000)}`;

    const pPct = parseFloat(profit_percentage) || 10;
    const bPrice = parseFloat(buy_price) || 0;
    if (bPrice < 0) return res.status(400).json({ error: 'Buy price cannot be negative.' });
    if (pPct < -100) return res.status(400).json({ error: 'Profit percentage cannot be less than -100%.' });
    const sPrice = parseFloat((bPrice * (1 + pPct / 100)).toFixed(2));

    const result = createProductTransaction({
      category_id, brand, name, product_type, description, unit_type,
      has_variants, expiry_required, low_stock_threshold, buy_price,
      profit_percentage, variants, userId: req.session.userId!, timestamp,
      sku, displayId, pPct, bPrice, sPrice, initial_quantity
    });

    return res.json({ success: true, ...result });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

const updateProductTransaction = db.transaction((data: any) => {
  const {
    prodId, category_id, brand, name, product_type, description, unit_type,
    expiry_required, low_stock_threshold, is_active, buy_price, sell_price, profit_percentage,
    userId, timestamp, pricePermission
  } = data;

  const beforeObj = db.prepare('SELECT * FROM products WHERE id = ?').get(prodId) as any;
  if (!beforeObj) {
    throw new Error('Product not found.');
  }

  let bPrice = beforeObj.buy_price;
  let sPrice = beforeObj.sell_price;
  let pPct = beforeObj.profit_percentage;

  if (pricePermission) {
    if (buy_price !== undefined) {
      bPrice = parseFloat(buy_price);
      if (bPrice < 0) throw new Error('Buy price cannot be negative.');
    }
    if (profit_percentage !== undefined) {
      pPct = parseFloat(profit_percentage);
      if (pPct < -100) throw new Error('Profit percentage cannot be less than -100%.');
    }
    if (sell_price !== undefined) {
      sPrice = parseFloat(sell_price);
      if (sPrice < 0) throw new Error('Sell price cannot be negative.');
    } else if (buy_price !== undefined || profit_percentage !== undefined) {
      sPrice = parseFloat((bPrice * (1 + pPct / 100)).toFixed(2));
    }
  }

  const updateProduct = db.prepare(`
    UPDATE products 
    SET category_id = ?, brand = ?, name = ?, product_type = ?, description = ?, unit_type = ?,
        expiry_required = ?, low_stock_threshold = ?, is_active = ?, buy_price = ?, sell_price = ?,
        profit_percentage = ?, updated_at = ?
    WHERE id = ?
  `);

  updateProduct.run(
    category_id,
    brand,
    name,
    product_type,
    description,
    unit_type,
    expiry_required ? 1 : 0,
    parseInt(low_stock_threshold) || 0,
    is_active !== undefined ? is_active : 1,
    bPrice,
    sPrice,
    pPct,
    timestamp,
    prodId
  );

  const afterObj = db.prepare('SELECT * FROM products WHERE id = ?').get(prodId);

  if (beforeObj.sell_price !== sPrice || beforeObj.buy_price !== bPrice) {
    logAudit(
      userId,
      'price changes',
      'products',
      prodId,
      { buy_price: beforeObj.buy_price, sell_price: beforeObj.sell_price },
      { buy_price: bPrice, sell_price: sPrice },
      `Pricing updated for product: ${name}`
    );
  }

  logAudit(userId, 'product edited', 'products', prodId, beforeObj, afterObj, `Product '${name}' details modified.`);
});

export function updateProduct(req: Request, res: Response) {
  const prodId = parseInt(req.params.id);
  const {
    category_id, brand, name, product_type, description, unit_type,
    expiry_required, low_stock_threshold, is_active, buy_price, sell_price, profit_percentage
  } = req.body;

  const thresholdVal = parseInt(low_stock_threshold);
  if (low_stock_threshold !== undefined && (isNaN(thresholdVal) || thresholdVal < 0)) {
    return res.status(400).json({ error: 'Low stock threshold must be a non-negative numeric value.' });
  }

  try {
    const timestamp = new Date().toISOString();
    const pricePermission = req.session.role === 'owner' || req.session.permissions?.can_edit_prices === 1;

    updateProductTransaction({
      prodId, category_id, brand, name, product_type, description, unit_type,
      expiry_required, low_stock_threshold, is_active, buy_price, sell_price, profit_percentage,
      userId: req.session.userId!, timestamp, pricePermission
    });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

const addStockTransaction = db.transaction((data: any) => {
  const { product_id, variant_id, quantity, buy_price, expiry_date, reason, userId, timestamp } = data;

  const qty = parseInt(quantity);
  const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id) as any;
  if (!prod) throw new Error('Product not found.');

  let calculatedSellPrice = prod.sell_price;
  let actBuyPrice = parseFloat(buy_price) || prod.buy_price;

  if (variant_id) {
    const v = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(variant_id) as any;
    if (!v) throw new Error('Variant not found.');
    actBuyPrice = parseFloat(buy_price) || v.buy_price;
    calculatedSellPrice = parseFloat((actBuyPrice * (1 + prod.profit_percentage / 100)).toFixed(2));

    const insertBatch = db.prepare(`
      INSERT INTO stock_batches (product_id, variant_id, quantity_added, buy_price, sell_price, expiry_date, reason, added_by_user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertBatch.run(product_id, variant_id, qty, actBuyPrice, calculatedSellPrice, expiry_date || v.expiry_date, reason || 'Restock', userId, timestamp);

    const updateVarStock = db.prepare(`
      UPDATE product_variants 
      SET stock_quantity = stock_quantity + ?, buy_price = ?, sell_price = ?, expiry_date = ?, updated_at = ?
      WHERE id = ?
    `);
    updateVarStock.run(qty, actBuyPrice, calculatedSellPrice, expiry_date || v.expiry_date || '', timestamp, variant_id);

  } else {
    calculatedSellPrice = parseFloat((actBuyPrice * (1 + prod.profit_percentage / 100)).toFixed(2));

    const insertBatch = db.prepare(`
      INSERT INTO stock_batches (product_id, variant_id, quantity_added, buy_price, sell_price, expiry_date, reason, added_by_user_id, created_at)
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertBatch.run(product_id, qty, actBuyPrice, calculatedSellPrice, expiry_date, reason || 'Restock', userId, timestamp);

    const updateProdStock = db.prepare(`
      UPDATE products 
      SET buy_price = ?, sell_price = ?, updated_at = ?
      WHERE id = ?
    `);
    updateProdStock.run(actBuyPrice, calculatedSellPrice, timestamp, product_id);
  }

  logAudit(
    userId,
    'stock added',
    'products',
    product_id,
    null,
    { quantity_added: qty, buy_price: actBuyPrice },
    `Added ${qty} units of stock to product (Variant ID: ${variant_id || 'None'}).`
  );
});

export function addStock(req: Request, res: Response) {
  const { product_id, variant_id, quantity, buy_price, expiry_date, reason } = req.body;
  const qtyNum = parseInt(quantity);
  if (!product_id || isNaN(qtyNum) || qtyNum <= 0) {
    return res.status(400).json({ error: 'Product and a valid positive quantity are required.' });
  }

  try {
    const timestamp = new Date().toISOString();
    addStockTransaction({
      product_id, variant_id, quantity, buy_price, expiry_date, reason,
      userId: req.session.userId!, timestamp
    });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

const adjustStockTransaction = db.transaction((data: any) => {
  const { product_id, variant_id, adjustment_type, quantity, reason, userId, timestamp } = data;

  const qtyChange = parseInt(quantity);
  
  if (qtyChange === 0) throw new Error('Adjustment quantity cannot be zero.');
  if (['damage', 'loss', 'expiry'].includes(adjustment_type) && qtyChange > 0) {
    throw new Error(`Adjustment type '${adjustment_type}' must be a negative deduction, not an addition.`);
  }

  const insertAdj = db.prepare(`
    INSERT INTO inventory_adjustments (product_id, variant_id, adjustment_type, quantity_changed, reason, adjusted_by_user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertAdj.run(product_id, variant_id || null, adjustment_type, qtyChange, reason || '', userId, timestamp);

  if (variant_id) {
    db.prepare(`
      UPDATE product_variants 
      SET stock_quantity = stock_quantity + ?, updated_at = ? 
      WHERE id = ?
    `).run(qtyChange, timestamp, variant_id);
  } else {
    const prod = db.prepare('SELECT buy_price, sell_price FROM products WHERE id = ?').get(product_id) as any;
    db.prepare(`
      INSERT INTO stock_batches (product_id, variant_id, quantity_added, buy_price, sell_price, reason, added_by_user_id, created_at)
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?)
    `).run(product_id, qtyChange, prod?.buy_price || 0, prod?.sell_price || 0, `Adjustment: ${adjustment_type} - ${reason}`, userId, timestamp);
  }

  logAudit(
    userId,
    adjustment_type === 'damage' ? 'damaged goods write-off' : adjustment_type === 'expiry' ? 'expired goods write-off' : 'stock adjusted',
    'products',
    product_id,
    null,
    { quantity_changed: qtyChange, adjustment_type },
    `Stock adjusted: ${qtyChange} units marked as ${adjustment_type}. Reason: ${reason}`
  );
});

export function adjustStock(req: Request, res: Response) {
  const { product_id, variant_id, adjustment_type, quantity, reason } = req.body;
  if (!product_id || !adjustment_type || !quantity) {
    return res.status(400).json({ error: 'Missing mandatory fields' });
  }

  try {
    const timestamp = new Date().toISOString();
    adjustStockTransaction({
      product_id, variant_id, adjustment_type, quantity, reason,
      userId: req.session.userId!, timestamp
    });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
