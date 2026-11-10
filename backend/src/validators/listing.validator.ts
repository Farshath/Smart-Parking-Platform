import { z } from 'zod';
import { RequestValidationSchemas } from '../middleware/validate';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const objectIdSchema = z
  .string()
  .trim()
  .regex(objectIdRegex, 'Must be a valid 24-character hexadecimal MongoDB ObjectId');

export const createListingSchema: RequestValidationSchemas = {
  body: z.object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(150),
    description: z.string().trim().max(2000).optional().default(''),
    address: z.object({
      street: z.string().trim().min(1, 'Street is required'),
      city: z.string().trim().min(1, 'City is required'),
      state: z.string().trim().optional(),
      zipCode: z.string().trim().optional(),
      country: z.string().trim().optional().default('India'),
      formattedAddress: z.string().trim().optional(),
    }),
    coordinates: z
      .object({
        type: z.literal('Point').optional().default('Point'),
        coordinates: z.tuple([
          z.number().min(-180, 'Longitude must be >= -180').max(180, 'Longitude must be <= 180'),
          z.number().min(-90, 'Latitude must be >= -90').max(90, 'Latitude must be <= 90'),
        ]),
      })
      .optional(),
    hourlyRate: z.number().min(0, 'Hourly rate cannot be negative'),
    dailyRate: z.number().min(0, 'Daily rate cannot be negative').optional(),
    parkingType: z.enum(['covered', 'open', 'underground', 'garage', 'valet', 'rooftop', 'standard']).optional().default('standard'),
    operatingHours: z
      .object({
        open: z.string().optional().default('06:00'),
        close: z.string().optional().default('23:00'),
        is24_7: z.boolean().optional().default(false),
      })
      .optional(),
    images: z.array(z.string().trim()).optional().default([]),
    totalSlots: z.number().int().min(1, 'Total slots must be at least 1'),
    availableSlots: z.number().int().min(0, 'Available slots cannot be negative').optional(),
    amenities: z.array(z.string().trim()).optional().default([]),
    status: z.enum(['active', 'inactive', 'maintenance', 'full']).optional().default('active'),
  }),
};

export const updateListingSchema: RequestValidationSchemas = {
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    title: z.string().trim().min(3).max(150).optional(),
    description: z.string().trim().max(2000).optional(),
    address: z
      .object({
        street: z.string().trim().min(1),
        city: z.string().trim().min(1),
        state: z.string().trim().optional(),
        zipCode: z.string().trim().optional(),
        country: z.string().trim().optional(),
        formattedAddress: z.string().trim().optional(),
      })
      .optional(),
    coordinates: z
      .object({
        type: z.literal('Point').optional().default('Point'),
        coordinates: z.tuple([
          z.number().min(-180).max(180),
          z.number().min(-90).max(90),
        ]),
      })
      .optional(),
    hourlyRate: z.number().min(0).optional(),
    dailyRate: z.number().min(0).optional(),
    parkingType: z.enum(['covered', 'open', 'underground', 'garage', 'valet', 'rooftop', 'standard']).optional(),
    operatingHours: z
      .object({
        open: z.string().optional(),
        close: z.string().optional(),
        is24_7: z.boolean().optional(),
      })
      .optional(),
    images: z.array(z.string().trim()).optional(),
    totalSlots: z.number().int().min(1).optional(),
    availableSlots: z.number().int().min(0).optional(),
    amenities: z.array(z.string().trim()).optional(),
    status: z.enum(['active', 'inactive', 'maintenance', 'full']).optional(),
  }),
};

export const getListingByIdSchema: RequestValidationSchemas = {
  params: z.object({
    id: objectIdSchema,
  }),
};

export const searchListingsSchema: RequestValidationSchemas = {
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
    search: z.string().trim().optional(),
    q: z.string().trim().optional(),
    city: z.string().trim().optional(),
    minRate: z
      .string()
      .optional()
      .transform((val) => (val !== undefined && val !== '' ? parseFloat(val) : undefined)),
    maxRate: z
      .string()
      .optional()
      .transform((val) => (val !== undefined && val !== '' ? parseFloat(val) : undefined)),
    status: z.enum(['active', 'inactive', 'maintenance', 'full', 'all']).optional().default('active'),
    amenities: z.string().trim().optional(),
    sortBy: z.enum(['hourlyRate', 'availableSlots', 'createdAt']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
};
