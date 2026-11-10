import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User, UserRole } from '../models/User';
import { AppError } from '../utils/AppError';
import { verifyToken } from '../utils/auth';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

// Augment Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Middleware that verifies the Bearer JWT token in the Authorization header
 * and attaches the authenticated user to req.user.
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(
        'Authentication required. Please provide a valid Bearer token in the Authorization header.',
        401
      );
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AppError('Authentication token is missing.', 401);
    }

    // 1. Verify token signature and expiration first
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError('Authentication token has expired. Please log in again.', 401);
      }
      throw new AppError('Invalid authentication token.', 401);
    }

    // 2. Check database connection before loading user record
    if (mongoose.connection.readyState !== 1) {
      throw new AppError(
        'Database is not connected. Configure MONGODB_URI in your environment (.env) to authenticate users.',
        503
      );
    }

    // 3. Load active user from database to ensure account still exists and role is current
    const user = await User.findById(decoded.userId).select('name email role');
    if (!user) {
      throw new AppError(
        'The user belonging to this token no longer exists. Please register or log in again.',
        401
      );
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware factory that restricts route access to specific user roles.
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(
        new AppError('Unauthorized. You must be logged in to access this resource.', 401)
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Forbidden. Access restricted to roles: [${allowedRoles.join(', ')}]. Your current role is '${req.user.role}'.`,
          403
        )
      );
    }

    next();
  };
};
