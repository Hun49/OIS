import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { db, logAudit } from '../database/db.ts';

/**
 * Validates that a backup file is a valid SQLite database and passes integrity checks.
 */
export function validateBackup(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    const tempDb = new Database(filePath, { readonly: true });
    // PRAGMA integrity_check returns 'ok' if successful
    const result = tempDb.prepare('PRAGMA integrity_check').get() as any;
    tempDb.close();
    return result && result.integrity_check === 'ok';
  } catch (err) {
    console.error(`[Backup Integrity] Validation failed for ${filePath}:`, err);
    return false;
  }
}

export async function executeBackup(type: 'auto' | 'manual' | 'startup' | 'pre-restore', userId: number | null): Promise<string> {
  const timestamp = new Date().toISOString();
  // Safe format YYYY-MM-DD_HH-MM-SS
  const fileDate = timestamp.replace(/T/, '_').replace(/:/g, '-').split('.')[0];
  const filename = `${type}_backup_${fileDate}.db`;
  const backupFolder = path.join(process.cwd(), 'backups/daily');
  const backupPath = path.join(backupFolder, filename);

  try {
    // Ensure folder exists
    if (!fs.existsSync(backupFolder)) {
      fs.mkdirSync(backupFolder, { recursive: true });
    }

    // Use better-sqlite3 built-in backup method for safety/atomicity
    // It returns a promise that resolves when the backup is complete
    await db.backup(backupPath);

    // Validate the backup immediately
    const isValid = validateBackup(backupPath);
    if (!isValid) {
      throw new Error('Backup file failed integrity verification after write.');
    }

    // Record backup
    const insertBackup = db.prepare(`
      INSERT INTO backups (file_name, file_path, backup_type, created_at, kept_flag, retention_status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `);
    const isSpecial = (type === 'pre-restore' || type === 'startup');
    const res = insertBackup.run(filename, backupPath, type, timestamp, isSpecial ? 1 : 0);

    logAudit(
      userId,
      'backup created',
      'backups',
      res.lastInsertRowid as number,
      null,
      { file_name: filename, type },
      `Local ${type} backup successfully written and verified at ${backupPath}.`
    );

    return filename;
  } catch (err: any) {
    console.error(`[Backup Failure] ${type} backup failed:`, err);
    logAudit(
      userId,
      'backup failure',
      'backups',
      null,
      null,
      { error: err.message, type },
      `CRITICAL: Failed to create ${type} backup. Error: ${err.message}`
    );
    throw err;
  }
}

/**
 * Restores the system database from a chosen backup file.
 */
export async function restoreFromBackup(backupId: number, userId: number): Promise<{ success: boolean; message: string }> {
  try {
    const backup = db.prepare('SELECT * FROM backups WHERE id = ?').get(backupId) as any;
    if (!backup) throw new Error('Backup record not found.');
    if (!fs.existsSync(backup.file_path)) throw new Error('Physical backup file missing from disk.');

    // 1. Validate the backup once more before applying it
    if (!validateBackup(backup.file_path)) {
      throw new Error('Backup failed integrity check and cannot be restored safely.');
    }

    // 2. Take a PRE-RESTORE emergency backup of current state
    console.log('[Restore] Creating pre-restore safety backup...');
    await executeBackup('pre-restore', userId);

    // 3. Apply the backup. 
    const mainDbPath = path.join(process.cwd(), 'database/app.db');
    
    // Close existing connection
    db.close();

    // Copy backup to main
    fs.copyFileSync(backup.file_path, mainDbPath);

    return { success: true, message: 'Restore complete. Process restart recommended.' };
  } catch (err: any) {
    console.error('[Restore Failure]', err);
    return { success: false, message: err.message };
  }
}

// Daily automated cron-like backup routine
export async function checkRetentionStatusAndDailyBackup() {
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
    await executeBackup('auto', null);
    
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
