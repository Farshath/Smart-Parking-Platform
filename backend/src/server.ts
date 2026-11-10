import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/db';

const startServer = async () => {
  const app = createApp();
  const server = http.createServer(app);

  // Attempt database connection
  await connectDatabase();

  server.listen(env.PORT, () => {
    console.log(`[Server] Smart Parking Platform Backend running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    console.log(`[Server] Health check available at: http://localhost:${env.PORT}/api/health`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);

    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      try {
        await disconnectDatabase();
        console.log('[Server] Graceful shutdown complete.');
        process.exit(0);
      } catch (err) {
        console.error('[Server] Error during database disconnect:', err);
        process.exit(1);
      }
    });

    // Force close after 10s if shutdown hangs
    setTimeout(() => {
      console.error('[Server] Forcing shutdown after timeout.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    console.error('[Server] Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('[Server] Uncaught Exception:', err);
    process.exit(1);
  });
};

startServer();
