import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, logAudit } from '../database/db.ts';

export function login(req: Request, res: Response) {
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

    // Get session timeout dynamically
    const timeoutVal = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'session_timeout'").get() as { setting_value: string } | undefined;
    const sessionTimeoutMinutes = timeoutVal ? parseInt(timeoutVal.setting_value) || 15 : 15;

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
        permissions: perms || {},
        sessionTimeoutMinutes
      });
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export function logout(req: Request, res: Response) {
  const userId = req.session.userId;
  const username = req.session.username;
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to sign out session.' });
    }
    logAudit(userId || null, 'logout', 'users', userId || null, null, null, `User '${username}' logged out.`);
    res.clearCookie('offline_inventory_sid');
    return res.json({ success: true, message: 'Logged out successfully.' });
  });
}

export function getSession(req: Request, res: Response) {
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
    
    // Get session timeout dynamically
    const timeoutVal = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'session_timeout'").get() as { setting_value: string } | undefined;
    const sessionTimeoutMinutes = timeoutVal ? parseInt(timeoutVal.setting_value) || 15 : 15;

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
        permissions: perms || {},
        sessionTimeoutMinutes
      });
    });
  } else {
    return res.json({ authenticated: false });
  }
}

export function activeInteraction(req: Request, res: Response) {
  return res.json({ success: true });
}

export function changeForcedPassword(req: Request, res: Response) {
  const { password, confirmPassword } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  if (!password || !confirmPassword) {
    return res.status(400).json({ error: 'Password and confirmation are required.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  if (password.toLowerCase() === 'password') {
    return res.status(400).json({ error: 'You cannot use the default password.' });
  }

  try {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    const timestamp = new Date().toISOString();

    const beforeUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!beforeUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?')
      .run(hash, timestamp, userId);

    logAudit(
      userId,
      'password changed',
      'users',
      userId,
      { must_change_password: beforeUser.must_change_password },
      { must_change_password: 0 },
      `User '${beforeUser.username}' successfully changed their password on first login.`
    );

    return res.json({ success: true, message: 'Password has been set successfully. Welcome inside!' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
