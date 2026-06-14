import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, logAudit } from '../database/db.ts';
import { validatePasswordStrength } from '../utils/password.ts';

export function getSettings(req: Request, res: Response) {
  try {
    const list = db.prepare('SELECT * FROM settings').all();
    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

const updateSettingsTransaction = db.transaction((data: any) => {
  const { shop_name, session_timeout, userId, timestamp } = data;
  const update = db.prepare("UPDATE settings SET setting_value = ?, updated_at = ? WHERE setting_key = ?");
  
  if (shop_name !== undefined) update.run(shop_name, timestamp, 'shop_name');
  if (session_timeout !== undefined) {
    update.run(String(session_timeout), timestamp, 'session_timeout');
  }

  logAudit(userId, 'settings updated', 'settings', null, null, { shop_name, session_timeout }, 'General business settings modified.');
});

export function updateSettings(req: Request, res: Response) {
  const { shop_name, session_timeout } = req.body;

  try {
    const timestamp = new Date().toISOString();
    updateSettingsTransaction({
      shop_name,
      session_timeout,
      userId: req.session.userId!,
      timestamp
    });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

const updateProfileTransaction = db.transaction((data: any) => {
  const { full_name, username, password, userId, timestamp } = data;
  const beforeUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;

  let updateQuery = 'UPDATE users SET full_name = ?, username = ?, updated_at = ?';
  const params: any[] = [full_name || beforeUser.full_name, username || beforeUser.username, timestamp];

  if (password) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    updateQuery += ', password_hash = ?, must_change_password = 0';
    params.push(hash);
  }

  updateQuery += ' WHERE id = ?';
  params.push(userId);

  db.prepare(updateQuery).run(...params);

  logAudit(userId, 'profile updated', 'users', userId, beforeUser, { full_name, username }, 'User modified their own login credentials.');

  return {
    fullName: full_name || beforeUser.full_name,
    username: username || beforeUser.username
  };
});

export function updateProfile(req: Request, res: Response) {
  const { full_name, username, password } = req.body;
  const userId = req.session.userId!;

  if (password) {
    const errorMsg = validatePasswordStrength(password);
    if (errorMsg) {
      return res.status(400).json({ error: errorMsg });
    }
  }

  try {
    const timestamp = new Date().toISOString();
    const result = updateProfileTransaction({
      full_name,
      username,
      password,
      userId,
      timestamp
    });

    // Update active user state inside context
    req.session.fullName = result.fullName;
    req.session.username = result.username;

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
}
