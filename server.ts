import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import multer from 'multer';

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
const db = new Database(path.join(process.cwd(), 'database/app.db'));
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
function logAudit(userId: number | null, actionType: string, entityType: string, entityId: number | null, beforeVal: any, afterVal: any, description: string) {
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

  logAudit(null, 'employee created', 'users', userId, null, { username: 'owner', role_type: 'owner' }, 'Auto-created default owner user on database setup.');
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

// -------------------------------------------------------------------------
// BACKUP ACTIONS IMPLEMENTATION
// -------------------------------------------------------------------------
function executeBackup(type: 'auto' | 'manual', userId: number | null): string {
  const timestamp = new Date().toISOString();
  // Safe format YYYY-MM-DD_HH-MM-SS
  const fileDate = timestamp.replace(/T/, '_').replace(/:/g, '-').split('.')[0];
  const filename = `backup_${fileDate}.db`;
  const backupFolder = path.join(process.cwd(), 'backups/daily');
  const backupPath = path.join(backupFolder, filename);

  const mainDbPath = path.join(process.cwd(), 'database/app.db');

  fs.copyFileSync(mainDbPath, backupPath);

  // Record backup
  const insertBackup = db.prepare(`
    INSERT INTO backups (file_name, file_path, backup_type, created_at, kept_flag, retention_status)
    VALUES (?, ?, ?, ?, 0, 'active')
  `);
  const res = insertBackup.run(filename, backupPath, type, timestamp);

  logAudit(
    userId,
    'backup created',
    'backups',
    res.lastInsertRowid as number,
    null,
    { file_name: filename, type },
    `Local ${type} backup successfully written to daily directory.`
  );

  return filename;
}

// Daily automated cron-like backup routine
function checkRetentionStatusAndDailyBackup() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

  // 1. Check if we need to do today's schedule (23:55 - 23:59)
  const getBackupDay = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'last_backup_date'");
  const lastBackupObj = getBackupDay.get() as { setting_value: string } | undefined;
  const lastBackupDate = lastBackupObj ? lastBackupObj.setting_value : '';

  const hours = now.getHours();
  const minutes = now.getMinutes();

  const isBackupTimeWindow = (hours === 23 && minutes >= 55);

  if (isBackupTimeWindow && lastBackupDate !== todayStr) {
    // Run backup
    console.log(`[Scheduled Backup] Running automatic backup for date: ${todayStr}`);
    executeBackup('auto', null);
    
    // Update setting
    const updateSetting = db.prepare("UPDATE settings SET setting_value = ?, updated_at = ? WHERE setting_key = 'last_backup_date'");
    updateSetting.run(todayStr, new Date().toISOString());
  }

  // 2. Check for retention of daily backups older than 30 days
  // We identify existing active daily backups that are > 30 days old.
  try {
    const listBackups = db.prepare(`
      SELECT * FROM backups 
      WHERE retention_status = 'active'
    `);
    const activeBackups = listBackups.all() as any[];
    
    let hasOlderThan30Days = false;
    activeBackups.forEach(b => {
      const bDate = new Date(b.created_at);
      const diffTime = Math.abs(now.getTime() - bDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 30) {
        hasOlderThan30Days = true;
      }
    });

    if (hasOlderThan30Days) {
      db.prepare("UPDATE settings SET setting_value = '1', updated_at = ? WHERE setting_key = 'needs_retention_prompt'")
        .run(new Date().toISOString());
    } else {
      db.prepare("UPDATE settings SET setting_value = '0', updated_at = ? WHERE setting_key = 'needs_retention_prompt'")
        .run(new Date().toISOString());
    }
  } catch (err) {
    console.error('Error checking retention alerts:', err);
  }
}

// 3. Run startup missed backup recovery check
(function runStartupBackupRecovery() {
  console.log('[System Recovery] Running startup backup audit...');
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const getBackupDay = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'last_backup_date'");
  const lastBackupObj = getBackupDay.get() as { setting_value: string } | undefined;
  const lastBackupDate = lastBackupObj ? lastBackupObj.setting_value : '';

  // If last backup date is empty, seed it with yesterday so we run one on startup immediately!
  if (!lastBackupDate) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    db.prepare("UPDATE settings SET setting_value = ?, updated_at = ? WHERE setting_key = 'last_backup_date'")
      .run(yesterdayStr, new Date().toISOString());
    
    console.log('[System Recovery] Seeded last_backup_date. Triggering startup backup recovery first...');
    executeBackup('auto', null);
    db.prepare("UPDATE settings SET setting_value = ?, updated_at = ? WHERE setting_key = 'last_backup_date'")
      .run(todayStr, new Date().toISOString());
  } else {
    // Check if yesterday or previous days was missed
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // If last backup is NOT yesterday AND last backup is NOT today, it means we definitely missed it
    if (lastBackupDate !== yesterdayStr && lastBackupDate !== todayStr) {
      console.log(`[System Recovery] Backups missed since ${lastBackupDate}! Triggering recovery backup...`);
      executeBackup('auto', null);
      db.prepare("UPDATE settings SET setting_value = ?, updated_at = ? WHERE setting_key = 'last_backup_date'")
        .run(todayStr, new Date().toISOString());
    }
  }
})();

// Start ticking checks every minute
setInterval(checkRetentionStatusAndDailyBackup, 60000);

// -------------------------------------------------------------------------
// EXPRESS SETUP
// -------------------------------------------------------------------------
const app = express();
const PORT = 3000;

app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup multer for manually uploading/referencing receipt photos inside 'uploads/receipts'
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads/receipts'));
  },
  filename: (req, file, cb) => {
    // Sanitize file names
    const suffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, suffix + path.extname(file.originalname));
  }
});
const uploader = multer({ storage: fileStorage });

// Session setup with database-retrieved timeout setting
const getTimeoutSetting = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'session_timeout'");
const timeoutResult = getTimeoutSetting.get() as { setting_value: string } | undefined;
const sessionMinutes = timeoutResult ? parseInt(timeoutResult.setting_value) || 15 : 15;

