import { Router } from 'express';
import {
  deleteUser,
  getAdminBookings,
  getAdminListings,
  getAdminStats,
  getAdminUsers,
  updateListingStatus,
  updateUserRole,
} from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Enforce admin-only access for all routes
router.use(authenticate, authorize('admin'));

/**
 * @route   GET /api/admin/stats
 * @desc    System metrics & platform statistics
 */
router.get('/stats', getAdminStats);

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with search and role filter
 */
router.get('/users', getAdminUsers);

/**
 * @route   PATCH /api/admin/users/:id/role
 * @desc    Update a user's role
 */
router.patch('/users/:id/role', updateUserRole);

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete a user
 */
router.delete('/users/:id', deleteUser);

/**
 * @route   GET /api/admin/listings
 * @desc    Get all platform listings
 */
router.get('/listings', getAdminListings);

/**
 * @route   PATCH /api/admin/listings/:id/status
 * @desc    Change listing status
 */
router.patch('/listings/:id/status', updateListingStatus);

/**
 * @route   GET /api/admin/bookings
 * @desc    Get all platform bookings
 */
router.get('/bookings', getAdminBookings);

export default router;

