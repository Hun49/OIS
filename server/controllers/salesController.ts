import { Request, Response } from 'express';
import { db, logAudit } from '../database/db.ts';

const checkoutTransaction = db.transaction((data: any) => {
  const { cart, payment_type, payment_subtype, transaction_reference, discount_amount, userId, timestamp, diskFilename } = data;

  // Check inventory availability and build records
  let totalItems = 0;
  let subtotal = 0;
  let totalCost = 0;
  let totalProfit = 0;

  const itemsToInsert: any[] = [];

  for (const item of cart) {
    const pid = parseInt(item.product_id);
    const vid = item.variant_id ? parseInt(item.variant_id) : null;
    const qtyRequested = parseInt(item.quantity);

    if (qtyRequested <= 0) {
      throw new Error('Quantity must be positive');
    }

    const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(pid) as any;
    if (!prod) {
      throw new Error(`Product with ID ${pid} not found.`);
    }

    let buyPrice = prod.buy_price;
    let sellPrice = prod.sell_price;
    let variantName: string | null = null;

    if (vid) {
      const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(vid) as any;
      if (!variant) {
        throw new Error(`Variant ID ${vid} for product ${prod.name} not found.`);
      }
      if (variant.stock_quantity < qtyRequested) {
        throw new Error(`Insufficient stock for SKU ${variant.sku_variant} (${prod.name} - ${variant.variant_name}). Available: ${variant.stock_quantity}, Requested: ${qtyRequested}`);
      }
      buyPrice = variant.buy_price;
      sellPrice = variant.sell_price;
      variantName = variant.variant_name;
    } else {
      const added = db.prepare('SELECT SUM(quantity_added) as qty FROM stock_batches WHERE product_id = ?').get(pid) as any;
      const sold = db.prepare('SELECT SUM(quantity) as qty FROM sale_items WHERE product_id = ?').get(pid) as any;
      const currentStock = (added?.qty || 0) - (sold?.qty || 0);

      if (currentStock < qtyRequested) {
        throw new Error(`Insufficient stock for product ${prod.name}. Available: ${currentStock}, Requested: ${qtyRequested}`);
      }
    }

    const lineTotal = sellPrice * qtyRequested;
    const lineCost = buyPrice * qtyRequested;
    const lineProfit = lineTotal - lineCost;

    totalItems += qtyRequested;
    subtotal += lineTotal;
    totalCost += lineCost;
    totalProfit += lineProfit;

    itemsToInsert.push({
      product_id: pid,
      variant_id: vid,
      sku: vid ? (db.prepare('SELECT sku_variant FROM product_variants WHERE id = ?').get(vid) as any).sku_variant : prod.sku,
      product_name: prod.name,
      variant_name: variantName,
      quantity: qtyRequested,
      buy_price: buyPrice,
      sell_price: sellPrice,
      line_total: lineTotal,
      line_profit: lineProfit
    });
  }

  const disc = parseFloat(discount_amount) || 0;
  const finalAmount = subtotal - disc;
  const finalProfit = totalProfit - disc;

  const dStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const randId = Math.random().toString(36).substring(2, 6).toUpperCase();
  const saleNumber = `SALE-${dStr}-${randId}`;

  // Handle PIV generation if subtype is piv
  let finalTxRef = transaction_reference;
  if (payment_type === 'mobile' && payment_subtype === 'piv') {
    const lastPiv = db.prepare("SELECT transaction_reference FROM sales WHERE payment_subtype = 'piv' ORDER BY id DESC LIMIT 1").get() as any;
    if (!lastPiv || !lastPiv.transaction_reference) {
      finalTxRef = 'PIV-001';
    } else {
      const match = lastPiv.transaction_reference.match(/PIV-(\d+)/);
      if (!match) {
        finalTxRef = 'PIV-001';
      } else {
        const nextNum = parseInt(match[1]) + 1;
        finalTxRef = `PIV-${String(nextNum).padStart(3, '0')}`;
      }
    }
  }

  // 1. Save Sale record
  const insertSale = db.prepare(`
    INSERT INTO sales (sale_number, sold_by_user_id, payment_type, payment_subtype, total_items, subtotal, discount_amount, total_amount, total_cost, total_profit, transaction_reference, receipt_file_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = insertSale.run(
    saleNumber,
    userId,
    payment_type, // 'cash' or 'mobile'
    payment_subtype || 'none',
    totalItems,
    subtotal,
    disc,
    finalAmount,
    totalCost,
    finalProfit,
    finalTxRef || null,
    diskFilename,
    timestamp
  );

  const saleId = result.lastInsertRowid as number;

  const insertSaleItem = db.prepare(`
    INSERT INTO sale_items (sale_id, product_id, variant_id, sku, product_name, variant_name, quantity, buy_price, sell_price, line_total, line_profit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of itemsToInsert) {
    insertSaleItem.run(
      saleId,
      item.product_id,
      item.variant_id,
      item.sku,
      item.product_name,
      item.variant_name,
      item.quantity,
      item.buy_price,
      item.sell_price,
      item.line_total,
      item.line_profit
    );

    if (item.variant_id) {
      db.prepare(`
        UPDATE product_variants 
        SET stock_quantity = stock_quantity - ?, updated_at = ?
        WHERE id = ?
      `).run(item.quantity, timestamp, item.variant_id);
    }
  }

  logAudit(
    userId,
    'sale created',
    'sales',
    saleId,
    null,
    { sale_number: saleNumber, total_amount: finalAmount },
    `Created sale ${saleNumber}. Payment: ${payment_type}. Subtype: ${payment_subtype}. Number of items: ${totalItems}.`
  );

  return { 
    saleId, 
    sale_number: saleNumber, 
    piv_assigned: (payment_subtype === 'piv') ? finalTxRef : null 
  };
});

export function getNextPiv(req: Request, res: Response) {
  try {
    const lastPiv = db.prepare("SELECT transaction_reference FROM sales WHERE payment_subtype = 'piv' ORDER BY id DESC LIMIT 1").get() as any;
    let nextPiv = 'PIV-001';
    if (lastPiv && lastPiv.transaction_reference) {
      const match = lastPiv.transaction_reference.match(/PIV-(\d+)/);
      if (match) {
        const nextNum = parseInt(match[1]) + 1;
        nextPiv = `PIV-${String(nextNum).padStart(3, '0')}`;
      }
    }
    return res.json({ nextPiv });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export function checkout(req: Request, res: Response) {
  const { cart: cartJSON, payment_type, payment_subtype, transaction_reference, discount_amount } = req.body;

  if (!cartJSON || !payment_type) {
    return res.status(400).json({ error: 'Cart content and payment type are required.' });
  }

  try {
    const cart = JSON.parse(cartJSON);
    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: 'Cart must be a non-empty list of products' });
    }

    const timestamp = new Date().toISOString();
    const diskFilename = req.file ? req.file.filename : null;

    const result = checkoutTransaction({
      cart,
      payment_type,
      payment_subtype,
      transaction_reference,
      discount_amount,
      userId: req.session.userId!,
      timestamp,
      diskFilename
    });

    return res.json({ success: true, ...result });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
