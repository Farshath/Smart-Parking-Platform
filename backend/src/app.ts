import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env';
import apiRoutes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export const createApp = (): Application => {
  const app: Application = express();

  // Basic HTTP request logging
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  // CORS Configuration
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, Postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
    })
  );

  // Body Parsing Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Root welcome / info endpoint
  app.get('/', (req: Request, res: Response) => {
    res.json({
      name: 'Smart Parking Slot Rental & Availability Platform API',
      version: '0.1.0',
      status: 'active',
      endpoints: {
        health: '/api/health',
        auth: {
          register: 'POST /api/auth/register',
          login: 'POST /api/auth/login',
          me: 'GET /api/auth/me',
        },
        listings: '/api/listings',
        bookings: {
          create: 'POST /api/bookings',
          myBookings: 'GET /api/bookings/my-bookings',
          getById: 'GET /api/bookings/:id',
          cancel: 'PATCH /api/bookings/:id/cancel',
        },
      },
    });
  });

  // REST API Routes
  app.use('/api', apiRoutes);

  // 404 Not Found Handler
  app.use(notFoundHandler);

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
};
