import express, { Request, Response } from 'express';
import path from 'path';

// Database setup triggers automatically upon import
import './server/database/db.ts';

// Middlewares
import { createSessionMiddleware, configureSessionCookieAdjustment, handleSessionTimeout } from './server/middleware/session.ts';

// Backup scheduler triggers
import { runStartupBackupRecovery, startBackupScheduler } from './server/jobs/backupJob.ts';

// Routes
import { router as apiRouter } from './server/routes/index.ts';

const app = express();
const PORT = 3000;

app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express session setup
app.use(createSessionMiddleware());
app.use(configureSessionCookieAdjustment);
app.use(handleSessionTimeout);

// Serve uploads and frontend static files
app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Register API router
app.use('/api', apiRouter);

async function startApp() {
  // Run startup missed backup recovery check
  await runStartupBackupRecovery();

  // Start background backup ticker scheduling
  startBackupScheduler();

  // Single fallback wildcard route to send frontend index.html
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(process.cwd(), 'public/index.html'));
  });

  // Bind server launch
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Live on local port http://localhost:${PORT}`);
  });
}

startApp();
