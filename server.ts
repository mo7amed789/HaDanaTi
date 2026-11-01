import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './server/db/database';
import { authRouter } from './server/modules/identity/authRoutes';
import { platformRouter } from './server/modules/platform/platformRoutes';
import { nurseryRouter } from './server/modules/nurseries/nurseryRoutes';
import { classroomRouter } from './server/modules/classrooms/classroomRoutes';
import { childrenRouter } from './server/modules/children/childrenRoutes';
import { attendanceRouter } from './server/modules/attendance/attendanceRoutes';
import { reportRouter } from './server/modules/reports/reportRoutes';
import { billingRouter } from './server/modules/billing/billingRoutes';
import { announcementRouter } from './server/modules/announcements/announcementRoutes';
import { parentRequestRouter } from './server/modules/parentRequests/parentRequestRoutes';

async function bootstrap() {
  // 1. Initialize DB and seed demo data
  initDatabase();

  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());
  app.use(cookieParser());

  // 2. Mount API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/platform', platformRouter);
  app.use('/api/nurseries', nurseryRouter);
  app.use('/api/nurseries', classroomRouter);
  app.use('/api/nurseries', childrenRouter);
  app.use('/api/nurseries', attendanceRouter);
  app.use('/api/nurseries', reportRouter);
  app.use('/api/nurseries', billingRouter);
  app.use('/api/nurseries', announcementRouter);
  app.use('/api/nurseries', parentRequestRouter);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', product: 'حضانتي (Hadanaty)', version: '1.0.0-mvp' });
  });

  // 3. Mount Frontend
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Hadanaty Server] Running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
