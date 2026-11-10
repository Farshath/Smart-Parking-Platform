import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Booking } from '../models/Booking';
import { ParkingListing } from '../models/ParkingListing';
import { AppError } from '../utils/AppError';
import { normalizeEntity, normalizeEntities } from '../utils/normalize';
import { atomicReleaseSlot, atomicReserveSlot } from '../utils/capacity';

/**
 * Asserts MongoDB is connected before attempting operations.
 */
const assertDatabaseConnected = () => {
  if (mongoose.connection.readyState !== 1) {
    throw new AppError(
      'Database is not connected. Configure MONGODB_URI in your environment (.env) to enable bookings.',
      503
    );
  }
};

/**
 * @route   POST /api/bookings
 * @desc    Create a new parking slot reservation with atomic concurrency-safe capacity deduction
 * @access  Private (Authenticated users)
 */
export const createBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let slotReservedForListingId: mongoose.Types.ObjectId | null = null;

  try {
    assertDatabaseConnected();

    if (!req.user) {
      throw new AppError('Unauthorized. Authentication required.', 401);
    }

    const { listingId, startTime, endTime, vehicleNumber } = req.body;
    const rawIdempotencyKey =
      req.body.idempotencyKey || (req.headers['x-idempotency-key'] as string | undefined);
    const idempotencyKey = rawIdempotencyKey ? rawIdempotencyKey.trim() : undefined;

    const userId = new mongoose.Types.ObjectId(req.user.id);
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    // 1. Idempotency / duplicate-submission guard (never deducts capacity twice)
    if (idempotencyKey) {
      const existingByKey = await Booking.findOne({ userId, idempotencyKey }).populate(
        'listingId',
        'title address hourlyRate totalSlots availableSlots'
      );
      if (existingByKey) {
        res.status(200).json({
          success: true,
          message: 'Reservation already confirmed (duplicate request prevented).',
          data: {
            booking: normalizeEntity(existingByKey.toJSON()),
          },
        });
        return;
      }
    }

    const existingIdentical = await Booking.findOne({
      userId,
      listingId,
      startTime: startDate,
      endTime: endDate,
      status: { $in: ['pending', 'confirmed'] },
    }).populate('listingId', 'title address hourlyRate totalSlots availableSlots');

    if (existingIdentical) {
      res.status(200).json({
        success: true,
        message: 'Reservation already exists for this timeframe.',
        data: {
          booking: normalizeEntity(existingIdentical.toJSON()),
        },
      });
      return;
    }

    // 2. Fetch the parking listing
    const listing = await ParkingListing.findById(listingId);
    if (!listing) {
      throw new AppError(`Parking listing with ID '${listingId}' not found`, 404);
    }

    if (listing.status !== 'active') {
      throw new AppError(
        `Parking listing is currently '${listing.status}' and not accepting reservations.`,
        400
      );
    }

    // 3. Prevent owners from booking their own spaces
    if (listing.ownerId.toString() === req.user.id) {
      throw new AppError('You cannot reserve parking in your own listing.', 400);
    }

    // 4. Reject immediately if no physical capacity remains
    if (listing.availableSlots <= 0) {
      throw new AppError(
        'No available parking slots remain for this location.',
        409
      );
    }

    // 5. Time-overlap capacity check
    const overlappingFilter = {
      listingId: listing._id,
      status: { $in: ['pending', 'confirmed'] },
      startTime: { $lt: endDate },
      endTime: { $gt: startDate },
    };

    const activeOverlappingCount = await Booking.countDocuments(overlappingFilter);
    if (activeOverlappingCount >= listing.totalSlots) {
      throw new AppError(
        `All ${listing.totalSlots} parking slot(s) for this listing are fully booked during the selected timeframe.`,
        409
      );
    }

    // 6. Server-side price calculation based on verified hourlyRate and duration
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    const totalAmount = Math.max(0.01, Math.round(durationHours * listing.hourlyRate * 100) / 100);

    // 7. Atomic slot deduction (prevents overselling on simultaneous last-slot requests)
    const reservedListing = await atomicReserveSlot(listing._id);
    if (!reservedListing) {
      throw new AppError(
        'All available parking slots were just reserved by another customer. Please choose another spot or try again later.',
        409
      );
    }
    slotReservedForListingId = listing._id;

    // Unique booking reference
    const bookingReference =
      'BK-' +
      Date.now().toString(36).toUpperCase() +
      '-' +
      Math.random().toString(36).substring(2, 6).toUpperCase();

    // 8. Persist the confirmed booking with capacityReserved: true
    const booking = new Booking({
      bookingReference,
      userId,
      listingId: listing._id,
      startTime: startDate,
      endTime: endDate,
      totalAmount,
      status: 'confirmed',
      paymentStatus: 'pending',
      capacityReserved: true,
      idempotencyKey,
      vehicleNumber: vehicleNumber || undefined,
    });

    try {
      await booking.save();
    } catch (saveError: any) {
      // Handle race on identical idempotencyKey
      if (saveError?.code === 11000 && idempotencyKey) {
        await atomicReleaseSlot(listing._id);
        slotReservedForListingId = null;

        const existingRace = await Booking.findOne({ userId, idempotencyKey }).populate(
          'listingId',
          'title address hourlyRate totalSlots availableSlots'
        );
        if (existingRace) {
          res.status(200).json({
            success: true,
            message: 'Reservation already confirmed.',
            data: {
              booking: normalizeEntity(existingRace.toJSON()),
            },
          });
          return;
        }
      }
      throw saveError;
    }

    // 9. Post-insert concurrency verification against time-overlap limit
    const postInsertCount = await Booking.countDocuments(overlappingFilter);
    if (postInsertCount > listing.totalSlots) {
      await Booking.findByIdAndDelete(booking._id);
      await atomicReleaseSlot(listing._id);
      slotReservedForListingId = null;
      throw new AppError(
        'Concurrent reservation conflict: all available slots were reserved by simultaneous requests. Please select another time.',
        409
      );
    }

    slotReservedForListingId = null;

    // Populate updated listing availability for immediate client display
    await booking.populate('listingId', 'title address hourlyRate totalSlots availableSlots');

    res.status(201).json({
      success: true,
      message: 'Parking slot booked successfully',
      data: {
        booking: normalizeEntity(booking.toJSON()),
        listingAvailability: {
          listingId: reservedListing._id.toString(),
          totalSlots: reservedListing.totalSlots,
          availableSlots: reservedListing.availableSlots,
        },
      },
    });
  } catch (error) {
    // Safety rollback if an error occurred after deducting capacity
    if (slotReservedForListingId) {
      await atomicReleaseSlot(slotReservedForListingId).catch((rollbackErr) => {
        console.error('[Capacity Rollback Error]:', rollbackErr);
      });
    }
    next(error);
  }
};

