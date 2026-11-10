import { Router } from 'express';
import {
  createListing,
  deleteListing,
  getListingById,
  getListings,
  getMyListings,
  getOwnerAnalytics,
  updateListing,
} from '../controllers/listing.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import {
  createListingSchema,
  getListingByIdSchema,
  searchListingsSchema,
  updateListingSchema,
} from '../validators/listing.validator';

const router = Router();

/**
 * @route   GET /api/listings
 * @desc    Search and paginate parking listings
 * @access  Public
 */
router.get('/', validate(searchListingsSchema), getListings);

/**
 * @route   GET /api/listings/my-listings
 * @desc    Get listings owned by the logged-in owner
 * @access  Private (Owner/Admin)
 */
router.get(
  '/my-listings',
  authenticate,
  authorize('parking_owner', 'admin'),
  getMyListings
);

/**
 * @route   GET /api/listings/analytics/owner
 * @desc    Get owner analytics and statistics
 * @access  Private (Owner/Admin)
 */
router.get(
  '/analytics/owner',
  authenticate,
  authorize('parking_owner', 'admin'),
  getOwnerAnalytics
);

/**
 * @route   GET /api/listings/:id
 * @desc    Get detailed information for a single parking listing
 * @access  Public
 */
router.get('/:id', validate(getListingByIdSchema), getListingById);

/**
 * @route   POST /api/listings
 * @desc    Create a parking listing
 * @access  Private (Restricted to parking_owner and admin)
 */
router.post(
  '/',
  authenticate,
  authorize('parking_owner', 'admin'),
  validate(createListingSchema),
  createListing
);

/**
 * @route   PATCH /api/listings/:id
 * @desc    Update a parking listing
 * @access  Private (Owner/Admin)
 */
router.patch(
  '/:id',
  authenticate,
  authorize('parking_owner', 'admin'),
  validate(updateListingSchema),
  updateListing
);

/**
 * @route   DELETE /api/listings/:id
 * @desc    Delete a parking listing
 * @access  Private (Owner/Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('parking_owner', 'admin'),
  deleteListing
);

export default router;