app.use(session({
  name: 'offline_inventory_sid',
  secret: 'ethiopian-retail-offline-system-super-secret-key-1982',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: sessionMinutes * 60 * 1000, // Dynamic session duration
    secure: false, // Default false to allow localhost HTTP, upgraded dynamically
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Dynamic cookie security adjustment for HTTPS/iframe and local environments
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.session && req.session.cookie) {
    const isSecure = req.secure || 
                   req.headers['x-forwarded-proto'] === 'https' || 
                   (req.get('host') && (req.get('host')!.includes('run.app') || req.get('host')!.includes('localto.net')));
    if (isSecure) {
      req.session.cookie.secure = true;
      req.session.cookie.sameSite = 'none';
    } else {
      req.session.cookie.secure = false;
      req.session.cookie.sameSite = 'lax';
    }
  }
  next();
});

// Extend Express Session definition
declare module 'express-session' {
  interface SessionData {
    userId: number;
    username: string;
    fullName: string;
    role: 'owner' | 'employee';
    permissions: Record<string, number>;
    lastActivity: number;
  }
}

// Inactivity Session Timeout and Session Refresh Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.session && req.session.userId) {
    // Fetch latest timeout from database to react dynamically to settings change
    const timeoutVal = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'session_timeout'").get() as { setting_value: string } | undefined;
    const currentTimeoutMinutes = timeoutVal ? parseInt(timeoutVal.setting_value) || 15 : 15;
    const maxIdleMs = currentTimeoutMinutes * 60 * 1000;

    const currentTime = Date.now();
    const lastActivity = req.session.lastActivity || currentTime;

    if (currentTime - lastActivity > maxIdleMs) {
      // Inactivity limit reached, destroy session
      req.session.destroy((err) => {
        if (err) console.error('Session clearance error:', err);
        return res.status(401).json({ error: 'Session expired due to inactivity. Please log in again.' });
      });
    } else {
      // Session active, update sliding window
      req.session.lastActivity = currentTime;
      // Also update cookie maxAge explicitly
      req.session.cookie.maxAge = maxIdleMs;
      // Explicitly save session to prevent asynchronous MemoryStore replication race conditions
      req.session.save((err) => {
        if (err) console.error('Session sliding window save error:', err);
        next();
      });
    }
  } else {
    next();
  }
});

// Serve frontend static files
app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// -------------------------------------------------------------------------
// AUTHENTICATION MIDDLEWARES AND PERMISSIONS
// -------------------------------------------------------------------------
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated. Please log in.' });
  }
  next();
}

function requirePermission(permissionKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated. Please log in.' });
    }

    if (req.session.role === 'owner') {
      return next(); // Owner has full authorization over everything
    }

    // Check user's specific perm flag in session state
    const permissions = req.session.permissions;
    if (permissions && permissions[permissionKey] === 1) {
      return next();
    }

    return res.status(403).json({ error: `Permission Denied: missing privilege '${permissionKey}'` });
  };
}

// -------------------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------------------

// 1. AUTH API
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const userStmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = userStmt.get(username) as any;

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    if (user.is_active === 0) {
      return res.status(403).json({ error: 'This account has been disabled.' });
    }

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Fetch user permissions
    const permStmt = db.prepare('SELECT * FROM user_permissions WHERE user_id = ?');
    const perms = permStmt.get(user.id) as any;

    // Login successful, build session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.fullName = user.full_name;
    req.session.role = user.role_type;
    req.session.lastActivity = Date.now();
    req.session.permissions = perms || {};

    // Update last login
    const updateLogin = db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?');
    const timestamp = new Date().toISOString();
    updateLogin.run(timestamp, user.id);

    // Write audit log
    logAudit(user.id, 'login', 'users', user.id, null, null, `User '${user.username}' successfully logged in.`);

    // Explicitly save the session to prevent asynchronous store write race conditions
    req.session.save((err) => {
      if (err) {
        console.error('Session save error on login:', err);
        return res.status(500).json({ error: 'Failed to establish security session.' });
      }
      return res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role_type: user.role_type,
          must_change_password: user.must_change_password,
          last_login_at: timestamp
        },
        permissions: perms || {}
      });
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', requireAuth, (req: Request, res: Response) => {
  const userId = req.session.userId;
  const username = req.session.username;
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to sign out session.' });
    }
    logAudit(userId, 'logout', 'users', userId, null, null, `User '${username}' logged out.`);
    res.clearCookie('offline_inventory_sid');
    return res.json({ success: true, message: 'Logged out successfully.' });
  });
});

app.get('/api/auth/session', (req: Request, res: Response) => {
  if (req.session && req.session.userId) {
    // Pull fresh permissions and details from database
    const user = db.prepare('SELECT id, username, full_name, role_type, is_active, must_change_password FROM users WHERE id = ?').get(req.session.userId) as any;
    if (!user || user.is_active === 0) {
      req.session.destroy(() => {});
      return res.status(401).json({ authenticated: false });
    }
    const perms = db.prepare('SELECT * FROM user_permissions WHERE user_id = ?').get(user.id) as any;
    
    // Update active permissions in session of user
    req.session.permissions = perms || {};
    
    req.session.save((err) => {
      if (err) console.error('Session save error on session enquiry:', err);
      return res.json({
        authenticated: true,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role_type: user.role_type,
          must_change_password: user.must_change_password
        },
        permissions: perms || {}
      });
    });
  } else {
    return res.json({ authenticated: false });
  }
});

