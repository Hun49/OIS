import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, logAudit } from '../database/db.ts';
import { validatePasswordStrength } from '../utils/password.ts';

export function getEmployees(req: Request, res: Response) {
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
}

const createEmployeeTransaction = db.transaction((data: any) => {
  const { full_name, username, hash, permissions, timestamp, currentUserUserId } = data;

  const result = db.prepare(`
    INSERT INTO users (full_name, username, password_hash, role_type, is_active, must_change_password, created_at, updated_at)
    VALUES (?, ?, ?, 'employee', 1, 1, ?, ?)
  `).run(full_name, username, hash, timestamp, timestamp);

  const empId = result.lastInsertRowid as number;

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

  logAudit(currentUserUserId, 'employee created', 'users', empId, null, { username, full_name }, `Created new employee account: ${username}`);

  return empId;
});

export function createEmployee(req: Request, res: Response) {
  const { full_name, username, password, permissions } = req.body;
  if (!full_name || !username || !password) {
    return res.status(400).json({ error: 'Employee details missing' });
  }

  const strengthErr = validatePasswordStrength(password);
  if (strengthErr) {
    return res.status(400).json({ error: strengthErr });
  }

  try {
    const actorId = req.session.userId!;
    const actor = db.prepare('SELECT role_type FROM users WHERE id = ?').get(actorId) as any;
    if (actor?.role_type !== 'owner') {
      if (permissions) {
        const actorPerms = db.prepare('SELECT * FROM user_permissions WHERE user_id = ?').get(actorId) as any;
        for (const key of Object.keys(permissions)) {
          if (permissions[key] === true || permissions[key] === 1 || permissions[key] === '1') {
            if (!actorPerms || !actorPerms[key]) {
              return res.status(403).json({ error: `Privilege Escalation Blocked: You cannot grant '${key}' because you do not have it yourself.` });
            }
          }
        }
      }
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    const timestamp = new Date().toISOString();

    const employeeId = createEmployeeTransaction({
      full_name,
      username,
      hash,
      permissions,
      timestamp,
      currentUserUserId: req.session.userId!
    });

    return res.json({ success: true, employeeId });
  } catch (err: any) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Username already in use.' });
    }
    return res.status(500).json({ error: err.message });
  }
}

const updateEmployeeTransaction = db.transaction((data: any) => {
  const { empId, full_name, username, is_active, permissions, timestamp, currentUserUserId } = data;

  const beforeUser = db.prepare('SELECT * FROM users WHERE id = ?').get(empId) as any;
  if (!beforeUser) throw new Error('Employee not found.');

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
    
    logAudit(currentUserUserId, 'permission changes', 'user_permissions', empId, null, null, `Updated permission authorizations for employee: ${username}`);
  }

  logAudit(currentUserUserId, 'employee edited', 'users', empId, beforeUser, { full_name, username, is_active }, `Modified details of employee: ${username}`);
});

export function updateEmployee(req: Request, res: Response) {
  const empId = parseInt(req.params.id);
  const { full_name, username, is_active, permissions } = req.body;

  try {
    const actorId = req.session.userId!;
    const actor = db.prepare('SELECT role_type FROM users WHERE id = ?').get(actorId) as any;
    if (actor?.role_type !== 'owner') {
      if (empId === actorId) {
        return res.status(403).json({ error: 'Role Escalation Blocked: You cannot modify your own user account or permissions.' });
      }

      const target = db.prepare('SELECT role_type FROM users WHERE id = ?').get(empId) as any;
      if (target?.role_type === 'owner') {
        return res.status(403).json({ error: 'Access Denied: You cannot modify an owner account.' });
      }

      if (permissions) {
        const actorPerms = db.prepare('SELECT * FROM user_permissions WHERE user_id = ?').get(actorId) as any;
        for (const key of Object.keys(permissions)) {
          if (permissions[key] === true || permissions[key] === 1 || permissions[key] === '1') {
            if (!actorPerms || !actorPerms[key]) {
              return res.status(403).json({ error: `Privilege Escalation Blocked: You cannot grant '${key}' because you do not have it yourself.` });
            }
          }
        }
      }
    }

    const timestamp = new Date().toISOString();

    updateEmployeeTransaction({
      empId,
      full_name,
      username,
      is_active,
      permissions,
      timestamp,
      currentUserUserId: req.session.userId!
    });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export function resetEmployeePassword(req: Request, res: Response) {
  const empId = parseInt(req.params.id);
  const { new_password } = req.body;
  if (!new_password) return res.status(400).json({ error: 'Password cannot be empty' });

  const strengthErr = validatePasswordStrength(new_password);
  if (strengthErr) {
    return res.status(400).json({ error: strengthErr });
  }

  try {
    const actorId = req.session.userId!;
    const actor = db.prepare('SELECT role_type FROM users WHERE id = ?').get(actorId) as any;
    if (actor?.role_type !== 'owner') {
      if (empId === actorId) {
        return res.status(403).json({ error: 'Access Denied: You cannot reset your own employee-managed password here.' });
      }
      const targetUser = db.prepare('SELECT role_type FROM users WHERE id = ?').get(empId) as any;
      if (targetUser?.role_type === 'owner') {
        return res.status(403).json({ error: 'Access Denied: You cannot reset an owner password.' });
      }
    }

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
}

export function deleteEmployee(req: Request, res: Response) {
  const empId = parseInt(req.params.id);

  try {
    const actorId = req.session.userId!;
    const actor = db.prepare('SELECT role_type FROM users WHERE id = ?').get(actorId) as any;
    if (actor?.role_type !== 'owner') {
      if (empId === actorId) {
        return res.status(403).json({ error: 'Access Denied: You cannot delete your own account.' });
      }
      const targetUser = db.prepare('SELECT role_type FROM users WHERE id = ?').get(empId) as any;
      if (targetUser?.role_type === 'owner') {
        return res.status(403).json({ error: 'Access Denied: You cannot delete an owner account.' });
      }
    }

    const emp = db.prepare('SELECT username FROM users WHERE id = ?').get(empId) as any;
    if (!emp) return res.status(404).json({ error: 'Employee not found.' });

    db.prepare('DELETE FROM users WHERE id = ?').run(empId);

    logAudit(req.session.userId!, 'employee deleted', 'users', empId, { username: emp.username }, null, `Deleted employee user: ${emp.username}`);

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
