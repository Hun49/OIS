import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.ts';
import { uploader } from '../utils/upload.ts';

// Controllers
import * as authController from '../controllers/authController.ts';
import * as dashboardController from '../controllers/dashboardController.ts';
import * as categoriesController from '../controllers/categoriesController.ts';
import * as productsController from '../controllers/productsController.ts';
import * as salesController from '../controllers/salesController.ts';
import * as returnsController from '../controllers/returnsController.ts';
import * as employeesController from '../controllers/employeesController.ts';
import * as reportsController from '../controllers/reportsController.ts';
import * as auditLogsController from '../controllers/auditLogsController.ts';
import * as backupsController from '../controllers/backupsController.ts';
import * as settingsController from '../controllers/settingsController.ts';
import * as posController from '../controllers/posController.ts';

export const router = Router();

// 1. AUTH API
router.post('/auth/login', authController.login);
router.post('/auth/logout', requireAuth, authController.logout);
router.get('/auth/session', authController.getSession);
router.get('/auth/active-interaction', requireAuth, authController.activeInteraction);
router.post('/auth/change-forced-password', requireAuth, authController.changeForcedPassword);

// 2. DASHBOARD API & ALERTS
router.get('/dashboard/stats', requireAuth, requirePermission('can_view_dashboard'), dashboardController.getStats);
router.get('/alerts/low-stock', requireAuth, dashboardController.getLowStockAlerts);

// 3. CATEGORIES API
router.get('/categories', requireAuth, categoriesController.getCategories);
router.post('/categories', requireAuth, requirePermission('can_manage_categories'), categoriesController.createCategory);
router.put('/categories/:id', requireAuth, requirePermission('can_manage_categories'), categoriesController.updateCategory);

// 4. PRODUCTS & VARIANTS & STOCK BATCHES API
router.get('/products', requireAuth, productsController.getProducts);
router.post('/products', requireAuth, requirePermission('can_manage_products'), productsController.createProduct);
router.put('/products/:id', requireAuth, requirePermission('can_manage_products'), productsController.updateProduct);

// Bulk Stock Addition
router.post('/stock/add', requireAuth, requirePermission('can_manage_stock'), productsController.addStock);

// Manual Stock Adjustment
router.post('/stock/adjust', requireAuth, requirePermission('can_adjust_stock'), productsController.adjustStock);

// 5. SALES (POSCheckout) API
router.post('/sales/checkout', requireAuth, requirePermission('can_sell'), uploader.single('receipt_image'), salesController.checkout);

// 6. RETURNS API
router.get('/returns', requireAuth, returnsController.getReturns);
router.post('/returns/request', requireAuth, requirePermission('can_create_returns'), uploader.single('receipt_image'), returnsController.requestReturn);
router.post('/returns/approve/:id', requireAuth, requirePermission('can_approve_returns'), returnsController.approveReturn);

// 7. EMPLOYEES CONTROL API
router.get('/employees', requireAuth, requirePermission('can_manage_employees'), employeesController.getEmployees);
router.post('/employees', requireAuth, requirePermission('can_manage_employees'), employeesController.createEmployee);
router.put('/employees/:id', requireAuth, requirePermission('can_manage_employees'), employeesController.updateEmployee);
router.post('/employees/reset-password/:id', requireAuth, requirePermission('can_manage_employees'), employeesController.resetEmployeePassword);
router.delete('/employees/:id', requireAuth, requirePermission('can_manage_employees'), employeesController.deleteEmployee);

// 8. REPORTS GENERATION API
router.get('/reports/query', requireAuth, reportsController.queryReport);

// 9. AUDIT LOGS SEARCH API
router.get('/audit-logs', requireAuth, requirePermission('can_view_audit_logs'), auditLogsController.getAuditLogs);

// 10. BACKUPS API
router.get('/backups', requireAuth, requirePermission('can_manage_backups'), backupsController.getBackups);
router.post('/backups/create', requireAuth, requirePermission('can_manage_backups'), backupsController.createBackupRoute);
router.post('/backups/restore', requireAuth, requirePermission('can_manage_backups'), backupsController.restoreBackup);
router.post('/backups/retention-decision', requireAuth, requirePermission('can_manage_backups'), backupsController.handleRetentionDecision);

// 11. GENERAL SETTINGS & PROFILE API
router.get('/settings', requireAuth, settingsController.getSettings);
router.post('/settings/update', requireAuth, requirePermission('can_manage_settings'), settingsController.updateSettings);
router.post('/profile/update', requireAuth, settingsController.updateProfile);

// POS SEARCH API
router.get('/pos/search', requireAuth, requirePermission('can_sell'), posController.searchPos);
