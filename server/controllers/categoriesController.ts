import { Request, Response } from 'express';
import { db, logAudit } from '../database/db.ts';

export function getCategories(req: Request, res: Response) {
  try {
    const user = db.prepare('SELECT role_type FROM users WHERE id = ?').get(req.session.userId) as any;
    if (user?.role_type !== 'owner') {
      const perms = db.prepare('SELECT * FROM user_permissions WHERE user_id = ?').get(req.session.userId) as any;
      const hasAny = perms && (
        perms.can_manage_categories === 1 ||
        perms.can_manage_products === 1 ||
        perms.can_manage_stock === 1 ||
        perms.can_adjust_stock === 1 ||
        perms.can_sell === 1
      );
      if (!hasAny) {
        return res.status(403).json({ error: "Permission Denied: Categorization view restricted" });
      }
    }

    const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
    return res.json(categories);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export function createCategory(req: Request, res: Response) {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  try {
    const timestamp = new Date().toISOString();
    const insert = db.prepare(`
      INSERT INTO categories (name, description, is_active, created_at, updated_at)
      VALUES (?, ?, 1, ?, ?)
    `);
    const resId = insert.run(name, description, timestamp, timestamp);
    const catId = resId.lastInsertRowid as number;

    logAudit(req.session.userId!, 'category created', 'categories', catId, null, { name, description }, `Category '${name}' was created.`);

    return res.json({ success: true, categoryId: catId });
  } catch (err: any) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Category with this name already exists.' });
    }
    return res.status(500).json({ error: err.message });
  }
}

export function updateCategory(req: Request, res: Response) {
  const catId = parseInt(req.params.id);
  const { name, description, is_active } = req.body;

  try {
    const before = db.prepare('SELECT * FROM categories WHERE id = ?').get(catId);
    if (!before) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    const timestamp = new Date().toISOString();
    const update = db.prepare(`
      UPDATE categories 
      SET name = ?, description = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `);
    update.run(name, description, is_active !== undefined ? is_active : 1, timestamp, catId);

    const after = db.prepare('SELECT * FROM categories WHERE id = ?').get(catId);

    logAudit(req.session.userId!, 'category edited', 'categories', catId, before, after, `Category '${name}' was edited.`);

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
