import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { db, logAudit } from '../database/db.ts';
import { executeBackup } from '../services/backupService.ts';

export function getBackups(req: Request, res: Response) {
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
}

export function createBackupRoute(req: Request, res: Response) {
  try {
    const filename = executeBackup('manual', req.session.userId || null);
    return res.json({ success: true, filename });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export function handleRetentionDecision(req: Request, res: Response) {
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
      req.session.userId || null,
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
}
