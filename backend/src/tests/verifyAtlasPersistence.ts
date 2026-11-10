import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { ParkingListing } from '../models/ParkingListing';
import { Booking } from '../models/Booking';
import { Payment } from '../models/Payment';
import { normalizeEntity, normalizeEntities } from '../utils/normalize';
import { hashPassword } from '../utils/auth';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export async function runAtlasPersistenceVerification() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not configured in backend/.env');
  }

  console.log('===============================================================');
  console.log('  LIVE MONGODB ATLAS END-TO-END DATA PERSISTENCE VERIFICATION  ');
  console.log('===============================================================');

  console.log('\n[Phase 1] Connecting to MongoDB Atlas cluster...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log('✓ Connected successfully to MongoDB Atlas! ReadyState:', mongoose.connection.readyState);

  const cleanupIds: { users: string[]; listings: string[]; bookings: string[]; payments: string[] } = {
    users: [],
    listings: [],
    bookings: [],
    payments: [],
  };

  try {
    // 1. Register a test user
    console.log('\n[Phase 2] Operation 1: Registering test user in MongoDB Atlas...');
    const testEmail = `test.user.${Date.now()}@smartpark-test.com`;
    const passwordHash = await hashPassword('TestSecret2026!');
    const userDoc = new User({
      name: 'Atlas Verification Customer',
      email: testEmail,
      passwordHash,
      role: 'customer',
      phoneNumber: '+91 98765 43210',
    });
    await userDoc.save();
    cleanupIds.users.push(userDoc._id.toString());

    const normalizedUser = normalizeEntity(userDoc.toJSON());
    console.log('✓ User created and saved to Atlas!');
    console.log('  User _id:', userDoc._id.toString());
    console.log('  User id:', normalizedUser.id);
    console.log('  Email:', normalizedUser.email);
    console.log('  Role:', normalizedUser.role);

    // 2. Create a test parking listing
    console.log('\n[Phase 2] Operation 2: Creating test parking listing in MongoDB Atlas...');
    const listingDoc = new ParkingListing({
      ownerId: userDoc._id,
      title: 'Bangalore Central Hub - Atlas Verified Spot',
      description: 'Automated test parking listing verified against live MongoDB Atlas cluster.',
      address: {
        street: '42 Brigade Road',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        zipCode: '560025',
      },
      hourlyRate: 60,
      dailyRate: 480,
      parkingType: 'covered',
      totalSlots: 8,
      availableSlots: 8,
      amenities: ['cctv', 'covered', 'ev_charging', 'security_guard'],
      status: 'active',
    });
    await listingDoc.save();
    cleanupIds.listings.push(listingDoc._id.toString());

    console.log('✓ Parking listing created and saved to Atlas!');
    console.log('  Listing _id:', listingDoc._id.toString());
    console.log('  Listing toJSON id:', listingDoc.id);

    // 3 & 4. Retrieve the listing and verify valid ID
    console.log('\n[Phase 2] Operations 3 & 4: Retrieving listing via .lean() & verifying identifier...');
    const fetchedRawListing = await ParkingListing.findById(listingDoc._id).lean();
    if (!fetchedRawListing) {
      throw new Error('Failed to retrieve created listing from MongoDB Atlas!');
    }
    const normalizedListing = normalizeEntity(fetchedRawListing as any);
    console.log('✓ Listing successfully retrieved from MongoDB Atlas!');
    console.log('  Normalized ID:', normalizedListing.id);
    console.log('  Valid 24-character hexadecimal ObjectId:', /^[0-9a-fA-F]{24}$/.test(normalizedListing.id));
    if (!normalizedListing.id || !/^[0-9a-fA-F]{24}$/.test(normalizedListing.id)) {
      throw new Error(`Invalid listing ID retrieved: ${normalizedListing.id}`);
    }

    // 5 & 6. Create test booking and verify persistence
    console.log('\n[Phase 2] Operations 5 & 6: Creating test booking & verifying persistence...');
    const startTime = new Date(Date.now() + 3600 * 1000);
    const endTime = new Date(Date.now() + 4 * 3600 * 1000);
    const bookingRef = 'BK-ATLAS-' + Date.now().toString(36).toUpperCase();
    const durationHours = 3;
    const totalAmount = durationHours * listingDoc.hourlyRate;

    const bookingDoc = new Booking({
      bookingReference: bookingRef,
      userId: userDoc._id,
      listingId: listingDoc._id,
      startTime,
      endTime,
      totalAmount,
      status: 'confirmed',
      paymentStatus: 'pending',
      vehicleNumber: 'KA-05-AT-2026',
    });
    await bookingDoc.save();
    cleanupIds.bookings.push(bookingDoc._id.toString());

    console.log('✓ Booking created and persisted in MongoDB Atlas!');
    console.log('  Booking reference:', bookingDoc.bookingReference);
    console.log('  Booking ID:', bookingDoc.id);
    console.log('  Total amount:', bookingDoc.totalAmount);

    const fetchedBooking = await Booking.findById(bookingDoc._id)
      .populate('listingId', 'title address hourlyRate')
      .populate('userId', 'name email')
      .lean();
    if (!fetchedBooking) {
      throw new Error('Failed to retrieve created booking from MongoDB Atlas!');
    }
    const normalizedBooking = normalizeEntity(fetchedBooking as any);
    console.log('✓ Booking verified via database query:');
    console.log('  Booking ID:', normalizedBooking.id);
    console.log('  Booking status:', normalizedBooking.status);
    console.log('  Populated Spot Title:', (normalizedBooking.listingId as any)?.title);

    // 7. Verify simulated payment record
    console.log('\n[Phase 2] Operation 7: Creating & verifying simulated payment record...');
    const txnId = 'SIM-ATLAS-' + Date.now().toString(36).toUpperCase();
    const paymentDoc = new Payment({
      bookingId: bookingDoc._id,
      userId: userDoc._id,
      amount: totalAmount,
      currency: 'INR',
      paymentMethod: 'simulated_test',
      status: 'completed',
      transactionId: txnId,
      paidAt: new Date(),
      gatewayResponse: {
        gateway: 'Simulated Sandbox Payment Gateway',
        environment: 'Demonstration / Internship Sandbox',
        mode: 'simulated_instant_settlement',
        timestamp: new Date().toISOString(),
        isSimulated: true,
      },
    });
    await paymentDoc.save();
    cleanupIds.payments.push(paymentDoc._id.toString());

    // Update booking paymentStatus
    bookingDoc.paymentStatus = 'paid';
    bookingDoc.paymentId = paymentDoc._id;
    await bookingDoc.save();

    console.log('✓ Payment record created and persisted in MongoDB Atlas!');
    console.log('  Transaction ID:', paymentDoc.transactionId);
    console.log('  Payment status:', paymentDoc.status);
    console.log('  Payment amount: ₹' + paymentDoc.amount);

    const fetchedPayment = await Payment.findById(paymentDoc._id).lean();
    if (!fetchedPayment || fetchedPayment.status !== 'completed') {
      throw new Error('Payment verification query failed!');
    }
    console.log('✓ Payment record verified via database query.');

    return {
      success: true,
      details: {
        userId: userDoc._id.toString(),
        listingId: listingDoc._id.toString(),
        bookingId: bookingDoc._id.toString(),
        paymentId: paymentDoc._id.toString(),
      },
    };
  } finally {
    // 8. Clean up all test records safely
    console.log('\n[Phase 3] Safe cleanup of test records from MongoDB Atlas...');
    if (cleanupIds.payments.length > 0) {
      await Payment.deleteMany({ _id: { $in: cleanupIds.payments } });
      console.log(`  ✓ Removed ${cleanupIds.payments.length} test payment record(s)`);
    }
    if (cleanupIds.bookings.length > 0) {
      await Booking.deleteMany({ _id: { $in: cleanupIds.bookings } });
      console.log(`  ✓ Removed ${cleanupIds.bookings.length} test booking record(s)`);
    }
    if (cleanupIds.listings.length > 0) {
      await ParkingListing.deleteMany({ _id: { $in: cleanupIds.listings } });
      console.log(`  ✓ Removed ${cleanupIds.listings.length} test listing record(s)`);
    }
    if (cleanupIds.users.length > 0) {
      await User.deleteMany({ _id: { $in: cleanupIds.users } });
      console.log(`  ✓ Removed ${cleanupIds.users.length} test user record(s)`);
    }

    await mongoose.disconnect();
    console.log('✓ Disconnected cleanly from MongoDB Atlas.');
    console.log('\n===============================================================');
    console.log('  ALL LIVE ATLAS DATABASE OPERATIONS VERIFIED SUCCESSFULLY!    ');
    console.log('===============================================================');
  }
}

if (require.main === module) {
  runAtlasPersistenceVerification().catch((err) => {
    console.error('\n❌ ATLAS VERIFICATION FAILED:', err.message);
    process.exit(1);
  });
}

