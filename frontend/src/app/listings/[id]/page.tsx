'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { api, ApiError } from '../../../lib/api';
import { Booking, ParkingListing } from '../../../types';
import { DetailPageSkeleton } from '../../../components/Skeleton';
import AvailabilityBadge from '../../../components/AvailabilityBadge';
import { useAutoRefresh } from '../../../hooks/useAutoRefresh';

function ListingDetailContent({ idPromise }: { idPromise: Promise<{ id: string }> }) {
  const { id: listingId } = use(idPromise);
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();

  const [listing, setListing] = useState<ParkingListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formatDateTimeLocal = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const [startTime, setStartTime] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return formatDateTimeLocal(d);
  });

  const [endTime, setEndTime] = useState(() => {
    const d = new Date(Date.now() + 3 * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return formatDateTimeLocal(d);
  });

  const [vehicleNumber, setVehicleNumber] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  // Per-attempt idempotency key so retries / double-clicks never double-deduct slots
  const idempotencyKeyRef = useRef<string>('');

  const getOrCreateIdempotencyKey = () => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    return idempotencyKeyRef.current;
  };

  const refreshIdempotencyKey = () => {
    idempotencyKeyRef.current = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };

  const fetchListing = useCallback(
    async (silent = false) => {
      if (!listingId || listingId === 'undefined' || listingId === 'null') {
        setIsLoading(false);
        setErrorMessage('Invalid parking spot selected. Please return to the listings directory.');
        return;
      }

      if (!silent) {
        setIsLoading(true);
      }
      setErrorMessage(null);
      try {
        const res = await api.listings.getById(listingId);
        setListing(res.listing);
      } catch (err) {
        if (!silent) {
          if (err instanceof ApiError) {
            setErrorMessage(err.message);
          } else {
            setErrorMessage('Failed to load parking spot details.');
          }
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [listingId]
  );

  useEffect(() => {
    void fetchListing(false);
  }, [fetchListing]);

  // Poll live availability silently without overwriting user's form inputs
  const { isSyncing, triggerSync } = useAutoRefresh({
    onRefresh: () => fetchListing(true),
    intervalMs: 10000,
    enabled: Boolean(listing && !isLoading),
  });

  const calculateEstimate = () => {
    if (!listing) return { hours: 0, total: 0 };
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    if (isNaN(start) || isNaN(end) || end <= start) {
      return { hours: 0, total: 0 };
    }

    const hours = (end - start) / (1000 * 60 * 60);
    const total = Math.max(0.01, Math.round(hours * listing.hourlyRate * 100) / 100);
    return { hours: Math.round(hours * 10) / 10, total };
  };

  const { hours: estimatedHours, total: estimatedTotal } = calculateEstimate();

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBooking) return;
    setBookingError(null);

    if (!isAuthenticated) {
      router.push(`/login?redirect=/listings/${listingId}`);
      return;
    }

    if (!listing || listing.status !== 'active' || listing.availableSlots <= 0) {
      const msg = 'No available parking slots remain at this location.';
      setBookingError(msg);
      showToast({ type: 'error', title: 'Spot Unavailable', message: msg });
      return;
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    if (endDate <= startDate) {
      setBookingError('End time must be strictly after start time.');
      return;
    }

    setIsBooking(true);

    try {
      const targetListingId = listing.id || listing._id || listingId;
      const response = await api.bookings.create({
        listingId: targetListingId,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        vehicleNumber: vehicleNumber.trim() || undefined,
        idempotencyKey: getOrCreateIdempotencyKey(),
      });

      setConfirmedBooking(response.booking);
      if (response.listingAvailability) {
        setListing((prev) =>
          prev
            ? { ...prev, availableSlots: response.listingAvailability!.availableSlots }
            : prev
        );
      } else {
        void fetchListing(true);
      }

      refreshIdempotencyKey();
      showToast({
        type: 'success',
        title: 'Reservation Confirmed',
        message: `Slot reserved! Reference: ${
          response.booking.bookingReference || response.booking.id
        }`,
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Failed to reserve slot. It may be fully booked for this time window.';
      setBookingError(msg);
      showToast({ type: 'error', title: 'Booking Failed', message: msg });
      void fetchListing(true);
    } finally {
      setIsBooking(false);
    }
  };

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (errorMessage || !listing) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center animate-fade-in-up">
        <div className="p-8 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800">
          <h2 className="text-lg font-bold mb-2">Spot Unavailable</h2>
          <p className="text-sm mb-6">
            {errorMessage || 'The requested parking listing could not be found.'}
          </p>
          <Link
            href="/listings"
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
          >
            &larr; Back to Listings
          </Link>
        </div>
      </div>
    );
  }

  const listingOwnerId =
    typeof listing.ownerId === 'object'
      ? listing.ownerId?.id || listing.ownerId?._id
      : listing.ownerId;
  const currentUserId = user?.id || user?._id;
  const isOwner = Boolean(user && listingOwnerId && currentUserId && listingOwnerId === currentUserId);
  const isSpotUnavailable = listing.status !== 'active' || listing.availableSlots <= 0;
  const reservedSlots = Math.max(0, listing.totalSlots - listing.availableSlots);

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <Link
          href="/listings"
          className="inline-flex items-center h-9 text-xs font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap transition"
        >
          &larr; Back to all listings
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white border border-slate-200 text-[11px] font-medium text-slate-600 shadow-2xs whitespace-nowrap">
            <span
              className={`w-2 h-2 rounded-full ${
                isSyncing ? 'bg-blue-500 animate-ping' : 'bg-emerald-500'
              }`}
            />
            {isSyncing ? 'Syncing slots...' : 'Live availability (10s poll)'}
          </span>
          <button
            type="button"
            onClick={() => void triggerSync()}
            disabled={isSyncing}
            className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 whitespace-nowrap transition cursor-pointer disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Spot Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-8 rounded-3xl border border-slate-200 bg-white shadow-xs">
            {listing.images && listing.images.length > 0 && (
              <div className="h-64 sm:h-80 w-full rounded-2xl overflow-hidden mb-6 bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={listing.images[0]}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <AvailabilityBadge
                availableSlots={listing.availableSlots}
                totalSlots={listing.totalSlots}
                status={listing.status}
              />

              <div className="text-2xl font-extrabold text-slate-900">
                ₹{listing.hourlyRate}{' '}
                <span className="text-sm font-normal text-slate-500">/ hour</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {listing.title}
            </h1>

            <div className="mt-3 flex items-center text-sm text-slate-500 gap-2">
              <span>📍</span>
              <span>
                {listing.address.street}, {listing.address.city},{' '}
                {listing.address.state || ''} {listing.address.zipCode || ''},{' '}
                {listing.address.country}
              </span>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                About this Parking Spot
              </h3>
              <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                {listing.description || 'Verified private parking slot with convenient access.'}
              </p>
            </div>

            {/* Live Capacity Breakdown */}
            <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-xs text-slate-500 font-medium block">
                    Total Capacity
                  </span>
                  <span className="text-xl font-extrabold text-slate-900">
                    {listing.totalSlots} Slots
                  </span>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-xs text-slate-500 font-medium block">
                    Available Currently
                  </span>
                  <span
                    className={`text-xl font-extrabold ${
                      listing.availableSlots > 0 ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {listing.availableSlots} Slots Free
                  </span>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-xs text-slate-500 font-medium block">
                    Reserved / Occupied
                  </span>
                  <span className="text-xl font-extrabold text-slate-700">
                    {reservedSlots} Slots
                  </span>
                </div>
              </div>

              <AvailabilityBadge
                availableSlots={listing.availableSlots}
                totalSlots={listing.totalSlots}
                status={listing.status}
                showBar
                hideBadge
              />
            </div>

            {/* Amenities */}
            {listing.amenities && listing.amenities.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Amenities & Facilities
                </h3>
                <div className="flex flex-wrap gap-2">
                  {listing.amenities.map((a, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 capitalize"
                    >
                      ✓ {a.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Booking Card */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 p-6 rounded-3xl border border-slate-200 bg-white shadow-md">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Reserve This Spot</h2>
            <p className="text-xs text-slate-500 mb-6">
              Instant reservation with atomic slot availability check.
            </p>

            {confirmedBooking ? (
              <div className="p-6 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 space-y-4">
                <div className="flex items-center gap-2 font-bold text-base text-emerald-900">
                  <span>✓</span> Reservation Confirmed!
                </div>
                <p className="text-xs leading-relaxed text-emerald-800">
                  Your parking slot has been secured. Booking ID:{' '}
                  <span className="font-mono font-bold">
                    {confirmedBooking.bookingReference || confirmedBooking.id}
                  </span>
                </p>
                <div className="pt-2 text-xs text-slate-700 space-y-1">
                  <div>
                    Total Billed:{' '}
                    <span className="font-bold text-slate-900">
                      ₹{confirmedBooking.totalAmount}
                    </span>
                  </div>
                  <div>
                    Payment Status:{' '}
                    <span className="font-semibold uppercase text-amber-700">
                      {confirmedBooking.paymentStatus || 'pending'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <Link
                    href={`/bookings/${confirmedBooking.id || confirmedBooking._id}/checkout`}
                    className="w-full py-2.5 text-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-xs"
                  >
                    Proceed to Payment / Checkout &rarr;
                  </Link>
                  <Link
                    href="/bookings"
                    className="w-full py-2.5 text-center rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
                  >
                    View in My Bookings
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmedBooking(null);
                      refreshIdempotencyKey();
                    }}
                    className="w-full py-2 text-center text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                  >
                    Make another reservation
                  </button>
                </div>
              </div>
            ) : isOwner ? (
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 text-xs font-medium leading-relaxed">
                ℹ️ You are the registered owner of this listing. You cannot make reservations on your own spots.
              </div>
            ) : (
              <form onSubmit={handleBookingSubmit} className="space-y-4">
                {isSpotUnavailable && (
                  <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold leading-relaxed">
                    🚫 {listing.status !== 'active'
                      ? `This listing is currently '${listing.status}' and not accepting bookings.`
                      : 'All parking slots are currently occupied (0 slots available). Check back soon as reservations complete or cancel.'}
                  </div>
                )}

                {bookingError && (
                  <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-medium">
                    {bookingError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Start Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    disabled={isSpotUnavailable || isBooking}
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      refreshIdempotencyKey();
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    End Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    disabled={isSpotUnavailable || isBooking}
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      refreshIdempotencyKey();
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Vehicle Number (Optional)
                  </label>
                  <input
                    type="text"
                    disabled={isSpotUnavailable || isBooking}
                    placeholder="e.g., TN-01-AB-1234"
                    value={vehicleNumber}
                    onChange={(e) => {
                      setVehicleNumber(e.target.value);
                      refreshIdempotencyKey();
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-mono uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs disabled:opacity-50"
                  />
                </div>

                {/* Live Price Estimation */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600 font-medium">
                    <span>Duration:</span>
                    <span className="font-bold text-slate-900">{estimatedHours} hours</span>
                  </div>
                  <div className="flex justify-between text-slate-600 font-medium">
                    <span>Rate:</span>
                    <span className="font-bold text-slate-900">₹{listing.hourlyRate}/hr</span>
                  </div>
                  <div className="flex justify-between text-slate-600 font-medium">
                    <span>Remaining Slots:</span>
                    <span
                      className={`font-bold ${
                        listing.availableSlots > 0 ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {listing.availableSlots} of {listing.totalSlots}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                    <span>Total Estimate:</span>
                    <span className="text-blue-600 font-extrabold">₹{estimatedTotal}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSpotUnavailable || isBooking || estimatedHours <= 0}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSpotUnavailable ? (
                    'Unavailable — No Slots Left'
                  ) : isBooking ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Reserving Slot...
                    </>
                  ) : !isAuthenticated ? (
                    'Log In to Reserve'
                  ) : (
                    `Confirm Reservation • ₹${estimatedTotal}`
                  )}
                </button>

                <p className="text-[11px] text-center text-slate-500 mt-2">
                  Atomic capacity check guarantees no double-booking.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<DetailPageSkeleton />}>
      <ListingDetailContent idPromise={params} />
    </Suspense>
  );
}
