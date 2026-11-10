'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../lib/api';
import { Booking, ParkingListing } from '../../types';
import { MetricSkeletonGrid, ListRowSkeleton } from '../../components/Skeleton';
import AvailabilityBadge from '../../components/AvailabilityBadge';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

export default function UserDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [featuredListings, setFeaturedListings] = useState<ParkingListing[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchDashboardData = React.useCallback(async (silent = false) => {
    if (!silent) setLoadingData(true);
    setErrorMessage(null);
    try {
      const [bookingsRes, listingsRes] = await Promise.all([
        api.bookings.getMyBookings({ limit: 5 }),
        api.listings.getAll({ limit: 4, status: 'active' }),
      ]);
      setBookings(bookingsRes.bookings);
      setFeaturedListings(listingsRes.listings);
    } catch (err) {
      if (!silent) {
        if (err instanceof ApiError) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage('Failed to load dashboard metrics.');
        }
      }
    } finally {
      if (!silent) setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/dashboard');
      return;
    }

    if (isAuthenticated) {
      void fetchDashboardData(false);
    }
  }, [isAuthenticated, authLoading, router, fetchDashboardData]);

  const { isSyncing, triggerSync } = useAutoRefresh({
    onRefresh: () => fetchDashboardData(true),
    intervalMs: 10000,
    enabled: Boolean(isAuthenticated && !loadingData),
  });

  if (authLoading || loadingData) {
    return (
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
        <div className="p-8 rounded-2xl border border-slate-200 bg-white animate-pulse h-36" />
        <MetricSkeletonGrid count={4} />
        <ListRowSkeleton count={3} />
      </div>
    );
  }

  const activeBookings = bookings.filter((b) => b.status === 'confirmed' || b.status === 'pending');
  const totalSpent = bookings
    .filter((b) => b.status !== 'cancelled')
    .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 animate-fade-in-up">
      {/* Welcome Banner */}
      <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              Registered as {user?.role.replace('_', ' ').toUpperCase()}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome back, {user?.name}! 👋
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
              Manage your parking spot reservations, track payments, and explore available slots.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => void triggerSync()}
              disabled={isSyncing}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold whitespace-nowrap transition cursor-pointer disabled:opacity-50"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isSyncing ? 'bg-blue-500 animate-ping' : 'bg-emerald-500'
                }`}
              />
              {isSyncing ? 'Syncing...' : 'Refresh'}
            </button>
            <Link
              href="/listings"
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs whitespace-nowrap transition"
            >
              Explore Spots &rarr;
            </Link>
            <Link
              href="/profile"
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs whitespace-nowrap transition"
            >
              Edit Profile
            </Link>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-xs flex items-center justify-between gap-4">
          <span>⚠️ {errorMessage}</span>
          <button
            type="button"
            onClick={() => void fetchDashboardData(false)}
            className="underline hover:text-amber-900 font-bold whitespace-nowrap cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <div className="h-full flex flex-col justify-between p-5 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Active Reservations
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
            {activeBookings.length}
          </div>
          <div className="mt-2 text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            <span>Ready for arrival</span>
          </div>
        </div>

        <div className="h-full flex flex-col justify-between p-5 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Bookings
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
            {bookings.length}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            All-time reservations
          </div>
        </div>

        <div className="h-full flex flex-col justify-between p-5 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Expenditure
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-blue-600 tabular-nums">
            ₹{Math.round(totalSpent * 100) / 100}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            Confirmed & active slots
          </div>
        </div>

        <div className="h-full flex flex-col justify-between p-5 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Quick Portals
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Link
              href="/payments"
              className="inline-flex items-center justify-center h-8 px-3 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 whitespace-nowrap transition"
            >
              Payments
            </Link>
            <Link
              href="/bookings"
              className="inline-flex items-center justify-center h-8 px-3 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 whitespace-nowrap transition"
            >
              Bookings
            </Link>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">Instant navigation</div>
        </div>
      </div>

      {/* Main Content Grid: Recent Bookings & Recommended Spots */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Recent Bookings */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Recent Reservations</h2>
            <Link href="/bookings" className="text-xs text-blue-600 hover:text-blue-700 font-semibold whitespace-nowrap">
              View all bookings &rarr;
            </Link>
          </div>

          {bookings.length === 0 ? (
            <div className="p-10 rounded-2xl border border-slate-200 bg-white flex flex-col items-center justify-center text-center shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl mb-3">
                🚗
              </div>
              <h3 className="text-sm font-bold text-slate-900">No Bookings Yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
                You haven&apos;t reserved any parking spots yet. Search and discover verified parking around you.
              </p>
              <Link
                href="/listings"
                className="mt-4 inline-flex items-center justify-center h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
              >
                Find Parking Now
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((booking) => {
                const bId = booking.id || booking._id || '';
                const listing = typeof booking.listingId === 'object' ? booking.listingId : null;
                const isPaid = booking.paymentStatus === 'paid';

                return (
                  <div
                    key={bId}
                    className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">
                          {listing?.title || 'Parking Spot'}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                            booking.status === 'confirmed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : booking.status === 'cancelled'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {booking.status}
                        </span>
                        {isPaid && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            PAID
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600">
                        📍 {listing?.address ? `${listing.address.street}, ${listing.address.city}` : 'Address available on details'}
                      </p>

                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span className="font-mono">
                          Ref: {booking.bookingReference || (bId ? bId.substring(0, 8) : 'BK-RES')}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(booking.startTime).toLocaleDateString()}{' '}
                          {new Date(booking.startTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-slate-900">
                          ₹{booking.totalAmount}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {isPaid ? 'Completed' : booking.paymentStatus === 'failed' ? 'Payment Failed' : 'Payment Pending'}
                        </div>
                      </div>

                      {!isPaid && booking.status !== 'cancelled' ? (
                        <Link
                          href={`/bookings/${bId}/checkout`}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
                        >
                          Pay Now
                        </Link>
                      ) : (
                        <Link
                          href={`/bookings/${bId}/confirmation`}
                          className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition"
                        >
                          Receipt
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Featured Parking Spots with Live Availability */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Available Spots</h2>
            <Link href="/listings" className="text-xs text-blue-600 hover:text-blue-700 font-semibold">
              Explore &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {featuredListings.map((spot) => {
              const spotId = spot.id || spot._id || '';
              return (
                <Link
                  key={spotId}
                  href={spotId ? `/listings/${spotId}` : '/listings'}
                  className="block p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs transition group shadow-2xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-xs text-slate-900 group-hover:text-blue-600 transition line-clamp-1">
                      {spot.title}
                    </span>
                    <span className="font-extrabold text-xs text-slate-900 shrink-0">
                      ₹{spot.hourlyRate}/hr
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {spot.address.street}, {spot.address.city}
                  </p>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <AvailabilityBadge
                      availableSlots={spot.availableSlots}
                      totalSlots={spot.totalSlots}
                      status={spot.status}
                      compact
                    />
                    <span className="text-[11px] font-semibold text-slate-600">
                      {spot.availableSlots}/{spot.totalSlots} free
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
