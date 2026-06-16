import { Request, Response } from 'express';
import { db, logAudit } from '../database/db.ts';
import { onboardingTemplates, keywordToCategoryMapping } from '../data/onboardingTemplates.ts';

export function getOnboardingStatus(req: Request, res: Response) {
  try {
    const onboardingCompleteSetting = db.prepare('SELECT setting_value FROM settings WHERE setting_key = ?').get('onboarding_complete') as any;
    const isComplete = onboardingCompleteSetting?.setting_value === '1';
    
    return res.json({ 
      isComplete,
      templates: onboardingTemplates 
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export function processOnboarding(req: Request, res: Response) {
  const { selectedTemplateIds, businessDescription, emptySystem, customCategories } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Double check if user is owner
  const user = db.prepare('SELECT role_type FROM users WHERE id = ?').get(userId) as any;
  if (!user || user.role_type !== 'owner') {
    return res.status(403).json({ error: 'Only the store owner can perform onboarding.' });
  }

  try {
    const transaction = db.transaction(() => {
      // 1. Mark onboarding as complete
      db.prepare('UPDATE settings SET setting_value = ?, updated_at = ? WHERE setting_key = ?')
        .run('1', new Date().toISOString(), 'onboarding_complete');

      if (emptySystem) {
        logAudit(userId, 'onboarding skip', 'settings', null, null, { empty: true }, 'Owner skipped onboarding templates.');
        return { success: true, message: 'Onboarding completed with empty system.' };
      }

      // 2. Aggregate categories from selected templates
      let categoriesToImport = new Set<string>();
      if (selectedTemplateIds && Array.isArray(selectedTemplateIds)) {
        selectedTemplateIds.forEach(id => {
          const template = onboardingTemplates.find(t => t.id === id);
          if (template) {
            template.categories.forEach(cat => categoriesToImport.add(cat));
          }
        });
      }

      // 3. Add custom suggested categories if provided
      if (customCategories && Array.isArray(customCategories)) {
        customCategories.forEach(cat => categoriesToImport.add(cat));
      }

      // 4. Import categories into database
      const timestamp = new Date().toISOString();
      const checkCategory = db.prepare('SELECT id FROM categories WHERE name = ?');
      const insertCategory = db.prepare('INSERT INTO categories (name, description, created_at, updated_at) VALUES (?, ?, ?, ?)');

      const imported: string[] = [];
      categoriesToImport.forEach(catName => {
        const existing = checkCategory.get(catName);
        if (!existing) {
          insertCategory.run(catName, 'Imported during setup', timestamp, timestamp);
          imported.push(catName);
        }
      });

      logAudit(
        userId, 
        'onboarding import', 
        'categories', 
        null, 
        null, 
        { selectedTemplateIds, businessDescription, importedCount: imported.length }, 
        `Owner completed onboarding. Imported ${imported.length} categories.`
      );

      return { success: true, importedCount: imported.length };
    });

    const result = transaction();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export function resetOnboarding(req: Request, res: Response) {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const user = db.prepare('SELECT role_type FROM users WHERE id = ?').get(userId) as any;
  if (!user || user.role_type !== 'owner') {
    return res.status(403).json({ error: 'Only the store owner can reset onboarding.' });
  }

  try {
    db.prepare('UPDATE settings SET setting_value = ?, updated_at = ? WHERE setting_key = ?')
      .run('0', new Date().toISOString(), 'onboarding_complete');
    
    logAudit(userId, 'onboarding reset', 'settings', null, null, null, 'Owner reset onboarding state.');
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export function suggestCategories(req: Request, res: Response) {
  const { description } = req.body;
  if (!description) return res.json({ suggestions: [] });

  const descLower = description.toLowerCase();
  const suggestions = new Set<string>();

  Object.keys(keywordToCategoryMapping).forEach(keyword => {
    if (descLower.includes(keyword)) {
      suggestions.add(keywordToCategoryMapping[keyword]);
    }
  });

  return res.json({ suggestions: Array.from(suggestions) });
}
