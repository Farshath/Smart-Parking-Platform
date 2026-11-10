import { Router } from 'express';
import {
  changePassword,
  getMe,
  login,
  register,
  updateProfile,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from '../validators/auth.validator';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (customer or parking_owner)
 */
router.post('/register', validate(registerSchema), register);

/**
 * @route   POST /api/auth/login
 * @desc    Log in with email and password
 */
router.post('/login', validate(loginSchema), login);

/**
 * @route   GET /api/auth/me
 * @desc    Retrieve authenticated user profile
 */
router.get('/me', authenticate, getMe);

/**
 * @route   PATCH /api/auth/profile
 * @desc    Update authenticated user profile
 */
router.patch('/profile', authenticate, validate(updateProfileSchema), updateProfile);

/**
 * @route   PATCH /api/auth/change-password
 * @desc    Change password
 */
router.patch(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  changePassword
);

export default router;
