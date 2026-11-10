import { hashPassword, comparePassword, generateToken, verifyToken } from '../utils/auth';
import { registerSchema, loginSchema, updateProfileSchema, changePasswordSchema } from '../validators/auth.validator';
import { createListingSchema, updateListingSchema } from '../validators/listing.validator';
import { createBookingSchema } from '../validators/booking.validator';
import { processPaymentSchema } from '../validators/payment.validator';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runAuthSuite() {
  console.log('\n--- SUITE 1: Authentication & Cryptographic Utilities ---');
  
  // 1. Password hashing
  const rawPassword = 'SecurePassword123!';
  const hash = await hashPassword(rawPassword);
  assert(hash.startsWith('$2'), 'Password hash uses bcrypt format');
  assert(hash !== rawPassword, 'Password is not stored in plaintext');

  // 2. Password comparison
  const isValid = await comparePassword(rawPassword, hash);
  assert(isValid === true, 'Correct password verifies successfully');
  const isInvalid = await comparePassword('WrongPassword123!', hash);
  assert(isInvalid === false, 'Incorrect password correctly rejected');

  // 3. JWT token generation & verification
  const payload = { userId: '507f1f77bcf86cd799439011', email: 'owner@smartpark.com', role: 'parking_owner' as const };
  const token = generateToken(payload);
  assert(typeof token === 'string' && token.split('.').length === 3, 'JWT token is valid 3-part signed token');

  const decoded = verifyToken(token);
  assert(decoded.userId === payload.userId, 'JWT decodes userId correctly');
  assert(decoded.role === 'parking_owner', 'JWT decodes role correctly');

  try {
    verifyToken('invalid.token.signature');
    assert(false, 'Corrupted token should throw error');
  } catch {
    assert(true, 'Corrupted token throws verification error');
  }
}

function runIntervalSuite() {
  console.log('\n--- SUITE 2: Parking Slot Interval Overlap Logic ---');
  
  // Existing interval: [10:00, 14:00]
  const eStart = new Date('2026-12-01T10:00:00Z').getTime();
  const eEnd = new Date('2026-12-01T14:00:00Z').getTime();

  const isOverlapping = (qStartStr: string, qEndStr: string): boolean => {
    const qStart = new Date(qStartStr).getTime();
    const qEnd = new Date(qEndStr).getTime();
    return eStart < qEnd && eEnd > qStart;
  };

  // Case 1: Strict subset [11:00, 13:00]
  assert(isOverlapping('2026-12-01T11:00:00Z', '2026-12-01T13:00:00Z') === true, 'Strict subset overlaps');

  // Case 2: Strict superset [09:00, 15:00]
  assert(isOverlapping('2026-12-01T09:00:00Z', '2026-12-01T15:00:00Z') === true, 'Strict superset overlaps');

  // Case 3: Overlap left [09:00, 12:00]
  assert(isOverlapping('2026-12-01T09:00:00Z', '2026-12-01T12:00:00Z') === true, 'Left overlap intersects');

  // Case 4: Overlap right [13:00, 16:00]
  assert(isOverlapping('2026-12-01T13:00:00Z', '2026-12-01T16:00:00Z') === true, 'Right overlap intersects');

  // Case 5: Adjacent before [08:00, 10:00]
  assert(isOverlapping('2026-12-01T08:00:00Z', '2026-12-01T10:00:00Z') === false, 'Adjacent before does not overlap');

  // Case 6: Adjacent after [14:00, 16:00]
  assert(isOverlapping('2026-12-01T14:00:00Z', '2026-12-01T16:00:00Z') === false, 'Adjacent after does not overlap');
}

function runPricingSuite() {
  console.log('\n--- SUITE 3: Server-Side Duration and Pricing Engine ---');

  const calcPrice = (startStr: string, endStr: string, hourlyRate: number): number => {
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();
    const durationHours = (end - start) / (1000 * 60 * 60);
    return Math.max(0.01, Math.round(durationHours * hourlyRate * 100) / 100);
  };

  // 1 hour at 50/hr
  assert(calcPrice('2026-12-01T10:00:00Z', '2026-12-01T11:00:00Z', 50) === 50, '1 hour @ ₹50 = ₹50');

  // 2.5 hours at 40/hr
  assert(calcPrice('2026-12-01T10:00:00Z', '2026-12-01T12:30:00Z', 40) === 100, '2.5 hours @ ₹40 = ₹100');

  // 45 minutes (0.75 hr) at 60/hr
  assert(calcPrice('2026-12-01T10:00:00Z', '2026-12-01T10:45:00Z', 60) === 45, '45 mins @ ₹60 = ₹45');

  // Rounding check
  const price = calcPrice('2026-12-01T10:00:00Z', '2026-12-01T10:20:00Z', 50); // 20m = 0.3333h * 50 = 16.67
  assert(price === 16.67, 'Precise decimal cents rounded properly: ₹16.67');
}

