import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Booking } from '../models/Booking';
import { ParkingListing } from '../models/ParkingListing';
import { Payment } from '../models/Payment';
import { User, USER_ROLES } from '../models/User';
import { AppError } from '../utils/AppError';
import { normalizeEntity, normalizeEntities } from '../utils/normalize';

/**
 * Asserts MongoDB is connected before attempting operations.
 */
const assertDatabaseConnected = () => {
  if (mongoose.connection.readyState !== 1) {
    throw new AppError(
      'Database is not connected. Configure MONGODB_URI in your environment (.env) to enable administration.',
      503
    );
  }
};

/**
 * @route   GET /api/admin/stats
 * @desc    Get system-wide platform statistics for Admin Dashboard
 * @access  Private (Admin only)
 */
export const getAdminStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    const [
      totalUsers,
      customerCount,
      ownerCount,
      adminCount,
      totalListings,
      activeListings,
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      payments,
      recentUsers,
      recentBookings,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'parking_owner' }),
      User.countDocuments({ role: 'admin' }),
      ParkingListing.countDocuments(),
      ParkingListing.countDocuments({ status: 'active' }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'confirmed' }),
      Booking.countDocuments({ status: 'cancelled' }),
      Payment.find({ status: 'completed' }).select('amount').lean(),
      User.find().sort({ createdAt: -1 }).limit(5).select('name email role createdAt').lean(),
      Booking.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('userId', 'name email')
        .populate('listingId', 'title')
        .lean(),
    ]);

    const platformRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          users: {
            total: totalUsers,
            customers: customerCount,
            owners: ownerCount,
            admins: adminCount,
          },
          listings: {
            total: totalListings,
            active: activeListings,
            inactive: totalListings - activeListings,
          },
          bookings: {
            total: totalBookings,
            confirmed: confirmedBookings,
            cancelled: cancelledBookings,
            pending: totalBookings - confirmedBookings - cancelledBookings,
          },
          revenue: {
            totalRevenue: Math.round(platformRevenue * 100) / 100,
            currency: 'INR',
            completedPaymentsCount: payments.length,
          },
        },
        recentUsers: normalizeEntities(recentUsers as any),
        recentBookings: normalizeEntities(recentBookings as any),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/admin/users
 * @desc    Get paginated users list with search & filter
 * @access  Private (Admin only)
 */
export const getAdminUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    const { page, limit, role, search } = req.query as {
      page?: string;
      limit?: string;
      role?: string;
      search?: string;
    };

    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '10', 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = {};

    if (role && role !== 'all') {
      filter.role = role;
    }

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: regex }, { email: regex }, { phoneNumber: regex }];
    }

    const [users, totalResults] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalResults / limitNum) || 1;

    res.status(200).json({
      success: true,
      data: {
        users: normalizeEntities(users as any),
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalResults,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/admin/users/:id/role
 * @desc    Change user role
 * @access  Private (Admin only)
 */
export const updateUserRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    const { id } = req.params;
    const { role } = req.body;

    if (!USER_ROLES.includes(role)) {
      throw new AppError(`Invalid role '${role}'. Valid roles: ${USER_ROLES.join(', ')}`, 400);
    }

    if (req.user?.id === id && role !== 'admin') {
      throw new AppError('Admin cannot demote their own account.', 400);
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError(`User with ID '${id}' not found`, 404);
    }

    user.role = role;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User role updated to ${role}`,
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete a user account
 * @access  Private (Admin only)
 */
export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    const { id } = req.params;

    if (req.user?.id === id) {
      throw new AppError('Admin cannot delete their own account.', 400);
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      throw new AppError(`User with ID '${id}' not found`, 404);
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/admin/listings
 * @desc    Get all listings across platform
 * @access  Private (Admin only)
 */
export const getAdminListings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    const { page, limit, status, search } = req.query as {
      page?: string;
      limit?: string;
      status?: string;
      search?: string;
    };

    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '10', 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ title: regex }, { 'address.city': regex }, { 'address.street': regex }];
    }

    const [listings, totalResults] = await Promise.all([
      ParkingListing.find(filter)
        .populate('ownerId', 'name email phoneNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ParkingListing.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalResults / limitNum) || 1;

    res.status(200).json({
      success: true,
      data: {
        listings: normalizeEntities(listings as any),
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalResults,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/admin/listings/:id/status
 * @desc    Change listing status
 * @access  Private (Admin only)
 */
export const updateListingStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    const { id } = req.params;
    const { status } = req.body;

    const listing = await ParkingListing.findById(id);
    if (!listing) {
      throw new AppError(`Listing with ID '${id}' not found`, 404);
    }

    listing.status = status;
    await listing.save();

    res.status(200).json({
      success: true,
      message: `Listing status updated to ${status}`,
      data: {
        listing,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/admin/bookings
 * @desc    Get all platform bookings
 * @access  Private (Admin only)
 */
export const getAdminBookings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    const { page, limit, status } = req.query as {
      page?: string;
      limit?: string;
      status?: string;
    };

    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '10', 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    const [bookings, totalResults] = await Promise.all([
      Booking.find(filter)
        .populate('userId', 'name email phoneNumber')
        .populate('listingId', 'title address hourlyRate ownerId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Booking.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalResults / limitNum) || 1;

    res.status(200).json({
      success: true,
      data: {
        bookings: normalizeEntities(bookings as any),
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalResults,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

