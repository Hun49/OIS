import { Request, Response } from 'express';
import { db } from '../database/db.ts';

export function getAuditLogs(req: Request, res: Response) {
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
}
