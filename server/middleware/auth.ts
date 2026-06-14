import { Request, Response, NextFunction } from 'express';
import { db } from '../database/db.ts';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated. Please log in.' });
  }

  try {
    // Fresh security query from sqlite db to prevent session state desynchronization
    const user = db.prepare('SELECT is_active, must_change_password FROM users WHERE id = ?').get(req.session.userId) as any;
    if (!user || user.is_active === 0) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Your session has ended or account is inactive.' });
    }

    if (user.must_change_password === 1) {
      const allowedPaths = [
        '/auth/change-forced-password',
        '/auth/logout',
        '/auth/session'
      ];
      const normalizedPath = req.path.replace(/^\/api/, '');
      const isAllowed = allowedPaths.some(p => normalizedPath === p || req.path === p);

      if (!isAllowed) {
        return res.status(403).json({ error: 'FORCED_PASSWORD_RESET', message: 'You must change your password on first login.' });
      }
    }

    next();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export function requirePermission(permissionKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated. Please log in.' });
    }

    try {
      const user = db.prepare('SELECT is_active, role_type, must_change_password FROM users WHERE id = ?').get(req.session.userId) as any;
      if (!user || user.is_active === 0) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: 'Your account is inactive or session has ended.' });
      }

      if (user.must_change_password === 1) {
        return res.status(403).json({ error: 'FORCED_PASSWORD_RESET', message: 'You must change your password before accessing the system.' });
      }

      if (user.role_type === 'owner') {
        return next(); // Owner bypasses specific permissions
      }

      // Fresh permission check from local SQLite authority
      const permissions = db.prepare('SELECT * FROM user_permissions WHERE user_id = ?').get(req.session.userId) as any;
      if (permissions && permissions[permissionKey] === 1) {
        return next();
      }

      return res.status(403).json({ error: `Permission Denied: missing privilege '${permissionKey}'` });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  };
}
