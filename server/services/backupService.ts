import path from 'path';
import fs from 'fs';
import { db, logAudit } from '../database/db.ts';

export function executeBackup(type: 'auto' | 'manual', userId: number | null): string {
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
export function checkRetentionStatusAndDailyBackup() {
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
