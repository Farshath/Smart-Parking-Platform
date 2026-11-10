import http from 'http';
import '../config/env';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { createApp } from '../app';
import { User } from '../models/User';
import { ParkingListing } from '../models/ParkingListing';
import { Booking } from '../models/Booking';
import { Payment } from '../models/Payment';
import { hashPassword, generateToken } from '../utils/auth';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${label}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label}`);
  }
}

async function apiCall(
  baseUrl: string,
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {}
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function runAvailabilityAndConcurrencyTests() {
  console.log('====================================================================');
  console.log('  SMART PARKING — LIVE ATLAS AVAILABILITY & CONCURRENCY TEST SUITE    ');
  console.log('====================================================================');

  const connected = await connectDatabase();
  if (!connected) {
    throw new Error('Failed to connect to MongoDB Atlas.');
  }

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}/api`;

  const createdUserIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdBookingIds: string[] = [];
  const createdPaymentIds: string[] = [];

  try {
    const pwdHash = await hashPassword('TestPass@123');
    const ts = Date.now();

    const owner = await new User({
      name: 'Test Owner E2E',
      email: `test.owner.${ts}@smartpark-e2e.com`,
      passwordHash: pwdHash,
      role: 'parking_owner',
    }).save();
    createdUserIds.push(owner._id.toString());

    const custA = await new User({
      name: 'Customer Alpha',
      email: `test.custA.${ts}@smartpark-e2e.com`,
      passwordHash: pwdHash,
      role: 'customer',
    }).save();
    createdUserIds.push(custA._id.toString());

    const custB = await new User({
      name: 'Customer Beta',
      email: `test.custB.${ts}@smartpark-e2e.com`,
      passwordHash: pwdHash,
      role: 'customer',
    }).save();
    createdUserIds.push(custB._id.toString());

    const ownerToken = generateToken({ userId: owner._id.toString(), email: owner.email, role: owner.role });
    const custAToken = generateToken({ userId: custA._id.toString(), email: custA.email, role: custA.role });
    const custBToken = generateToken({ userId: custB._id.toString(), email: custB.email, role: custB.role });

    // Scenario 1: Owner creates parking listing with 10 slots
    console.log('\n--- Scenario 1: Owner creates listing with 10 slots ---');
    const createRes = await apiCall(baseUrl, '/listings', {
      method: 'POST',
      token: ownerToken,
      body: {
        title: `Chennai E2E Lot ${ts}`,
        description: 'Automated availability verification lot',
        address: { street: '100 Mount Road', city: 'Chennai', state: 'Tamil Nadu', country: 'India' },
        hourlyRate: 40,
        totalSlots: 10,
        availableSlots: 10,
        parkingType: 'covered',
      },
    });
    assert(createRes.status === 201, 'Owner creates 10-slot listing (HTTP 201)');
    const listingId = createRes.json.data.listing.id;
    createdListingIds.push(listingId);
    assert(createRes.json.data.listing.availableSlots === 10, 'Initial availableSlots is 10');

    // Scenario 2: Customer A books one slot -> availability becomes 9
    console.log('\n--- Scenario 2: Customer A books 1 slot -> availableSlots becomes 9 ---');
    const t1Start = new Date(Date.now() + 3600_000).toISOString();
    const t1End = new Date(Date.now() + 3 * 3600_000).toISOString();
    const bookARes = await apiCall(baseUrl, '/bookings', {
      method: 'POST',
      token: custAToken,
      body: { listingId, startTime: t1Start, endTime: t1End, idempotencyKey: `idem-A-${ts}` },
    });
    assert(bookARes.status === 201, 'Customer A booking succeeds (HTTP 201)');
    const bookingAId = bookARes.json.data.booking.id;
    createdBookingIds.push(bookingAId);
    assert(bookARes.json.data.listingAvailability?.availableSlots === 9, 'Availability dropped from 10 to 9');

    // Scenario 3: Customer B books one slot -> availability becomes 8
    console.log('\n--- Scenario 3: Customer B books 1 slot -> availableSlots becomes 8 ---');
    const bookBRes = await apiCall(baseUrl, '/bookings', {
      method: 'POST',
      token: custBToken,
      body: { listingId, startTime: t1Start, endTime: t1End, idempotencyKey: `idem-B-${ts}` },
    });
    assert(bookBRes.status === 201, 'Customer B booking succeeds (HTTP 201)');
    const bookingBId = bookBRes.json.data.booking.id;
    createdBookingIds.push(bookingBId);
    assert(bookBRes.json.data.listingAvailability?.availableSlots === 8, 'Availability dropped from 9 to 8');

    // Scenario 4 & 5: Owner dashboard & Customer listings reflect updated count (8)
    console.log('\n--- Scenario 4 & 5: Owner dashboard and Customer listings show 8 slots ---');
    const ownerDashRes = await apiCall(baseUrl, '/listings/my-listings', { token: ownerToken });
    const ownerSpot = ownerDashRes.json.data.listings.find((l: any) => l.id === listingId);
    assert(ownerSpot?.availableSlots === 8, 'Owner dashboard shows availableSlots === 8');
    assert(ownerSpot?.activeReservationsCount === 2, 'Owner dashboard shows activeReservationsCount === 2');

    const custDetailRes = await apiCall(baseUrl, `/listings/${listingId}`);
    assert(custDetailRes.json.data.listing.availableSlots === 8, 'Customer spot detail page shows availableSlots === 8');

    // Scenario 8: Repeated identical booking request does NOT deduct capacity twice
    console.log('\n--- Scenario 8: Repeated booking request does not double-deduct ---');
    const repeatRes = await apiCall(baseUrl, '/bookings', {
      method: 'POST',
      token: custAToken,
      body: { listingId, startTime: t1Start, endTime: t1End, idempotencyKey: `idem-A-${ts}` },
    });
    assert(repeatRes.status === 200, 'Duplicate idempotencyKey returns existing booking (HTTP 200)');
    const afterRepeat = await apiCall(baseUrl, `/listings/${listingId}`);
    assert(afterRepeat.json.data.listing.availableSlots === 8, 'Availability remained strictly 8 (no double-deduction)');

    const repeatSameTimeRes = await apiCall(baseUrl, '/bookings', {
      method: 'POST',
      token: custAToken,
      body: { listingId, startTime: t1Start, endTime: t1End },
    });
    assert(repeatSameTimeRes.status === 200, 'Repeated identical payload returns existing booking without double-deducting');
    const afterRepeat2 = await apiCall(baseUrl, `/listings/${listingId}`);
    assert(afterRepeat2.json.data.listing.availableSlots === 8, 'Availability still strictly 8');

    // Scenario 6: Customer cancels eligible confirmed booking -> availability returns to 9
    console.log('\n--- Scenario 6: Customer cancels booking -> availability returns to 9 ---');
    const cancelARes = await apiCall(baseUrl, `/bookings/${bookingAId}/cancel`, {
      method: 'PATCH',
      token: custAToken,
      body: { reason: 'Changed travel plans' },
    });
    assert(cancelARes.status === 200 && cancelARes.json.data.booking.status === 'cancelled', 'Booking A cancelled');
    const afterCancel = await apiCall(baseUrl, `/listings/${listingId}`);
    assert(afterCancel.json.data.listing.availableSlots === 9, 'Availability restored from 8 to 9');

    // Double cancellation idempotency check
    const doubleCancel = await apiCall(baseUrl, `/bookings/${bookingAId}/cancel`, {
      method: 'PATCH',
      token: custAToken,
    });
    assert(doubleCancel.status === 200, 'Repeat cancellation succeeds idempotently');
    const afterDoubleCancel = await apiCall(baseUrl, `/listings/${listingId}`);
    assert(afterDoubleCancel.json.data.listing.availableSlots === 9, 'Repeat cancellation did NOT double-restore capacity');

    // Scenario 9a: Failed payment releases held capacity; retry re-reserves when available
    console.log('\n--- Scenario 9a: Failed payment releases held slot capacity ---');
    const failPayRes = await apiCall(baseUrl, '/payments/process', {
      method: 'POST',
      token: custBToken,
      body: { bookingId: bookingBId, paymentMethod: 'upi', simulateFailure: true },
    });
    assert(failPayRes.json.success === false && failPayRes.json.data.payment.status === 'failed', 'Simulated payment recorded as failed');
    createdPaymentIds.push(failPayRes.json.data.payment.id);
    assert(failPayRes.json.data.booking.capacityReserved === false, 'Booking B capacityReserved set to false after payment failure');
    const afterFailPay = await apiCall(baseUrl, `/listings/${listingId}`);
    assert(afterFailPay.json.data.listing.availableSlots === 10, 'Availability restored from 9 to 10 after payment failure');

    // Scenario 9b: Rejecting a pending booking with capacityReserved: false does NOT over-increment capacity
    console.log('\n--- Scenario 9b: Owner rejects unreserved pending booking (no excess capacity restore) ---');
    const rejectUnreservedRes = await apiCall(baseUrl, `/bookings/${bookingBId}/status`, {
      method: 'PATCH',
      token: ownerToken,
      body: { status: 'cancelled', reason: 'Payment never completed' },
    });
    assert(rejectUnreservedRes.status === 200, 'Owner rejects unreserved booking');
    const afterRejectUnreserved = await apiCall(baseUrl, `/listings/${listingId}`);
    assert(afterRejectUnreserved.json.data.listing.availableSlots === 10, 'availableSlots remains capped at 10 (no overflow)');

    // Scenario 7: Two customers simultaneously attempt to book the LAST available slot (availableSlots === 1)
    console.log('\n--- Scenario 7: Two customers race for the final available slot ---');
    const singleSlotListing = await apiCall(baseUrl, '/listings', {
      method: 'POST',
      token: ownerToken,
      body: {
        title: `Last Slot Race Lot ${ts}`,
        description: 'Concurrency race lot',
        address: { street: '1 Race Track Rd', city: 'Chennai', country: 'India' },
        hourlyRate: 50,
        totalSlots: 1,
        availableSlots: 1,
      },
    });
    const raceListingId = singleSlotListing.json.data.listing.id;
    createdListingIds.push(raceListingId);

    const t2Start = new Date(Date.now() + 7200_000).toISOString();
    const t2End = new Date(Date.now() + 9000_000).toISOString();

    const [raceA, raceB] = await Promise.all([
      apiCall(baseUrl, '/bookings', {
        method: 'POST',
        token: custAToken,
        body: { listingId: raceListingId, startTime: t2Start, endTime: t2End },
      }),
      apiCall(baseUrl, '/bookings', {
        method: 'POST',
        token: custBToken,
        body: { listingId: raceListingId, startTime: t2Start, endTime: t2End },
      }),
    ]);

    const statuses = [raceA.status, raceB.status].sort();
    assert(statuses[0] === 201 && statuses[1] === 409, `Exactly one wins (201) and one gets 409 Conflict (got [${statuses.join(', ')}])`);
    if (raceA.status === 201) createdBookingIds.push(raceA.json.data.booking.id);
    if (raceB.status === 201) createdBookingIds.push(raceB.json.data.booking.id);

    const raceFinalListing = await apiCall(baseUrl, `/listings/${raceListingId}`);
    assert(raceFinalListing.json.data.listing.availableSlots === 0, 'Final availableSlots is strictly 0 (never negative)');
  } finally {
    console.log('\n--- Cleaning up temporary Atlas test documents ---');
    if (createdPaymentIds.length) await Payment.deleteMany({ _id: { $in: createdPaymentIds } });
    if (createdBookingIds.length) await Booking.deleteMany({ _id: { $in: createdBookingIds } });
    if (createdListingIds.length) await ParkingListing.deleteMany({ _id: { $in: createdListingIds } });
    if (createdUserIds.length) await User.deleteMany({ _id: { $in: createdUserIds } });

    server.close();
    await disconnectDatabase();
  }

  console.log('\n====================================================================');
  console.log(`AVAILABILITY SUITE TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================================');
  if (failed > 0) process.exit(1);
}

runAvailabilityAndConcurrencyTests().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});