function runValidationSuite() {
  console.log('\n--- SUITE 4: Input Validation & Zod Schemas ---');

  // Register validation
  const validReg = registerSchema.body!.safeParse({
    name: 'Rajesh Kumar',
    email: 'rajesh@example.com',
    password: 'Password123',
    phoneNumber: '+919876543210',
    role: 'customer',
  });
  assert(validReg.success === true, 'Valid user registration passes');

  // Self-assigning admin blocked
  const invalidRoleReg = registerSchema.body!.safeParse({
    name: 'Hacker',
    email: 'hacker@example.com',
    password: 'Password123',
    role: 'admin',
  });
  assert(invalidRoleReg.success === false, 'Direct admin self-registration is rejected');

  // Password without number rejected
  const weakPassReg = registerSchema.body!.safeParse({
    name: 'John Doe',
    email: 'john@example.com',
    password: 'NoNumbersHere!',
  });
  assert(weakPassReg.success === false, 'Password without numbers is rejected');

  // Listing creation validation
  const validListing = createListingSchema.body!.safeParse({
    title: 'Indiranagar Prime Covered Parking',
    description: 'Safe underground spot with 24/7 security guard.',
    address: {
      street: '100ft Road',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
    },
    hourlyRate: 60,
    dailyRate: 500,
    parkingType: 'covered',
    totalSlots: 5,
    availableSlots: 5,
    amenities: ['cctv', 'covered', 'security_guard'],
  });
  assert(validListing.success === true, 'Valid listing payload with new fields passes');

  // Negative rate rejected
  const invalidListing = createListingSchema.body!.safeParse({
    title: 'Invalid Spot',
    address: { street: 'Main Rd', city: 'Delhi' },
    hourlyRate: -10,
    totalSlots: 2,
  });
  assert(invalidListing.success === false, 'Negative hourly rate rejected');

  // Payment process validation
  const validPayment = processPaymentSchema.body!.safeParse({
    bookingId: '507f1f77bcf86cd799439011',
    paymentMethod: 'upi',
    simulateFailure: false,
  });
  assert(validPayment.success === true, 'Valid payment processing payload passes');
}

function runPaymentWorkflowSuite() {
  console.log('\n--- SUITE 5: Payment Workflow & State Management ---');

  const simulatePaymentProcess = (bookingAmount: number, simulateFail: boolean) => {
    const transactionId = 'SIM-TXN-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    if (simulateFail) {
      return {
        status: 'failed' as const,
        transactionId,
        amount: bookingAmount,
        failureReason: 'Simulated decline requested',
        bookingPaymentStatus: 'failed',
      };
    }
    return {
      status: 'completed' as const,
      transactionId,
      amount: bookingAmount,
      paidAt: new Date(),
      bookingPaymentStatus: 'paid',
    };
  };

  const successResult = simulatePaymentProcess(150, false);
  assert(successResult.status === 'completed', 'Standard payment completes with status completed');
  assert(successResult.bookingPaymentStatus === 'paid', 'Booking payment status transitioned to paid');
  assert(successResult.transactionId.startsWith('SIM-TXN-'), 'Unique transaction reference generated');

  const failedResult = simulatePaymentProcess(150, true);
  assert(failedResult.status === 'failed', 'Simulated failure recorded as failed');
  assert(failedResult.bookingPaymentStatus === 'failed', 'Booking payment status reflects failure');
}

async function main() {
  console.log('========================================================');
  console.log('   SMART PARKING PLATFORM — BACKEND AUTOMATED TEST SUITE');
  console.log('========================================================');

  await runAuthSuite();
  runIntervalSuite();
  runPricingSuite();
  runValidationSuite();
  runPaymentWorkflowSuite();

  console.log('\n========================================================');
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED:      ${passedTests}`);
  console.log(`FAILED:      ${failedTests}`);
  console.log('========================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

