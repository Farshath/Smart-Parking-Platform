import { z } from 'zod';
import { RequestValidationSchemas } from '../middleware/validate';
import { objectIdSchema } from './listing.validator';

export const createBookingSchema: RequestValidationSchemas = {
  body: z
    .object({
      listingId: objectIdSchema,
      startTime: z
        .string()
        .datetime({ message: 'Start time must be a valid ISO 8601 date string' }),
      endTime: z
        .string()
        .datetime({ message: 'End time must be a valid ISO 8601 date string' }),
      vehicleNumber: z.string().trim().max(20).optional(),
      idempotencyKey: z.string().trim().min(4).max(128).optional(),
    })
    .refine(
      (data) => {
        const start = new Date(data.startTime);
        const end = new Date(data.endTime);
        return end.getTime() > start.getTime();
      },
      {
        message: 'End time must be strictly after start time',
        path: ['endTime'],
      }
    )
    .refine(
      (data) => {
        const start = new Date(data.startTime);
        // Allow a 5-minute buffer for network latency and clock skew
        const nowWithBuffer = new Date(Date.now() - 5 * 60 * 1000);
        return start >= nowWithBuffer;
      },
      {
        message: 'Booking start time cannot be in the past',
        path: ['startTime'],
      }
    )
    .refine(
      (data) => {
        const start = new Date(data.startTime);
        const end = new Date(data.endTime);
        const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
        return durationMinutes >= 15; // Minimum 15-minute booking
      },
      {
        message: 'Booking duration must be at least 15 minutes',
        path: ['endTime'],
      }
    )
    .refine(
      (data) => {
        const start = new Date(data.startTime);
        const end = new Date(data.endTime);
        const durationDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        return durationDays <= 30; // Maximum 30-day booking
      },
      {
        message: 'Booking duration cannot exceed 30 consecutive days',
        path: ['endTime'],
      }
    ),
};

export const getBookingByIdSchema: RequestValidationSchemas = {
  params: z.object({
    id: objectIdSchema,
  }),
};

export const cancelBookingSchema: RequestValidationSchemas = {
  params: z.object({
    id: objectIdSchema,
  }),
  body: z
    .object({
      reason: z
        .string()
        .trim()
        .max(500, 'Cancellation reason cannot exceed 500 characters')
        .optional(),
    })
    .optional(),
};

export const myBookingsQuerySchema: RequestValidationSchemas = {
  query: z.object({
    page: z
      .string()
      .optional()
      .default('1')
      .transform((val) => Math.max(1, parseInt(val, 10) || 1)),
    limit: z
      .string()
      .optional()
      .default('10')
      .transform((val) => Math.min(50, Math.max(1, parseInt(val, 10) || 10))),
    status: z
      .enum(['pending', 'confirmed', 'cancelled', 'completed', 'all'])
      .optional()
      .default('all'),
  }),
};

export const updateBookingStatusSchema: RequestValidationSchemas = {
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']),
    reason: z.string().trim().max(500).optional(),
  }),
};

