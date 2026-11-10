import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';
import { comparePassword, generateToken, hashPassword } from '../utils/auth';

/**
 * Asserts MongoDB is connected before attempting operations.
 */
const assertDatabaseConnected = () => {
  if (mongoose.connection.readyState !== 1) {
    throw new AppError(
      'Database is not connected. Configure MONGODB_URI in your environment (.env) to enable user registration and login.',
      503
    );
  }
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user account with hashed password and return JWT
 * @access  Public
 */
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    const { name, email, password, phoneNumber, role } = req.body;

    // Check for existing user with this email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new AppError('An account with this email address already exists.', 409);
    }

    // Hash the password securely with bcrypt
    const passwordHash = await hashPassword(password);

    // Create new user (role is constrained to 'customer' | 'parking_owner' via validator)
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      passwordHash,
      phoneNumber,
      role: role || 'customer',
    });

    await newUser.save();

    // Generate JWT token
    const token = generateToken({
      userId: newUser._id.toString(),
      email: newUser.email,
      role: newUser.role,
    });

    res.status(201).json({
      success: true,
      message: 'User registration successful',
      data: {
        token,
        user: newUser.toJSON(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user credentials and return JWT
 * @access  Public
 */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    const { email, password } = req.body;

    // Retrieve user including the hidden passwordHash
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user) {
      throw new AppError('Invalid email or password.', 401);
    }

    // Verify candidate password against stored bcrypt hash
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password.', 401);
    }

    // Generate JWT token
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: user.toJSON(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user profile
 * @access  Private (Authenticated users only)
 */
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }

    res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/auth/profile
 * @desc    Update current authenticated user's profile
 * @access  Private
 */
export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }

    const { name, phoneNumber } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (name !== undefined) user.name = name;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/auth/change-password
 * @desc    Change password for authenticated user
 * @access  Private
 */
export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select('+passwordHash');
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const isMatch = await comparePassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Current password does not match.', 400);
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};

