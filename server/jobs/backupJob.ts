import { db } from '../database/db.ts';
import { executeBackup, checkRetentionStatusAndDailyBackup } from '../services/backupService.ts';

export function runStartupBackupRecovery() {
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
}

export function startBackupScheduler() {
  // Start ticking checks every minute
  setInterval(checkRetentionStatusAndDailyBackup, 60000);
}
