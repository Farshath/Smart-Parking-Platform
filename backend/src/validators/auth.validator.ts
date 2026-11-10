import { z } from 'zod';
import { RequestValidationSchemas } from '../middleware/validate';

export const registerSchema: RequestValidationSchemas = {
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters long')
      .max(100, 'Name cannot exceed 100 characters'),
    email: z
      .string()
      .trim()
      .email('Please provide a valid email address')
      .toLowerCase(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .max(100, 'Password cannot exceed 100 characters')
      .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    phoneNumber: z.string().trim().optional(),
    // Strictly restrict self-registration roles to 'customer' or 'parking_owner'.
    // Disallows self-assigning 'admin'.
    role: z.enum(['customer', 'parking_owner']).optional().default('customer'),
  }),
};

export const loginSchema: RequestValidationSchemas = {
  body: z.object({
    email: z
      .string()
      .trim()
      .email('Please provide a valid email address')
      .toLowerCase(),
    password: z.string().min(1, 'Password is required'),
  }),
};

export const updateProfileSchema: RequestValidationSchemas = {
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters long')
      .max(100, 'Name cannot exceed 100 characters')
      .optional(),
    phoneNumber: z.string().trim().optional(),
  }),
};

export const changePasswordSchema: RequestValidationSchemas = {
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters long')
      .max(100, 'Password cannot exceed 100 characters')
      .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  }),
};

