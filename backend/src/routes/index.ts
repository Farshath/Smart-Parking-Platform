import { Router } from 'express';
import authRoutes from './auth.routes';
import bookingRoutes from './booking.routes';
import healthRoutes from './health.routes';
import listingRoutes from './listing.routes';
import paymentRoutes from './payment.routes';
import adminRoutes from './admin.routes';

const router = Router();

// Mount module routes
router.use('/auth', authRoutes);
router.use('/bookings', bookingRoutes);
router.use('/health', healthRoutes);
router.use('/listings', listingRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);

export default router;
