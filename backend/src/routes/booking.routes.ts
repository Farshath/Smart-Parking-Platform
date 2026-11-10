import { Router } from 'express';
import {
  cancelBooking,
  createBooking,
  getBookingById,
  getMyBookings,
  updateBookingStatus,
} from '../controllers/booking.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import {
  cancelBookingSchema,
  createBookingSchema,
  getBookingByIdSchema,
  myBookingsQuerySchema,
  updateBookingStatusSchema,
} from '../validators/booking.validator';

const router = Router();

// All booking routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/bookings
 * @desc    Reserve a parking slot with atomic capacity validation
 * @access  Private (Authenticated users)
 */
router.post('/', validate(createBookingSchema), createBooking);

/**
 * @route   GET /api/bookings/my-bookings
 * @desc    Get user's bookings with pagination
 * @access  Private (Authenticated users)
 */
router.get('/my-bookings', validate(myBookingsQuerySchema), getMyBookings);

/**
 * @route   GET /api/bookings/:id
 * @desc    Get details of a single booking
 * @access  Private (Booking Customer, Listing Owner, Admin)
 */
router.get('/:id', validate(getBookingByIdSchema), getBookingById);

/**
 * @route   PATCH /api/bookings/:id/cancel
 * @desc    Cancel a booking
 * @access  Private (Booking Customer, Listing Owner, Admin)
 */
router.patch('/:id/cancel', validate(cancelBookingSchema), cancelBooking);

/**
 * @route   PATCH /api/bookings/:id/status
 * @desc    Update a booking's status (Owner / Admin)
 * @access  Private (Owner, Admin)
 */
router.patch(
  '/:id/status',
  validate(updateBookingStatusSchema),
  updateBookingStatus
);

export default router;
