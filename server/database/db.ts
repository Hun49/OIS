import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

// -------------------------------------------------------------------------
// DIRECTORY CREATION & SETUP
// -------------------------------------------------------------------------
const dirs = [
  path.join(process.cwd(), 'database'),
  path.join(process.cwd(), 'backups'),
  path.join(process.cwd(), 'backups/daily'),
  path.join(process.cwd(), 'backups/archive'),
  path.join(process.cwd(), 'uploads'),
  path.join(process.cwd(), 'uploads/receipts'),
  path.join(process.cwd(), 'public'),
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// -------------------------------------------------------------------------
// DATABASE INITIALIZATION & SCHEMA
// -------------------------------------------------------------------------
export const db = new Database(path.join(process.cwd(), 'database/app.db'));
db.pragma('journal_mode = WAL');

// Create tables if they do NOT exist
db.exec(`
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role_type TEXT NOT NULL, -- 'owner' or 'employee'
    is_active INTEGER DEFAULT 1,
    must_change_password INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT
  );

  -- User permissions table
  CREATE TABLE IF NOT EXISTS user_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    can_view_dashboard INTEGER DEFAULT 0,
    can_manage_products INTEGER DEFAULT 0,
    can_manage_categories INTEGER DEFAULT 0,
    can_manage_stock INTEGER DEFAULT 0,
    can_sell INTEGER DEFAULT 0,
    can_create_returns INTEGER DEFAULT 0,
    can_approve_returns INTEGER DEFAULT 0,
    can_view_reports INTEGER DEFAULT 0,
    can_manage_employees INTEGER DEFAULT 0,
    can_view_audit_logs INTEGER DEFAULT 0,
    can_manage_backups INTEGER DEFAULT 0,
    can_edit_prices INTEGER DEFAULT 0,
    can_adjust_stock INTEGER DEFAULT 0,
    can_manage_settings INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Categories table
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Products table
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT NOT NULL UNIQUE,
    product_id_display TEXT NOT NULL UNIQUE,
    category_id INTEGER,
    brand TEXT,
    name TEXT NOT NULL,
    product_type TEXT,
    description TEXT,
    unit_type TEXT,
    has_variants INTEGER DEFAULT 0,
    expiry_required INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 0,
    buy_price REAL DEFAULT 0,
    sell_price REAL DEFAULT 0,
    profit_percentage REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(category_id) REFERENCES categories(id)
  );

  -- Product variants table
  CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    sku_variant TEXT NOT NULL UNIQUE,
    variant_name TEXT NOT NULL,
    variant_label_1 TEXT, -- size, color etc.
    variant_label_2 TEXT,
    variant_label_3 TEXT,
    description TEXT,
    stock_quantity INTEGER DEFAULT 0,
    buy_price REAL DEFAULT 0,
    sell_price REAL DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 0,
    expiry_date TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  -- Stock batches table (for stock tracking history/batches)
  CREATE TABLE IF NOT EXISTS stock_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    variant_id INTEGER,
    quantity_added INTEGER,
    buy_price REAL,
    sell_price REAL,
    expiry_date TEXT,
    reason TEXT,
    added_by_user_id INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(variant_id) REFERENCES product_variants(id)
  );

  -- Sales table
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_number TEXT NOT NULL UNIQUE,
    sold_by_user_id INTEGER,
    payment_type TEXT NOT NULL, -- 'cash' or 'mobile_transfer'
    total_items INTEGER NOT NULL,
    subtotal REAL NOT NULL,
    discount_amount REAL DEFAULT 0,
    total_amount REAL NOT NULL,
    total_cost REAL NOT NULL,
    total_profit REAL NOT NULL,
    transaction_reference TEXT,
    receipt_file_name TEXT,
    status TEXT DEFAULT 'completed', -- 'completed', 'refunded'
    created_at TEXT NOT NULL,
    FOREIGN KEY(sold_by_user_id) REFERENCES users(id)
  );

  -- Sale items table
  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    product_id INTEGER,
    variant_id INTEGER,
    sku TEXT NOT NULL,
    product_name TEXT NOT NULL,
    variant_name TEXT,
    quantity INTEGER NOT NULL,
    buy_price REAL NOT NULL,
    sell_price REAL NOT NULL,
    line_total REAL NOT NULL,
    line_profit REAL NOT NULL,
    FOREIGN KEY(sale_id) REFERENCES sales(id)
  );

  -- Return Requests table
  CREATE TABLE IF NOT EXISTS return_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    sale_item_id INTEGER,
    requested_by_user_id INTEGER,
    approved_by_user_id INTEGER,
    reason TEXT NOT NULL,
    refund_method TEXT NOT NULL,
    refund_amount REAL NOT NULL,
    transaction_reference TEXT,
    receipt_file_name TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TEXT NOT NULL,
    approved_at TEXT,
    FOREIGN KEY(sale_id) REFERENCES sales(id),
    FOREIGN KEY(sale_item_id) REFERENCES sale_items(id),
    FOREIGN KEY(requested_by_user_id) REFERENCES users(id),
    FOREIGN KEY(approved_by_user_id) REFERENCES users(id)
  );

  -- Inventory adjustments table
  CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    variant_id INTEGER,
    adjustment_type TEXT NOT NULL, -- 'damage', 'loss', 'expiry', 'correction'
    quantity_changed INTEGER NOT NULL,
    reason TEXT,
    adjusted_by_user_id INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(variant_id) REFERENCES product_variants(id),
    FOREIGN KEY(adjusted_by_user_id) REFERENCES users(id)
  );

  -- Audit logs table
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    before_value TEXT,
    after_value TEXT,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  -- Backups table
  CREATE TABLE IF NOT EXISTS backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    backup_type TEXT NOT NULL, -- 'auto', 'manual'
    created_at TEXT NOT NULL,
    kept_flag INTEGER DEFAULT 0,
    archive_path TEXT,
    retention_status TEXT DEFAULT 'active' -- 'active', 'archived', 'deleted'
  );

  -- Settings table
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Try inserting must_change_password column into users table if not already existing
try {
  db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0');
} catch (e) {
  // Column already exists
}

// -------------------------------------------------------------------------
// AUDIT LOG HELPER
// -------------------------------------------------------------------------
export function logAudit(
  userId: number | null,
  actionType: string,
  entityType: string,
  entityId: number | null,
  beforeVal: any,
  afterVal: any,
  description: string
) {
  try {
    const timestamp = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, action_type, entity_type, entity_id, before_value, after_value, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      userId,
      actionType,
      entityType,
      entityId,
      beforeVal ? JSON.stringify(beforeVal) : null,
      afterVal ? JSON.stringify(afterVal) : null,
      description,
      timestamp
    );
  } catch (err) {
    console.error('Failed to log audit:', err);
  }
}

// -------------------------------------------------------------------------
// INITIAL ROOT OWNER USER
// -------------------------------------------------------------------------
const userCountStmt = db.prepare('SELECT COUNT(*) as count FROM users');
const { count } = userCountStmt.get() as { count: number };
if (count === 0) {
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('password', salt);
  const timestamp = new Date().toISOString();

  const insertUser = db.prepare(`
    INSERT INTO users (full_name, username, password_hash, role_type, is_active, must_change_password, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, 1, ?, ?)
  `);
  const result = insertUser.run('Shop Owner', 'owner', passwordHash, 'owner', timestamp, timestamp);
  const userId = result.lastInsertRowid as number;

  const insertPerms = db.prepare(`
    INSERT INTO user_permissions (
      user_id, can_view_dashboard, can_manage_products, can_manage_categories,
      can_manage_stock, can_sell, can_create_returns, can_approve_returns,
      can_view_reports, can_manage_employees, can_view_audit_logs,
      can_manage_backups, can_edit_prices, can_adjust_stock, can_manage_settings
    ) VALUES (?, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)
  `);
  insertPerms.run(userId);

  console.log('----------------------------------------------------');
  console.log('Database initialized! Default owner account created:');
  console.log('Username: owner');
  console.log('Password: password');
  console.log('Please change this password immediately in settings.');
  console.log('----------------------------------------------------');

  logAudit(
    null,
    'employee created',
    'users',
    userId,
    null,
    { username: 'owner', role_type: 'owner' },
    'Auto-created default owner user on database setup.'
  );
}

// Ensure default settings exist
const checkSetting = db.prepare('SELECT COUNT(*) as count FROM settings WHERE setting_key = ?');
const insertSetting = db.prepare('INSERT INTO settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)');

const defaultSettings = [
  { key: 'session_timeout', value: '15' }, // 15 minutes of inactivity
  { key: 'last_backup_date', value: '' }, // track date of last automatic backup
  { key: 'shop_name', value: 'My Local Retail Shop' },
  { key: 'needs_retention_prompt', value: '0' }, // toggles front-end popup for older backups
];

defaultSettings.forEach(s => {
  const { count } = checkSetting.get(s.key) as { count: number };
  if (count === 0) {
    insertSetting.run(s.key, s.value, new Date().toISOString());
  }
});
