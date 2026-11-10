import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Booking } from '../models/Booking';
import { Payment } from '../models/Payment';
import { AppError } from '../utils/AppError';
import { normalizeEntity, normalizeEntities } from '../utils/normalize';
import { atomicReleaseSlot, atomicReserveSlot } from '../utils/capacity';

/**
 * Asserts MongoDB is connected before attempting operations.
 */
const assertDatabaseConnected = () => {
  if (mongoose.connection.readyState !== 1) {
    throw new AppError(
      'Database is not connected. Configure MONGODB_URI in your environment (.env) to enable payments.',
      503
    );
  }
};

/**
 * @route   POST /api/payments/process
 * @desc    Process simulated or gateway payment for an active reservation
 * @access  Private (Customer or Admin)
 */
export const processPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }

    const { bookingId, paymentMethod, simulateFailure } = req.body;
    const userId = new mongoose.Types.ObjectId(req.user.id);

    // 1. Fetch booking
    const booking = await Booking.findById(bookingId).populate('listingId', 'title hourlyRate address');
    if (!booking) {
      throw new AppError(`Booking with ID '${bookingId}' not found`, 404);
    }

    // Verify ownership
    if (booking.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      throw new AppError('Forbidden: You can only pay for your own reservations', 403);
    }

    if (booking.status === 'cancelled') {
      throw new AppError('Cannot process payment for a cancelled booking', 400);
    }

    if (booking.paymentStatus === 'paid') {
      throw new AppError('This booking has already been paid for.', 400);
    }

    // 2. Generate unique transaction ID
    const transactionId =
      'SIM-TXN-' +
      Date.now().toString(36).toUpperCase() +
      '-' +
      Math.random().toString(36).substring(2, 8).toUpperCase();

    const isSimulatedFail = Boolean(simulateFailure);
    const listingObjectId = (booking.listingId as any)?._id || booking.listingId;
    let reReservedSlot = false;

    // If payment is expected to succeed and capacity is not currently held (e.g., retry after failed payment),
    // reserve a slot atomically BEFORE recording payment completion.
    if (!isSimulatedFail && !booking.capacityReserved) {
      const reserved = await atomicReserveSlot(listingObjectId);
      if (!reserved) {
        throw new AppError(
          'All available parking slots for this listing are currently full. Payment was not charged.',
          409
        );
      }
      reReservedSlot = true;
    }

    // 3. Create payment document
    const payment = new Payment({
      bookingId: booking._id,
      userId,
      amount: booking.totalAmount,
      currency: 'INR',
      paymentMethod: paymentMethod || 'simulated_test',
      status: isSimulatedFail ? 'failed' : 'completed',
      transactionId,
      paidAt: isSimulatedFail ? undefined : new Date(),
      failureReason: isSimulatedFail
        ? 'Simulated card declined: simulated test failure option selected for demonstration.'
        : undefined,
      gatewayResponse: {
        gateway: 'Simulated Sandbox Payment Gateway',
        environment: 'Demonstration / Internship Sandbox',
        mode: 'simulated_instant_settlement',
        timestamp: new Date().toISOString(),
        isSimulated: true,
      },
    });

    try {
      await payment.save();
    } catch (err) {
      if (reReservedSlot) {
        await atomicReleaseSlot(listingObjectId);
      }
      throw err;
    }

    // 4. Update booking record & release held capacity if payment failed
    if (isSimulatedFail) {
      const previous = await Booking.findOneAndUpdate(
        { _id: booking._id, paymentStatus: { $ne: 'paid' } },
        {
          $set: {
            paymentStatus: 'failed',
            status: 'pending',
            capacityReserved: false,
          },
        },
        { new: false }
      );

      if (previous && previous.capacityReserved) {
        await atomicReleaseSlot(listingObjectId);
      }
    } else {
      await Booking.findOneAndUpdate(
        { _id: booking._id },
        {
          $set: {
            paymentStatus: 'paid',
            status: 'confirmed',
            paymentId: payment._id,
            capacityReserved: true,
          },
        }
      );
    }

    const updatedBooking = await Booking.findById(booking._id)
      .populate('listingId', 'title hourlyRate address totalSlots availableSlots')
      .lean();

    res.status(200).json({
      success: !isSimulatedFail,
      message: isSimulatedFail
        ? 'Payment simulation failed as requested. Held parking slot capacity has been released.'
        : 'Payment processed and verified successfully (Simulated Demonstration).',
      data: {
        payment: normalizeEntity(payment.toJSON()),
        booking: normalizeEntity(updatedBooking as any),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/payments/my-payments
 * @desc    Get authenticated user's payment transaction history
 * @access  Private
 */
export const getMyPayments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    assertDatabaseConnected();

    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }

    const { page, limit, status } = req.query as {
      page?: number;
      limit?: number;
      status?: string;
    };

    const pageNum = page || 1;
    const limitNum = limit || 10;
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = { userId: req.user.id };
    if (status && status !== 'all') {
      filter.status = status;
    }

    const [payments, totalResults] = await Promise.all([
      Payment.find(filter)
        .populate({
          path: 'bookingId',
          select: 'bookingReference startTime endTime totalAmount status listingId',
          populate: {
            path: 'listingId',
            select: 'title address',
          },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Payment.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalResults / limitNum) || 1;

    res.status(200).json({
      success: true,
      data: {
        payments: normalizeEntities(payments as any),
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
 * @route   GET /api/payments/:id
 * @desc    Get detailed payment receipt
 * @access  Private
 */
export const getPaymentById = async (
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

    const payment = await Payment.findById(id)
      .populate('userId', 'name email phoneNumber')
      .populate({
        path: 'bookingId',
        populate: {
          path: 'listingId',
          select: 'title address hourlyRate ownerId',
        },
      })
      .lean();

    if (!payment) {
      throw new AppError(`Payment record with ID '${id}' not found`, 404);
    }

    // Ownership check: Customer, Owner of listing, or Admin
    const isCustomer = (payment.userId as any)._id?.toString() === req.user.id;
    const booking = payment.bookingId as any;
    const isOwner = booking?.listingId?.ownerId?.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isCustomer && !isOwner && !isAdmin) {
      throw new AppError('Forbidden: You do not have access to view this payment', 403);
    }

    res.status(200).json({
      success: true,
      data: {
        payment: normalizeEntity(payment as any),
      },
    });
  } catch (error) {
    next(error);
  }
};

