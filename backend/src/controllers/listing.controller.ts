import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ParkingListing } from '../models/ParkingListing';
import { AppError } from '../utils/AppError';
import { normalizeEntity, normalizeEntities } from '../utils/normalize';

/**
 * Ensures MongoDB is connected before attempting operations.
 */
const assertDatabaseConnected = () => {
  if (mongoose.connection.readyState !== 1) {
    throw new AppError(
      'Database is not connected. Configure MONGODB_URI in your environment (.env) to enable persistence.',
      503
    );
  }
};

/**
 * @route   GET /api/listings
 * @desc    Get paginated parking listings with search and filter parameters
 * @access  Public
 */
export const getListings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    const query = req.query as {
      page?: number;
      limit?: number;
      search?: string;
      q?: string;
      city?: string;
      minRate?: number;
      maxRate?: number;
      status?: string;
      amenities?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    };

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    // Build Mongoose filter
    const filter: Record<string, unknown> = {};

    // Filter by status (default 'active', allow 'all' to show all)
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }

    // Keyword search across title, description, and city
    const searchTerm = query.search || query.q;
    if (searchTerm) {
      const regex = new RegExp(searchTerm.trim(), 'i');
      filter.$or = [
        { title: regex },
        { description: regex },
        { 'address.city': regex },
        { 'address.street': regex },
      ];
    }

    // Filter by city
    if (query.city) {
      filter['address.city'] = new RegExp(query.city.trim(), 'i');
    }

    // Filter by hourly rate range
    if (query.minRate !== undefined || query.maxRate !== undefined) {
      filter.hourlyRate = {};
      if (query.minRate !== undefined) {
        (filter.hourlyRate as Record<string, number>).$gte = query.minRate;
      }
      if (query.maxRate !== undefined) {
        (filter.hourlyRate as Record<string, number>).$lte = query.maxRate;
      }
    }

    // Filter by amenities
    if (query.amenities) {
      const amenityList = query.amenities
        .split(',')
        .map((a) => a.trim().toLowerCase())
        .filter(Boolean);
      if (amenityList.length > 0) {
        filter.amenities = { $all: amenityList };
      }
    }

    // Sorting
    const sortField = query.sortBy || 'createdAt';
    const sortDirection = query.sortOrder === 'asc' ? 1 : -1;
    const sortOption: Record<string, 1 | -1> = { [sortField]: sortDirection };

    // Execute queries concurrently
    const [listings, totalResults] = await Promise.all([
      ParkingListing.find(filter)
        .populate('ownerId', 'name email role')
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
      ParkingListing.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalResults / limit) || 1;

    res.status(200).json({
      success: true,
      data: {
        listings: normalizeEntities(listings as any),
        pagination: {
          page,
          limit,
          totalResults,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/listings/:id
 * @desc    Get a single parking listing by ID
 * @access  Public
 */
export const getListingById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    const { id } = req.params;

    const listing = await ParkingListing.findById(id)
      .populate('ownerId', 'name email role')
      .lean();

    if (!listing) {
      throw new AppError(`Parking listing with ID '${id}' not found`, 404);
    }

    res.status(200).json({
      success: true,
      data: {
        listing: normalizeEntity(listing as any),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/listings
 * @desc    Create a new parking listing (authenticated parking_owner or admin)
 * @access  Private (parking_owner, admin)
 */
export const createListing = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    if (!req.user) {
      throw new AppError('Unauthorized. You must be authenticated to create a listing.', 401);
    }

    const {
      title,
      description,
      address,
      coordinates,
      hourlyRate,
      dailyRate,
      parkingType,
      operatingHours,
      images,
      totalSlots,
      availableSlots,
      amenities,
      status,
    } = req.body;

    // Securely bind ownerId from authenticated session token
    const ownerId = new mongoose.Types.ObjectId(req.user.id);

    const finalAvailableSlots =
      typeof availableSlots === 'number' ? availableSlots : totalSlots;

    if (finalAvailableSlots > totalSlots) {
      throw new AppError(
        `Available slots (${finalAvailableSlots}) cannot exceed total slots (${totalSlots})`,
        400
      );
    }

    // Build listing document
    const newListing = new ParkingListing({
      ownerId,
      title,
      description: description || '',
      address,
      location: coordinates
        ? {
            type: 'Point',
            coordinates: coordinates.coordinates,
          }
        : undefined,
      hourlyRate,
      dailyRate: dailyRate !== undefined ? dailyRate : Math.round(hourlyRate * 10),
      parkingType: parkingType || 'standard',
      operatingHours: operatingHours || { open: '06:00', close: '23:00', is24_7: false },
      images: images || [],
      totalSlots,
      availableSlots: finalAvailableSlots,
      amenities: amenities || [],
      status: status || 'active',
    });

    await newListing.save();

    res.status(201).json({
      success: true,
      message: 'Parking listing created successfully',
      data: {
        listing: newListing,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/listings/my-listings
 * @desc    Get listings owned by the authenticated owner
 * @access  Private (parking_owner, admin)
 */
export const getMyListings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }

    const { status } = req.query as { status?: string };
    const filter: Record<string, unknown> = { ownerId: req.user.id };

    if (status && status !== 'all') {
      filter.status = status;
    }

    const listings = await ParkingListing.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const listingIds = listings.map((l: any) => l._id);
    const { Booking } = await import('../models/Booking');
    const activeCounts = await Booking.aggregate([
      {
        $match: {
          listingId: { $in: listingIds },
          status: { $in: ['pending', 'confirmed'] },
        },
      },
      {
        $group: {
          _id: '$listingId',
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map<string, number>();
    for (const row of activeCounts) {
      countMap.set(row._id.toString(), row.count);
    }

    const enrichedListings = normalizeEntities(listings as any).map((l: any) => ({
      ...l,
      activeReservationsCount: countMap.get(l.id) || 0,
    }));

    res.status(200).json({
      success: true,
      data: {
        listings: enrichedListings,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/listings/:id
 * @desc    Update a parking listing (Owner or Admin)
 * @access  Private (parking_owner, admin)
 */
export const updateListing = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }

    const { id } = req.params;
    const listing = await ParkingListing.findById(id);

    if (!listing) {
      throw new AppError(`Parking listing with ID '${id}' not found`, 404);
    }

    const isOwner = listing.ownerId.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden: You can only edit your own listings', 403);
    }

    const {
      title,
      description,
      address,
      coordinates,
      hourlyRate,
      dailyRate,
      parkingType,
      operatingHours,
      images,
      totalSlots,
      availableSlots,
      amenities,
      status,
    } = req.body;

    if (title !== undefined) listing.title = title;
    if (description !== undefined) listing.description = description;
    if (address !== undefined) {
      listing.address = {
        ...listing.address,
        ...address,
      };
    }
    if (coordinates !== undefined) {
      listing.location = {
        type: 'Point',
        coordinates: coordinates.coordinates,
      };
    }
    if (hourlyRate !== undefined) listing.hourlyRate = hourlyRate;
    if (dailyRate !== undefined) listing.dailyRate = dailyRate;
    if (parkingType !== undefined) listing.parkingType = parkingType;
    if (operatingHours !== undefined) {
      listing.operatingHours = {
        open: operatingHours.open ?? listing.operatingHours?.open ?? '06:00',
        close: operatingHours.close ?? listing.operatingHours?.close ?? '23:00',
        is24_7: operatingHours.is24_7 ?? listing.operatingHours?.is24_7 ?? false,
      };
    }
    if (images !== undefined) listing.images = images;
    if (amenities !== undefined) listing.amenities = amenities;
    if (status !== undefined) listing.status = status;

    if (totalSlots !== undefined) {
      listing.totalSlots = totalSlots;
      if (availableSlots === undefined && listing.availableSlots > totalSlots) {
        listing.availableSlots = totalSlots;
      }
    }
    if (availableSlots !== undefined) {
      if (availableSlots > listing.totalSlots) {
        throw new AppError(
          `Available slots (${availableSlots}) cannot exceed total slots (${listing.totalSlots})`,
          400
        );
      }
      listing.availableSlots = availableSlots;
    }

    await listing.save();

    res.status(200).json({
      success: true,
      message: 'Parking listing updated successfully',
      data: {
        listing,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/listings/:id
 * @desc    Delete or deactivate a parking listing
 * @access  Private (Owner or Admin)
 */
export const deleteListing = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }

    const { id } = req.params;
    const listing = await ParkingListing.findById(id);

    if (!listing) {
      throw new AppError(`Parking listing with ID '${id}' not found`, 404);
    }

    const isOwner = listing.ownerId.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden: You can only delete your own listings', 403);
    }

    await ParkingListing.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Parking listing deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/listings/analytics/owner
 * @desc    Retrieve aggregated metrics and booking stats for the owner
 * @access  Private (parking_owner, admin)
 */
export const getOwnerAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }

    const ownerObjectId = new mongoose.Types.ObjectId(req.user.id);
    const ownedListings = await ParkingListing.find({ ownerId: ownerObjectId });
    const listingIds = ownedListings.map((l) => l._id);

    // Retrieve bookings for these listings
    const { Booking } = await import('../models/Booking');
    const bookings = await Booking.find({ listingId: { $in: listingIds } })
      .populate('userId', 'name email phoneNumber')
      .populate('listingId', 'title address hourlyRate')
      .sort({ createdAt: -1 })
      .lean();

    const totalListings = ownedListings.length;
    const activeListings = ownedListings.filter((l) => l.status === 'active').length;
    const totalSlots = ownedListings.reduce((sum, l) => sum + (l.totalSlots || 0), 0);
    const availableSlots = ownedListings.reduce((sum, l) => sum + (l.availableSlots || 0), 0);

    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter((b) => b.status === 'confirmed').length;
    const pendingBookings = bookings.filter((b) => b.status === 'pending').length;
    const cancelledBookings = bookings.filter((b) => b.status === 'cancelled').length;

    // Calculate revenue from confirmed and completed bookings
    const totalRevenue = bookings
      .filter((b) => b.status === 'confirmed' || b.status === 'completed')
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalListings,
          activeListings,
          totalSlots,
          availableSlots,
          totalBookings,
          confirmedBookings,
          pendingBookings,
          cancelledBookings,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
        },
        recentBookings: normalizeEntities(bookings.slice(0, 10) as any),
      },
    });
  } catch (error) {
    next(error);
  }
};

