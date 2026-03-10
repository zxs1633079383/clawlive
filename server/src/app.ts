import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { meetingRouter } from './routes/meeting-routes.js';
import { skillRouter } from './routes/skill-routes.js';

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
  app.use(express.json());

  app.use('/api/meetings', meetingRouter);
  app.use('/api/skills', skillRouter);

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
  });

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[server] Unhandled error:', err);
    res.status(500).json({
      success: false,
      data: null,
      error: config.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
  });

  return app;
}
