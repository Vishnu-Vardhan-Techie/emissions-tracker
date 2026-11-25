import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import factorRoutes from './routes/factors.js';
import activityRoutes from './routes/activities.js';
import ingestRoutes from './routes/ingest.js';
import targetRoutes from './routes/targets.js';
import dashboardRoutes from './routes/dashboard.js';
import { authenticate } from './middleware/auth.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  const origins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: origins.length ? origins : false }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRoutes);

  // Everything below requires a valid login.
  app.use('/api', authenticate);
  app.use('/api/users', userRoutes);
  app.use('/api/factors', factorRoutes);
  app.use('/api/activities', activityRoutes);
  app.use('/api/ingest', ingestRoutes);
  app.use('/api/targets', targetRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large (max 5 MB)' });
    if (err?.name === 'CastError') return res.status(400).json({ error: 'Invalid identifier' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