// 2. DASHBOARD API
app.get('/api/dashboard/stats', requireAuth, requirePermission('can_view_dashboard'), (req: Request, res: Response) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0] + '%'; // match dates starting with YYYY-MM-DD

    // 1. Sales today
    const salesStmt = db.prepare("SELECT COUNT(*) as count, SUM(total_amount) as total_rev, SUM(total_profit) as total_prof FROM sales WHERE created_at LIKE ? AND status = 'completed'");
    const salesToday = salesStmt.get(todayStr) as any;

    // 2. Low stock alert counter
    // A product or variant is low stock if current inventory is <= threshold.
    // We sum up both products (without variants) and variant items that fall below threshold.
    // Unique check
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
      SELECT product_name, SUM(quantity) as total_qty 
      FROM sale_items 
      INNER JOIN sales ON sale_items.sale_id = sales.id
      WHERE sales.created_at LIKE ? AND sales.status = 'completed'
      GROUP BY product_id, variant_id
      ORDER BY total_qty DESC 
      LIMIT 1
    `);
    const topProduct = topProdStmt.get(todayStr) as any;

    // 4. Employee count (if >= 2, show top seller employee)
    const empCountStmt = db.prepare("SELECT COUNT(*) as count FROM users WHERE role_type = 'employee' AND is_active = 1");
    const empCount = (empCountStmt.get() as any).count;

    let topEmployee: any = null;
    if (empCount >= 2) {
      // Find top performing employee today
      const topEmpStmt = db.prepare(`
        SELECT users.full_name as name, COUNT(sales.id) as tx_count, SUM(sales.total_items) as items_sold, SUM(sales.total_amount) as revenue
        FROM sales
        INNER JOIN users ON sales.sold_by_user_id = users.id
        WHERE sales.created_at LIKE ? AND users.role_type = 'employee' AND sales.status = 'completed'
        GROUP BY sales.sold_by_user_id
        ORDER BY revenue DESC
        LIMIT 1
      `);
      topEmployee = topEmpStmt.get(todayStr) as any;
    }

    return res.json({
      total_sales_count: salesToday?.count || 0,
      total_revenue_today: salesToday?.total_rev || 0,
      total_profit_today: salesToday?.total_prof || 0,
      low_stock_count: totalLowStockCount,
      top_selling_product: topProduct ? `${topProduct.product_name} (${topProduct.total_qty} units)` : 'No sales today',
      employee_count: empCount,
      top_employee: topEmployee
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Urgent Low stock alerts notifications API endpoint
app.get('/api/alerts/low-stock', requireAuth, (req: Request, res: Response) => {
  try {
    // Select all products without variants below threshold
    // To make this fully solid, we calculate their total stock as the sum of batches minus quantity sold.
    // We can also simplify or read variant stocks directly.
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
        // Simple products stock calculations: we can also track stock on products table or sum variants
        // Let's query total stock of this simple product.
        // For simplicity inside our SQLite schema, we can store actual stock in products or query stock_batches - sold
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
});

// 3. CATEGORIES API
app.get('/api/categories', requireAuth, (req: Request, res: Response) => {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
    return res.json(categories);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', requireAuth, requirePermission('can_manage_categories'), (req: Request, res: Response) => {
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
});

app.put('/api/categories/:id', requireAuth, requirePermission('can_manage_categories'), (req: Request, res: Response) => {
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
});

// 4. PRODUCTS & VARIANTS & STOCK BATCHES API
app.get('/api/products', requireAuth, (req: Request, res: Response) => {
  try {
    // List all products with their categories
    const products = db.prepare(`
      SELECT products.*, categories.name as category_name
      FROM products
      LEFT JOIN categories ON products.category_id = categories.id
      ORDER BY products.name ASC
    `).all() as any[];

    // Map variant stocks and expiry alerts onto the items
    for (const p of products) {
      if (p.has_variants) {
        const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ?').all(p.id) as any[];
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
});

app.post('/api/products', requireAuth, requirePermission('can_manage_products'), (req: Request, res: Response) => {
  const {
    category_id, brand, name, product_type, description, unit_type,
    has_variants, expiry_required, low_stock_threshold, buy_price,
    profit_percentage, variants
  } = req.body;

  if (!name || !category_id) {
    return res.status(400).json({ error: 'Product name and category are required.' });
  }

  try {
    const timestamp = new Date().toISOString();
    // Auto generate UUID SKU and dynamic simple Display ID
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const sku = `PROD-${randomHex}`;
    const displayId = `ID-${Math.floor(1000 + Math.random() * 9000)}`;

    const pPct = parseFloat(profit_percentage) || 10;
    const bPrice = parseFloat(buy_price) || 0;
    // Auto-calculate sell price: sell = buy + profit
    const sPrice = parseFloat((bPrice * (1 + pPct / 100)).toFixed(2));

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

    // Handle Variants if marked
    if (has_variants && Array.isArray(variants)) {
      const insertVariant = db.prepare(`
        INSERT INTO product_variants (
          product_id, sku_variant, variant_name, variant_label_1, variant_label_2, variant_label_3,
          description, stock_quantity, buy_price, sell_price, low_stock_threshold, expiry_date,
          is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 1, ?, ?)
      `);

      variants.forEach((v: any) => {
        const vRandomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
        const vSku = `VAR-${vRandomHex}`;
        const vName = v.variant_name || `${v.label1 || ''} / ${v.label2 || ''}`;
        
        const vPct = parseFloat(v.profit_percentage) || pPct;
        const vBPrice = parseFloat(v.buy_price) || bPrice;
        const vSPrice = parseFloat((vBPrice * (1 + vPct / 100)).toFixed(2));

        insertVariant.run(
          productId,
          vSku,
          vName,
          v.label1 || '',
          v.label2 || '',
          v.label3 || '',
          v.description || '',
          vBPrice,
          vSPrice,
          parseInt(v.low_stock_threshold) || parseInt(low_stock_threshold) || 0,
          v.expiry_date || '',
          timestamp,
          timestamp
        );
      });
    }

    logAudit(req.session.userId!, 'product created', 'products', productId, null, { name, sku, displayId }, `Product '${name}' created.`);

    return res.json({ success: true, productId, product_id_display: displayId });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', requireAuth, requirePermission('can_manage_products'), (req: Request, res: Response) => {
  const prodId = parseInt(req.params.id);
  const {
    category_id, brand, name, product_type, description, unit_type,
    expiry_required, low_stock_threshold, is_active, buy_price, sell_price, profit_percentage
  } = req.body;

  try {
    const beforeObj = db.prepare('SELECT * FROM products WHERE id = ?').get(prodId) as any;
    if (!beforeObj) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const timestamp = new Date().toISOString();

    // Verify if edit price action is allowed to change pricing
    const pricePermission = req.session.role === 'owner' || req.session.permissions?.can_edit_prices === 1;

    let bPrice = beforeObj.buy_price;
    let sPrice = beforeObj.sell_price;
    let pPct = beforeObj.profit_percentage;

    if (pricePermission) {
      if (buy_price !== undefined) bPrice = parseFloat(buy_price);
      if (profit_percentage !== undefined) pPct = parseFloat(profit_percentage);
      if (sell_price !== undefined) {
        sPrice = parseFloat(sell_price);
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

    // Audit price changes if changes made
    if (beforeObj.sell_price !== sPrice || beforeObj.buy_price !== bPrice) {
      logAudit(
        req.session.userId!,
        'price changes',
        'products',
        prodId,
        { buy_price: beforeObj.buy_price, sell_price: beforeObj.sell_price },
        { buy_price: bPrice, sell_price: sPrice },
        `Pricing updated for product: ${name}`
      );
    }

    logAudit(req.session.userId!, 'product edited', 'products', prodId, beforeObj, afterObj, `Product '${name}' details modified.`);

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Bulk Stock Addition endpoint
app.post('/api/stock/add', requireAuth, requirePermission('can_manage_stock'), (req: Request, res: Response) => {
  const { product_id, variant_id, quantity, buy_price, expiry_date, reason } = req.body;
  if (!product_id || !quantity) {
    return res.status(400).json({ error: 'Product and quantity are required.' });
  }

  try {
    const timestamp = new Date().toISOString();
    const qty = parseInt(quantity);
    const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id) as any;
    if (!prod) return res.status(404).json({ error: 'Product not found.' });

    let calculatedSellPrice = prod.sell_price;
    let actBuyPrice = parseFloat(buy_price) || prod.buy_price;

    if (variant_id) {
      const v = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(variant_id) as any;
      if (!v) return res.status(404).json({ error: 'Variant not found.' });
      actBuyPrice = parseFloat(buy_price) || v.buy_price;
      calculatedSellPrice = parseFloat((actBuyPrice * (1 + prod.profit_percentage / 100)).toFixed(2));

      // 1. Insert Stock Batch Record
      const insertBatch = db.prepare(`
        INSERT INTO stock_batches (product_id, variant_id, quantity_added, buy_price, sell_price, expiry_date, reason, added_by_user_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertBatch.run(product_id, variant_id, qty, actBuyPrice, calculatedSellPrice, expiry_date || v.expiry_date, reason || 'Restock', req.session.userId!, timestamp);

      // 2. Increment stock in product variant table
      const updateVarStock = db.prepare(`
        UPDATE product_variants 
        SET stock_quantity = stock_quantity + ?, buy_price = ?, sell_price = ?, expiry_date = ?, updated_at = ?
        WHERE id = ?
      `);
      updateVarStock.run(qty, actBuyPrice, calculatedSellPrice, expiry_date || v.expiry_date || '', timestamp, variant_id);

    } else {
      calculatedSellPrice = parseFloat((actBuyPrice * (1 + prod.profit_percentage / 100)).toFixed(2));

      // 1. Insert Stock Batch Record
      const insertBatch = db.prepare(`
        INSERT INTO stock_batches (product_id, variant_id, quantity_added, buy_price, sell_price, expiry_date, reason, added_by_user_id, created_at)
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertBatch.run(product_id, qty, actBuyPrice, calculatedSellPrice, expiry_date, reason || 'Restock', req.session.userId!, timestamp);

      // 2. Refresh base prices in product table dynamically
      const updateProdStock = db.prepare(`
        UPDATE products 
        SET buy_price = ?, sell_price = ?, updated_at = ?
        WHERE id = ?
      `);
      updateProdStock.run(actBuyPrice, calculatedSellPrice, timestamp, product_id);
    }

    logAudit(
      req.session.userId!,
      'stock added',
      'products',
      product_id,
      null,
      { quantity_added: qty, buy_price: actBuyPrice },
      `Added ${qty} units of stock to product (Variant ID: ${variant_id || 'None'}).`
    );

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Manual Stock Adjustment API (Wastage / Expiry / Damaged Writeoffs / Corrective settings)
app.post('/api/stock/adjust', requireAuth, requirePermission('can_adjust_stock'), (req: Request, res: Response) => {
  const { product_id, variant_id, adjustment_type, quantity, reason } = req.body;
  if (!product_id || !adjustment_type || !quantity) {
    return res.status(400).json({ error: 'Missing mandatory fields' });
  }

  try {
    const timestamp = new Date().toISOString();
    const qtyChange = parseInt(quantity); // Positive or negative
    
    // Insert Inventory Adjustments Record
    const insertAdj = db.prepare(`
      INSERT INTO inventory_adjustments (product_id, variant_id, adjustment_type, quantity_changed, reason, adjusted_by_user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const stmt = insertAdj.run(product_id, variant_id || null, adjustment_type, qtyChange, reason || '', req.session.userId!, timestamp);

    // If product has variant, adjust variant stock
    if (variant_id) {
      db.prepare(`
        UPDATE product_variants 
        SET stock_quantity = stock_quantity + ?, updated_at = ? 
        WHERE id = ?
      `).run(qtyChange, timestamp, variant_id);
    } else {
      // Simple product stock adjust via stock_batches with matching negative entry
      const prod = db.prepare('SELECT buy_price, sell_price FROM products WHERE id = ?').get(product_id) as any;
      db.prepare(`
        INSERT INTO stock_batches (product_id, variant_id, quantity_added, buy_price, sell_price, reason, added_by_user_id, created_at)
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?)
      `).run(product_id, qtyChange, prod?.buy_price || 0, prod?.sell_price || 0, `Adjustment: ${adjustment_type} - ${reason}`, req.session.userId!, timestamp);
    }

    logAudit(
      req.session.userId!,
      adjustment_type === 'damage' ? 'damaged goods write-off' : adjustment_type === 'expiry' ? 'expired goods write-off' : 'stock adjusted',
      'products',
      product_id,
      null,
      { quantity_changed: qtyChange, adjustment_type },
      `Stock adjusted: ${qtyChange} units marked as ${adjustment_type}. Reason: ${reason}`
    );

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. SALES (POSCheckout) API
app.post('/api/sales/checkout', requireAuth, requirePermission('can_sell'), uploader.single('receipt_image'), (req: Request, res: Response) => {
  const { cart: cartJSON, payment_type, transaction_reference, discount_amount } = req.body;

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
        return res.status(400).json({ error: 'Quantity must be positive' });
      }

      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(pid) as any;
      if (!prod) {
        return res.status(404).json({ error: `Product with ID ${pid} not found.` });
      }

      let buyPrice = prod.buy_price;
      let sellPrice = prod.sell_price;
      let variantName: string | null = null;

      if (vid) {
        const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(vid) as any;
        if (!variant) {
          return res.status(404).json({ error: `Variant ID ${vid} for product ${prod.name} not found.` });
        }
        if (variant.stock_quantity < qtyRequested) {
          return res.status(400).json({ error: `Insufficient stock for SKU ${variant.sku_variant} (${prod.name} - ${variant.variant_name}). Available: ${variant.stock_quantity}, Requested: ${qtyRequested}` });
        }
        buyPrice = variant.buy_price;
        sellPrice = variant.sell_price;
        variantName = variant.variant_name;
      } else {
        // Query simple product stock sum of batches minus sold items to confirm availability
        const added = db.prepare('SELECT SUM(quantity_added) as qty FROM stock_batches WHERE product_id = ?').get(pid) as any;
        const sold = db.prepare('SELECT SUM(quantity) as qty FROM sale_items WHERE product_id = ?').get(pid) as any;
        const currentStock = (added?.qty || 0) - (sold?.qty || 0);

        if (currentStock < qtyRequested) {
          return res.status(400).json({ error: `Insufficient stock for product ${prod.name}. Available: ${currentStock}, Requested: ${qtyRequested}` });
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
    // Adjust profit to subtract the discount
    const finalProfit = totalProfit - disc;

    // Generate unique sale number e.g. SALE-20260613-XXXX (random hex)
    const dStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const randId = Math.random().toString(36).substring(2, 6).toUpperCase();
    const saleNumber = `SALE-${dStr}-${randId}`;

    // 1. Save Sale record
    const insertSale = db.prepare(`
      INSERT INTO sales (sale_number, sold_by_user_id, payment_type, total_items, subtotal, discount_amount, total_amount, total_cost, total_profit, transaction_reference, receipt_file_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertSale.run(
      saleNumber,
      req.session.userId!,
      payment_type, // 'cash' or 'mobile_transfer'
      totalItems,
      subtotal,
      disc,
      finalAmount,
      totalCost,
      finalProfit,
      transaction_reference || null,
      diskFilename,
      timestamp
    );

    const saleId = result.lastInsertRowid as number;

    // 2. Insert items and decrement stock physical pools
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

      // Decrement inventory stock on product_variants
      if (item.variant_id) {
        db.prepare(`
          UPDATE product_variants 
          SET stock_quantity = stock_quantity - ?, updated_at = ?
          WHERE id = ?
        `).run(item.quantity, timestamp, item.variant_id);
      } else {
        // For simple products, we just insert a batch record with a negative offset quantity so the total pool remains mathematically accurate!
        db.prepare(`
          INSERT INTO stock_batches (product_id, variant_id, quantity_added, buy_price, sell_price, reason, added_by_user_id, created_at)
          VALUES (?, NULL, ?, ?, ?, 'Sale checkout', ?, ?)
        `).run(item.product_id, -item.quantity, item.buy_price, item.sell_price, req.session.userId!, timestamp);
      }
    }

    logAudit(
      req.session.userId!,
      'sale created',
      'sales',
      saleId,
      null,
      { sale_number: saleNumber, total_amount: finalAmount },
      `Created sale ${saleNumber}. Payment: ${payment_type}. Number of items: ${totalItems}.`
    );

    return res.json({ success: true, saleId, sale_number: saleNumber });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. RETURNS API
app.get('/api/returns', requireAuth, requirePermission('can_view_dashboard'), (req: Request, res: Response) => {
  try {
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
});

app.post('/api/returns/request', requireAuth, requirePermission('can_create_returns'), uploader.single('receipt_image'), (req: Request, res: Response) => {
  const { sale_id, sale_item_id, reason, refund_method, refund_amount, transaction_reference } = req.body;
  if (!sale_id || !reason || !refund_amount) {
    return res.status(400).json({ error: 'Sale, reason, and refund amount are required.' });
  }

  try {
    const timestamp = new Date().toISOString();
    const filename = req.file ? req.file.filename : null;

    const insert = db.prepare(`
      INSERT INTO return_requests (sale_id, sale_item_id, requested_by_user_id, reason, refund_method, refund_amount, transaction_reference, receipt_file_name, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `);
    const resId = insert.run(
      sale_id,
      sale_item_id ? parseInt(sale_item_id) : null,
      req.session.userId!,
      reason,
      refund_method,
      parseFloat(refund_amount),
      transaction_reference || null,
      filename,
      timestamp
    );

    const retId = resId.lastInsertRowid as number;

    logAudit(
      req.session.userId!,
      'return requested',
      'return_requests',
      retId,
      null,
      { refund_amount },
      `Created return request ID ${retId} for Sale ID ${sale_id}. Status: pending.`
    );

    return res.json({ success: true, returnId: retId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/returns/approve/:id', requireAuth, requirePermission('can_approve_returns'), (req: Request, res: Response) => {
  const retId = parseInt(req.params.id);
  const { decision } = req.body; // 'approved' or 'rejected'

  if (decision !== 'approved' && decision !== 'rejected') {
    return res.status(400).json({ error: 'Decision must be approved or rejected.' });
  }

  try {
    const ret = db.prepare('SELECT * FROM return_requests WHERE id = ?').get(retId) as any;
    if (!ret) return res.status(404).json({ error: 'Return request not found.' });
    if (ret.status !== 'pending') return res.status(400).json({ error: 'This return is already processed.' });

    const timestamp = new Date().toISOString();

    if (decision === 'approved') {
      // 1. Set return as approved
      db.prepare('UPDATE return_requests SET status = "approved", approved_by_user_id = ?, approved_at = ? WHERE id = ?')
        .run(req.session.userId!, timestamp, retId);

      // 2. Replenish stock quantities back into the database physical pools
      if (ret.sale_item_id) {
        const item = db.prepare('SELECT * FROM sale_items WHERE id = ?').get(ret.sale_item_id) as any;
        if (item) {
          if (item.variant_id) {
            db.prepare('UPDATE product_variants SET stock_quantity = stock_quantity + ?, updated_at = ? WHERE id = ?')
              .run(item.quantity, timestamp, item.variant_id);
          } else {
            db.prepare('INSERT INTO stock_batches (product_id, variant_id, quantity_added, buy_price, sell_price, reason, added_by_user_id, created_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)')
              .run(item.product_id, item.quantity, item.buy_price, item.sell_price, `Customer return approved (Request ID: ${retId})`, req.session.userId!, timestamp);
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
              .run(itm.product_id, itm.quantity, itm.buy_price, itm.sell_price, `Customer return approved: whole purchase (Request ID: ${retId})`, req.session.userId!, timestamp);
          }
        });
      }

      // Mark original Sale as refunded or partially refunded
      db.prepare('UPDATE sales SET status = "refunded", total_profit = total_profit - ? WHERE id = ?')
        .run(ret.refund_amount, ret.sale_id);

    } else {
      // Set return as rejected
      db.prepare('UPDATE return_requests SET status = "rejected", approved_by_user_id = ?, approved_at = ? WHERE id = ?')
        .run(req.session.userId!, timestamp, retId);
    }

    logAudit(
      req.session.userId!,
      `return ${decision}`,
      'return_requests',
      retId,
      { status: 'pending' },
      { status: decision },
      `Return request ID ${retId} was ${decision} by owner.`
    );

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 7. EMPLOYEES CONTROL API
app.get('/api/employees', requireAuth, requirePermission('can_manage_employees'), (req: Request, res: Response) => {
  try {
    const list = db.prepare(`
      SELECT users.id, users.full_name, users.username, users.role_type, users.is_active, users.created_at, users.last_login_at,
             user_permissions.*
      FROM users
      LEFT JOIN user_permissions ON users.id = user_permissions.user_id
      WHERE users.role_type = 'employee'
      ORDER BY users.full_name ASC
    `).all();
    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees', requireAuth, requirePermission('can_manage_employees'), (req: Request, res: Response) => {
  const { full_name, username, password, permissions } = req.body;
  if (!full_name || !username || !password) {
    return res.status(400).json({ error: 'Employee details missing' });
  }

  try {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    const timestamp = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO users (full_name, username, password_hash, role_type, is_active, must_change_password, created_at, updated_at)
      VALUES (?, ?, ?, 'employee', 1, 1, ?, ?)
    `).run(full_name, username, hash, timestamp, timestamp);

    const empId = result.lastInsertRowid as number;

    // Create default explicit user permissions
    const p = permissions || {};
    db.prepare(`
      INSERT INTO user_permissions (
        user_id, can_view_dashboard, can_manage_products, can_manage_categories,
        can_manage_stock, can_sell, can_create_returns, can_approve_returns,
        can_view_reports, can_manage_employees, can_view_audit_logs,
        can_manage_backups, can_edit_prices, can_adjust_stock, can_manage_settings
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      empId,
      p.can_view_dashboard ? 1 : 0,
      p.can_manage_products ? 1 : 0,
      p.can_manage_categories ? 1 : 0,
      p.can_manage_stock ? 1 : 0,
      p.can_sell ? 1 : 0,
      p.can_create_returns ? 1 : 0,
      p.can_approve_returns ? 1 : 0,
      p.can_view_reports ? 1 : 0,
      p.can_manage_employees ? 1 : 0,
      p.can_view_audit_logs ? 1 : 0,
      p.can_manage_backups ? 1 : 0,
      p.can_edit_prices ? 1 : 0,
      p.can_adjust_stock ? 1 : 0,
      p.can_manage_settings ? 1 : 0
    );

    logAudit(req.session.userId!, 'employee created', 'users', empId, null, { username, full_name }, `Created new employee account: ${username}`);

    return res.json({ success: true, employeeId: empId });
  } catch (err: any) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Username already in use.' });
    }
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/employees/:id', requireAuth, requirePermission('can_manage_employees'), (req: Request, res: Response) => {
  const empId = parseInt(req.params.id);
  const { full_name, username, is_active, permissions } = req.body;

  try {
    const beforeUser = db.prepare('SELECT * FROM users WHERE id = ?').get(empId) as any;
    if (!beforeUser) return res.status(404).json({ error: 'Employee not found.' });

    const timestamp = new Date().toISOString();
    db.prepare(`
      UPDATE users 
      SET full_name = ?, username = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `).run(full_name, username, is_active !== undefined ? is_active : 1, timestamp, empId);

    if (permissions) {
      const p = permissions;
      db.prepare(`
        UPDATE user_permissions 
        SET can_view_dashboard = ?, can_manage_products = ?, can_manage_categories = ?, can_manage_stock = ?,
            can_sell = ?, can_create_returns = ?, can_approve_returns = ?, can_view_reports = ?, can_manage_employees = ?,
            can_view_audit_logs = ?, can_manage_backups = ?, can_edit_prices = ?, can_adjust_stock = ?, can_manage_settings = ?
        WHERE user_id = ?
      `).run(
        p.can_view_dashboard ? 1 : 0,
        p.can_manage_products ? 1 : 0,
        p.can_manage_categories ? 1 : 0,
        p.can_manage_stock ? 1 : 0,
        p.can_sell ? 1 : 0,
        p.can_create_returns ? 1 : 0,
        p.can_approve_returns ? 1 : 0,
        p.can_view_reports ? 1 : 0,
        p.can_manage_employees ? 1 : 0,
        p.can_view_audit_logs ? 1 : 0,
        p.can_manage_backups ? 1 : 0,
        p.can_edit_prices ? 1 : 0,
        p.can_adjust_stock ? 1 : 0,
        p.can_manage_settings ? 1 : 0,
        empId
      );
      
      logAudit(req.session.userId!, 'permission changes', 'user_permissions', empId, null, null, `Updated permission authorizations for employee: ${username}`);
    }

    logAudit(req.session.userId!, 'employee edited', 'users', empId, beforeUser, { full_name, username, is_active }, `Modified details of employee: ${username}`);

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees/reset-password/:id', requireAuth, requirePermission('can_manage_employees'), (req: Request, res: Response) => {
  const empId = parseInt(req.params.id);
  const { new_password } = req.body;
  if (!new_password) return res.status(400).json({ error: 'Password cannot be empty' });

  try {
    const emp = db.prepare('SELECT username FROM users WHERE id = ?').get(empId) as any;
    if (!emp) return res.status(404).json({ error: 'Employee not found.' });

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(new_password, salt);
    const timestamp = new Date().toISOString();

    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?').run(hash, timestamp, empId);

    logAudit(req.session.userId!, 'employee reset', 'users', empId, null, null, `Authorized owner password reset for employee: ${emp.username}`);

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/employees/:id', requireAuth, requirePermission('can_manage_employees'), (req: Request, res: Response) => {
  const empId = parseInt(req.params.id);

  try {
    const emp = db.prepare('SELECT username FROM users WHERE id = ?').get(empId) as any;
    if (!emp) return res.status(404).json({ error: 'Employee not found.' });

    db.prepare('DELETE FROM users WHERE id = ?').run(empId);

    logAudit(req.session.userId!, 'employee deleted', 'users', empId, { username: emp.username }, null, `Deleted employee user: ${emp.username}`);

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 8. REPORTS GENERATION API
app.get('/api/reports/query', requireAuth, requirePermission('can_view_reports'), (req: Request, res: Response) => {
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
        
        const sumProfit = salesData.reduce((acc, s) => acc + s.total_profit, 0);
        summary = {
          total_revenue: salesData.reduce((acc, s) => acc + s.total_amount, 0),
          total_cost: salesData.reduce((acc, s) => acc + s.total_cost, 0),
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

        summary = {
          total_revenue: salesData.reduce((acc, s) => acc + s.total_amount, 0),
          total_cost: salesData.reduce((acc, s) => acc + s.total_cost, 0),
          total_profit: salesData.reduce((acc, s) => acc + s.total_profit, 0)
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

        summary = {
          total_revenue: salesData.reduce((acc, s) => acc + s.total_amount, 0),
          total_cost: salesData.reduce((acc, s) => acc + s.total_cost, 0),
          total_profit: salesData.reduce((acc, s) => acc + s.total_profit, 0)
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

        summary = {
          total_revenue: salesData.reduce((acc, s) => acc + s.total_amount, 0),
          total_cost: salesData.reduce((acc, s) => acc + s.total_cost, 0),
          total_profit: salesData.reduce((acc, s) => acc + s.total_profit, 0)
        };
        break;
      }
      case 'top_selling': {
        salesData = db.prepare(`
          SELECT product_name, variant_name, sku, SUM(quantity) as total_units, SUM(line_total) as total_revenue, SUM(line_profit) as total_profit
          FROM sale_items
          INNER JOIN sales ON sale_items.sale_id = sales.id
          WHERE sales.status = 'completed'
          GROUP BY product_id, variant_id
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
});

// 9. AUDIT LOGS SEARCH API
app.get('/api/audit-logs', requireAuth, requirePermission('can_view_audit_logs'), (req: Request, res: Response) => {
  try {
    const logs = db.prepare(`
      SELECT audit_logs.*, users.username as actor_name
      FROM audit_logs
      LEFT JOIN users ON audit_logs.user_id = users.id
      ORDER BY audit_logs.created_at DESC
      LIMIT 250
    `).all();
    return res.json(logs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 10. BACKUPS API
app.get('/api/backups', requireAuth, requirePermission('can_manage_backups'), (req: Request, res: Response) => {
  try {
    const list = db.prepare('SELECT * FROM backups ORDER BY created_at DESC').all();
    // Also include prompt status
    const promptStatus = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'needs_retention_prompt'").get() as { setting_value: string } | undefined;
    
    return res.json({
      backups: list,
      needs_retention_prompt: promptStatus?.setting_value === '1'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Create manual backup API
app.post('/api/backups/create', requireAuth, requirePermission('can_manage_backups'), (req: Request, res: Response) => {
  try {
    const filename = executeBackup('manual', req.session.userId!);
    return res.json({ success: true, filename });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Manage 30 Day Backup Retention Prompt API
app.post('/api/backups/retention-decision', requireAuth, requirePermission('can_manage_backups'), (req: Request, res: Response) => {
  const { decision } = req.body; // 'keep' or 'delete'

  if (decision !== 'keep' && decision !== 'delete') {
    return res.status(400).json({ error: 'Decision must be either keep or delete' });
  }

  try {
    const now = new Date();
    // Find daily backups older than 30 days
    const activeBackups = db.prepare("SELECT * FROM backups WHERE retention_status = 'active'").all() as any[];
    
    let processedCount = 0;

    activeBackups.forEach(b => {
      const bDate = new Date(b.created_at);
      const diffTime = Math.abs(now.getTime() - bDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 30) {
        processedCount++;
        if (decision === 'keep') {
          // Format backup with day-month-year in filename
          const day = String(bDate.getDate()).padStart(2, '0');
          const month = String(bDate.getMonth() + 1).padStart(2, '0');
          const year = bDate.getFullYear();
          const formatArchiveName = `archive_${day}-${month}-${year}_${b.file_name.split('backup_')[1] || b.id + '.db'}`;
          
          const srcPath = b.file_path;
          const destPath = path.join(process.cwd(), 'backups/archive', formatArchiveName);

          if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
            fs.unlinkSync(srcPath); // remove daily source
          }

          db.prepare("UPDATE backups SET retention_status = 'archived', file_name = ?, file_path = ?, archive_path = ?, kept_flag = 1 WHERE id = ?")
            .run(formatArchiveName, destPath, destPath, b.id);

        } else if (decision === 'delete') {
          // Delete physical file from disk
          if (fs.existsSync(b.file_path)) {
            fs.unlinkSync(b.file_path);
          }
          db.prepare("UPDATE backups SET retention_status = 'deleted' WHERE id = ?").run(b.id);
        }
      }
    });

    // Reset retention settings flag
    db.prepare("UPDATE settings SET setting_value = '0', updated_at = ? WHERE setting_key = 'needs_retention_prompt'")
      .run(new Date().toISOString());

    logAudit(
      req.session.userId!,
      'backups adjusted',
      'backups',
      null,
      null,
      { decision, count_processed: processedCount },
      `Retention prompt handled: ${decision === 'keep' ? 'Archived' : 'Deleted'} ${processedCount} backups older than 30 days.`
    );

    return res.json({ success: true, processed_count: processedCount });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 11. GENERAL SETTINGS API
app.get('/api/settings', requireAuth, (req: Request, res: Response) => {
  try {
    const list = db.prepare('SELECT * FROM settings').all();
    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/update', requireAuth, requirePermission('can_manage_settings'), (req: Request, res: Response) => {
  const { shop_name, session_timeout } = req.body;

  try {
    const timestamp = new Date().toISOString();
    const update = db.prepare("UPDATE settings SET setting_value = ?, updated_at = ? WHERE setting_key = ?");
    
    if (shop_name !== undefined) update.run(shop_name, timestamp, 'shop_name');
    if (session_timeout !== undefined) {
      update.run(String(session_timeout), timestamp, 'session_timeout');
    }

    logAudit(req.session.userId!, 'settings updated', 'settings', null, null, { shop_name, session_timeout }, 'General business settings modified.');

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Modify user's own profile credentials
app.post('/api/profile/update', requireAuth, (req: Request, res: Response) => {
  const { full_name, username, password } = req.body;
  const userId = req.session.userId!;

  try {
    const beforeUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    const timestamp = new Date().toISOString();

    let updateQuery = 'UPDATE users SET full_name = ?, username = ?, updated_at = ?';
    const params = [full_name || beforeUser.full_name, username || beforeUser.username, timestamp];

    if (password) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      updateQuery += ', password_hash = ?, must_change_password = 0';
      params.push(hash);
    }

    updateQuery += ' WHERE id = ?';
    params.push(userId);

    db.prepare(updateQuery).run(...params);

    // Update active user state inside context
    req.session.fullName = full_name || beforeUser.full_name;
    req.session.username = username || beforeUser.username;

    logAudit(userId, 'profile updated', 'users', userId, beforeUser, { full_name, username }, 'User modified their own login credentials.');

    req.session.save((err) => {
      if (err) {
        console.error('Session save error on profile update:', err);
        return res.status(500).json({ error: 'Failed to update active session.' });
      }
      return res.json({ success: true });
    });
  } catch (err: any) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }
    return res.status(500).json({ error: err.message });
  }
});

// Simple dynamic search for POS endpoint
app.get('/api/pos/search', requireAuth, (req: Request, res: Response) => {
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
      // Structured metadata and description keyword text search
      sql += ' AND (p.name LIKE ? OR p.brand LIKE ? OR p.product_type LIKE ? OR p.sku LIKE ? OR p.product_id_display LIKE ? OR p.description LIKE ?)';
      const term = `%${query}%`;
      params.push(term, term, term, term, term, term);
    }

    // Rank products inside selected category by most sold items first
    // Sum quantity inside sale_items for each item and order descending
    sql += `
      ORDER BY (
        SELECT IFNULL(SUM(si.quantity), 0) FROM sale_items si
        INNER JOIN sales s ON si.sale_id = s.id
        WHERE si.product_id = p.id AND s.status = 'completed'
      ) DESC, p.name ASC
    `;

    const products = db.prepare(sql).all(...params) as any[];

    // Extract variants
    for (const p of products) {
      const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1').all(p.id) as any[];
      p.variants = variants;
      if (p.has_variants) {
        p.stock = variants.reduce((acc, v) => acc + (v.stock_quantity || 0), 0);
      } else {
        const added = db.prepare('SELECT SUM(quantity_added) as qty FROM stock_batches WHERE product_id = ?').get(p.id) as any;
        const sold = db.prepare('SELECT SUM(quantity) as qty FROM sale_items WHERE product_id = ?').get(p.id) as any;
        p.stock = (added?.qty || 0) - (sold?.qty || 0);
      }
    }

    return res.json(products);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Single fallback wildcard route to send index.html
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'public/index.html'));
});

// Bind server launch
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Live on local port http://localhost:${PORT}`);
});
