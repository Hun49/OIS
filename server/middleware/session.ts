import { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import { db } from '../database/db.ts';

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

export function handleSessionTimeout(req: Request, res: Response, next: NextFunction) {
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
      // Only extend sliding activity timeout on active interactions
      const isActiveUserHeader = req.headers['x-active-user'] === 'true';
      const isActiveRoute = req.path === '/auth/active-interaction' || req.originalUrl.endsWith('/auth/active-interaction');
      
      if (isActiveUserHeader || isActiveRoute) {
        // Session active, update sliding window
        req.session.lastActivity = currentTime;
        // Also update cookie maxAge explicitly
        req.session.cookie.maxAge = maxIdleMs;
        // Explicitly save session to prevent asynchronous MemoryStore replication race conditions
        req.session.save((err) => {
          if (err) console.error('Session sliding window save error:', err);
          next();
        });
      } else {
        // Logged in and not expired, let request proceed as-is without resetting inactivity timeline
        next();
      }
    }
  } else {
    next();
  }
}

export function configureSessionCookieAdjustment(req: Request, res: Response, next: NextFunction) {
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
}

export function createSessionMiddleware() {
  const getTimeoutSetting = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'session_timeout'");
  const timeoutResult = getTimeoutSetting.get() as { setting_value: string } | undefined;
  const sessionMinutes = timeoutResult ? parseInt(timeoutResult.setting_value) || 15 : 15;

  return session({
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
  });
}
