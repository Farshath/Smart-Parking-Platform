import { Router } from 'express';
import {
  getMyPayments,
  getPaymentById,
  processPayment,
} from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import {
  getPaymentByIdSchema,
  myPaymentsQuerySchema,
  processPaymentSchema,
} from '../validators/payment.validator';

const router = Router();

// All payment routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/payments/process
 * @desc    Simulate or execute payment for a booking
 * @access  Private
 */
router.post('/process', validate(processPaymentSchema), processPayment);

/**
 * @route   GET /api/payments/my-payments
 * @desc    Get user's payment history
 * @access  Private
 */
router.get('/my-payments', validate(myPaymentsQuerySchema), getMyPayments);

/**
 * @route   GET /api/payments/:id
 * @desc    Get specific payment receipt
 * @access  Private
 */
router.get('/:id', validate(getPaymentByIdSchema), getPaymentById);

export default router;