/**
 * @route   GET /api/bookings/my-bookings
 * @desc    Get paginated bookings belonging to the authenticated user (or owned listings)
 * @access  Private (Authenticated users)
 */
export const getMyBookings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }

    const { page, limit, status, roleView } = req.query as {
      page?: number;
      limit?: number;
      status?: string;
      roleView?: 'owner' | 'customer';
    };

    const pageNum = page || 1;
    const limitNum = limit || 10;
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = {};

    if (roleView === 'owner' && (req.user.role === 'parking_owner' || req.user.role === 'admin')) {
      const ownedListings = await ParkingListing.find({ ownerId: req.user.id }).select('_id');
      const listingIds = ownedListings.map((l) => l._id);
      filter.listingId = { $in: listingIds };
    } else {
      filter.userId = req.user.id;
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    const [bookings, totalResults] = await Promise.all([
      Booking.find(filter)
        .populate('listingId', 'title address hourlyRate totalSlots availableSlots ownerId')
        .populate('userId', 'name email phoneNumber')
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

/**
 * @route   GET /api/bookings/:id
 * @desc    Get detailed information for a single booking
 * @access  Private (Customer who booked, Listing owner, or Admin)
 */
export const getBookingById = async (
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

    const booking = await Booking.findById(id)
      .populate('listingId', 'title address hourlyRate totalSlots availableSlots ownerId')
      .populate('userId', 'name email phoneNumber')
      .lean();

    if (!booking) {
      throw new AppError(`Booking with ID '${id}' not found`, 404);
    }

    const isCustomer = booking.userId && (booking.userId as any)._id?.toString() === req.user.id;
    const listing = booking.listingId as any;
    const isOwner = listing && listing.ownerId?.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isCustomer && !isOwner && !isAdmin) {
      throw new AppError('Forbidden. You do not have permission to view this booking.', 403);
    }

    res.status(200).json({
      success: true,
      data: {
        booking: normalizeEntity(booking as any),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/bookings/:id/cancel
 * @desc    Cancel an active booking and atomically restore reserved capacity once
 * @access  Private (Customer who booked, Listing owner, or Admin)
 */
export const cancelBooking = async (
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
    const { reason } = req.body || {};

    const booking = await Booking.findById(id).populate(
      'listingId',
      'ownerId title address hourlyRate totalSlots availableSlots'
    );
    if (!booking) {
      throw new AppError(`Booking with ID '${id}' not found`, 404);
    }

    const isCustomer = booking.userId.toString() === req.user.id;
    const listing = booking.listingId as any;
    const isOwner = listing && listing.ownerId?.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isCustomer && !isOwner && !isAdmin) {
      throw new AppError('Forbidden. You do not have permission to cancel this booking.', 403);
    }

    // Idempotency: Already cancelled bookings never restore capacity twice
    if (booking.status === 'cancelled') {
      res.status(200).json({
        success: true,
        message: 'Booking is already cancelled.',
        data: {
          booking: normalizeEntity(booking.toJSON()),
        },
      });
      return;
    }

    if (booking.status === 'completed') {
      throw new AppError('Cannot cancel a booking that has already been completed.', 409);
    }

    if (new Date(booking.endTime) <= new Date()) {
      throw new AppError('Cannot cancel a booking after its scheduled end time has passed.', 409);
    }

    // Atomic state transition: ensures concurrent cancel calls restore capacity at most once
    const previousBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        status: { $in: ['pending', 'confirmed'] },
      },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason: reason || `Cancelled by ${req.user.role}`,
          capacityReserved: false,
        },
      },
      { new: false }
    );

    if (previousBooking && previousBooking.capacityReserved) {
      await atomicReleaseSlot(previousBooking.listingId);
    }

    const updatedBooking = await Booking.findById(booking._id)
      .populate('listingId', 'ownerId title address hourlyRate totalSlots availableSlots')
      .lean();

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        booking: normalizeEntity(updatedBooking as any),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/bookings/:id/status
 * @desc    Update booking status (approve/confirm, reject/cancel, complete) with safe capacity sync
 * @access  Private (Listing owner or Admin)
 */
export const updateBookingStatus = async (
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
    const { status, reason } = req.body;

    const booking = await Booking.findById(id).populate('listingId', 'ownerId title');
    if (!booking) {
      throw new AppError(`Booking with ID '${id}' not found`, 404);
    }

    const listing = booking.listingId as any;
    const isOwner = listing && listing.ownerId?.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new AppError(
        'Forbidden: Only the parking owner or admin can update this booking status',
        403
      );
    }

    // Idempotency: no-op if already in requested status
    if (booking.status === status) {
      const current = await Booking.findById(booking._id)
        .populate('listingId', 'ownerId title address hourlyRate totalSlots availableSlots')
        .populate('userId', 'name email phoneNumber')
        .lean();
      res.status(200).json({
        success: true,
        message: `Booking status is already '${status}'`,
        data: {
          booking: normalizeEntity(current as any),
        },
      });
      return;
    }

    // Approving/confirming a booking that has not yet reserved capacity
    if (status === 'confirmed' && !booking.capacityReserved) {
      const reservedListing = await atomicReserveSlot(listing._id || booking.listingId);
      if (!reservedListing) {
        throw new AppError(
          'No available parking slots remain to confirm this reservation.',
          409
        );
      }

      const updated = await Booking.findOneAndUpdate(
        { _id: booking._id, status: booking.status },
        { $set: { status: 'confirmed', capacityReserved: true } },
        { new: true }
      )
        .populate('listingId', 'ownerId title address hourlyRate totalSlots availableSlots')
        .populate('userId', 'name email phoneNumber')
        .lean();

      if (!updated) {
        await atomicReleaseSlot(listing._id || booking.listingId);
        throw new AppError('Booking status changed concurrently. Please refresh and try again.', 409);
      }

      res.status(200).json({
        success: true,
        message: `Booking status updated to ${status}`,
        data: {
          booking: normalizeEntity(updated as any),
        },
      });
      return;
    }

    // Rejecting (cancelled) or Completing (completed) a booking releases capacity ONLY if held
    const shouldRelease = status === 'cancelled' || status === 'completed';

    const updateSet: Record<string, unknown> = { status };
    if (shouldRelease) {
      updateSet.capacityReserved = false;
    }
    if (status === 'cancelled') {
      updateSet.cancelledAt = new Date();
      updateSet.cancellationReason = reason || 'Rejected by parking owner';
    }

    const previousBooking = await Booking.findOneAndUpdate(
      { _id: booking._id, status: booking.status },
      { $set: updateSet },
      { new: false }
    );

    if (previousBooking && shouldRelease && previousBooking.capacityReserved) {
      await atomicReleaseSlot(previousBooking.listingId);
    }

    const updatedBooking = await Booking.findById(booking._id)
      .populate('listingId', 'ownerId title address hourlyRate totalSlots availableSlots')
      .populate('userId', 'name email phoneNumber')
      .lean();

    res.status(200).json({
      success: true,
      message: `Booking status updated to ${status}`,
      data: {
        booking: normalizeEntity(updatedBooking as any),
      },
    });
  } catch (error) {
    next(error);
  }
};
