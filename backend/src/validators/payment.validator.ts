import { z } from 'zod';
import { RequestValidationSchemas } from '../middleware/validate';
import { objectIdSchema } from './listing.validator';

export const processPaymentSchema: RequestValidationSchemas = {
  body: z.object({
    bookingId: objectIdSchema,
    paymentMethod: z
      .enum(['card', 'upi', 'wallet', 'netbanking', 'simulated_test'])
      .optional()
      .default('simulated_test'),
    simulateFailure: z.boolean().optional().default(false),
  }),
};

export const getPaymentByIdSchema: RequestValidationSchemas = {
  params: z.object({
    id: objectIdSchema,
  }),
};

export const myPaymentsQuerySchema: RequestValidationSchemas = {
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
      .enum(['pending', 'completed', 'failed', 'refunded', 'all'])
      .optional()
      .default('all'),
  }),
};

