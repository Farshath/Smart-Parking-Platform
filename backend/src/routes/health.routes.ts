import { Router, Request, Response } from 'express';
import { getDatabaseStatus } from '../config/db';
import { env } from '../config/env';

const router = Router();

/**
 * @route   GET /api/health
 * @desc    System health check returning server metrics and database connection status
 * @access  Public
 */
router.get('/', (req: Request, res: Response) => {
  const dbStatus = getDatabaseStatus();
  const isHealthy = dbStatus.status === 'connected' || dbStatus.status === 'unconfigured';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    service: 'smart-parking-backend',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: env.NODE_ENV,
    database: dbStatus,
  });
});

export default router;
