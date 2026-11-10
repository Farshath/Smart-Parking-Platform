'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api, ApiError } from '../../lib/api';
import { Booking, ParkingListing } from '../../types';
import { MetricSkeletonGrid, CardSkeletonGrid } from '../../components/Skeleton';
import AvailabilityBadge from '../../components/AvailabilityBadge';
import ConfirmModal from '../../components/ConfirmModal';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

type ConfirmAction =
  | { type: 'delete_listing'; id: string; title: string }
  | { type: 'reject_booking'; id: string; spotTitle: string };

export default function OwnerDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'listings' | 'reservations' | 'revenue'>('listings');
  const [listings, setListings] = useState<ParkingListing[]>([]);
  const [analytics, setAnalytics] = useState<{
    summary: {
      totalListings: number;
      activeListings: number;
      totalSlots: number;
      availableSlots: number;
      totalBookings: number;
      confirmedBookings: number;
      pendingBookings: number;
      cancelledBookings: number;
      totalRevenue: number;
    };
    recentBookings: Booking[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const loadOwnerData = React.useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setErrorMessage(null);
    try {
      const [listingsRes, analyticsRes] = await Promise.all([
        api.listings.getMyListings(),
        api.listings.getOwnerAnalytics(),
      ]);
      setListings(listingsRes.listings);
      setAnalytics(analyticsRes);
    } catch (err) {
      if (!silent) {
        if (err instanceof ApiError) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage('Failed to load owner dashboard data.');
        }
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/login?redirect=/owner');
        return;
      }
      if (user?.role !== 'parking_owner' && user?.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      void loadOwnerData(false);
    }
  }, [authLoading, isAuthenticated, user, router, loadOwnerData]);

  // Real-time capacity & booking polling
  const { isSyncing, triggerSync } = useAutoRefresh({
    onRefresh: () => loadOwnerData(true),
    intervalMs: 10000,
    enabled: Boolean(
      isAuthenticated &&
        (user?.role === 'parking_owner' || user?.role === 'admin') &&
        !isLoading
    ),
  });

  const handleToggleStatus = async (listing: ParkingListing) => {
    const lId = listing.id || listing._id || '';
    if (!lId || actionInProgress) return;
    const newStatus = listing.status === 'active' ? 'inactive' : 'active';
    setActionInProgress(lId);

    try {
      await api.listings.update(lId, { status: newStatus });
      showToast({
        type: 'success',
        title: 'Listing Updated',
        message: `"${listing.title}" is now ${newStatus}.`,
      });
      await loadOwnerData(true);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: err instanceof Error ? err.message : 'Failed to update listing status',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleUpdateBookingStatus = async (
    bookingId: string,
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  ) => {
    if (!bookingId || actionInProgress) return;
    setActionInProgress(bookingId);
    try {
      await api.bookings.updateStatus(bookingId, status);
      showToast({
        type: 'success',
        title: 'Booking Updated',
        message: `Reservation status transitioned to '${status}' and slot capacity synced.`,
      });
      await loadOwnerData(true);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Action Failed',
        message: err instanceof Error ? err.message : 'Failed to update booking status',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleConfirmModalExecute = async () => {
    if (!confirmAction || actionInProgress) return;

    if (confirmAction.type === 'delete_listing') {
      setActionInProgress(confirmAction.id);
      try {
        await api.listings.delete(confirmAction.id);
        setListings((prev) =>
          prev.filter((l) => (l.id || l._id) !== confirmAction.id)
        );
        showToast({
          type: 'success',
          title: 'Listing Deleted',
          message: `"${confirmAction.title}" was removed.`,
        });
        await loadOwnerData(true);
      } catch (err) {
        showToast({
          type: 'error',
          title: 'Delete Failed',
          message: err instanceof Error ? err.message : 'Failed to delete listing',
        });
      } finally {
        setActionInProgress(null);
        setConfirmAction(null);
      }
      return;
    }

    if (confirmAction.type === 'reject_booking') {
      await handleUpdateBookingStatus(confirmAction.id, 'cancelled');
      setConfirmAction(null);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
        <div className="p-8 rounded-2xl border border-slate-200 bg-white animate-pulse h-36" />
        <MetricSkeletonGrid count={4} />
        <CardSkeletonGrid count={4} />
      </div>
    );
  }

  const summary = analytics?.summary || {
    totalListings: listings.length,
    activeListings: listings.filter((l) => l.status === 'active').length,
    totalSlots: listings.reduce((sum, l) => sum + l.totalSlots, 0),
    availableSlots: listings.reduce((sum, l) => sum + l.availableSlots, 0),
    totalBookings: 0,
    confirmedBookings: 0,
    pendingBookings: 0,
    cancelledBookings: 0,
    totalRevenue: 0,
  };

  const recentReservations = analytics?.recentBookings || [];
  const totalReservedSlots = Math.max(0, summary.totalSlots - summary.availableSlots);

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 animate-fade-in-up">
      {/* Top Banner */}
      <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 bg-white shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            Parking Operator & Owner Portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Parking Owner Hub
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl leading-relaxed">
            Publish parking spaces, monitor live slot availability, approve reservations, and track earnings.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
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
            {isSyncing ? 'Syncing...' : 'Live Sync (10s)'}
          </button>

          <Link
            href="/listings/new"
            className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs whitespace-nowrap transition"
          >
            <span>+</span>
            <span>Add New Parking Spot</span>
          </Link>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-xs flex items-center justify-between gap-4">
          <span>⚠️ {errorMessage}</span>
          <button
            type="button"
            onClick={() => void loadOwnerData(false)}
            className="underline font-bold whitespace-nowrap cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <div className="h-full flex flex-col justify-between p-5 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Owned Locations
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
            {summary.totalListings}
          </div>
          <div className="mt-2 text-xs text-emerald-700 font-semibold">
            {summary.activeListings} active on marketplace
          </div>
        </div>

        <div className="h-full flex flex-col justify-between p-5 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Live Capacity
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
            {summary.availableSlots} / {summary.totalSlots}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            {totalReservedSlots} reserved &bull; {summary.availableSlots} available
          </div>
        </div>

        <div className="h-full flex flex-col justify-between p-5 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Reservations Handled
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
            {summary.totalBookings}
          </div>
          <div className="mt-2 text-xs text-blue-700 font-semibold">
            {summary.confirmedBookings} confirmed bookings
          </div>
        </div>

        <div className="h-full flex flex-col justify-between p-5 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Gross Rental Earnings
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-700 tabular-nums">
            ₹{summary.totalRevenue}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            Paid & confirmed revenue
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 gap-6 text-sm font-semibold overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('listings')}
          className={`inline-flex items-center h-11 border-b-2 whitespace-nowrap shrink-0 transition cursor-pointer ${
            activeTab === 'listings'
              ? 'border-blue-600 text-blue-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          My Parking Listings ({listings.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('reservations')}
          className={`inline-flex items-center h-11 border-b-2 whitespace-nowrap shrink-0 transition cursor-pointer ${
            activeTab === 'reservations'
              ? 'border-blue-600 text-blue-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Incoming Reservations ({recentReservations.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('revenue')}
          className={`inline-flex items-center h-11 border-b-2 whitespace-nowrap shrink-0 transition cursor-pointer ${
            activeTab === 'revenue'
              ? 'border-blue-600 text-blue-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Revenue & Analytics
        </button>
      </div>

      {/* TAB 1: LISTINGS */}
      {activeTab === 'listings' && (
        <div className="space-y-4">
          {listings.length === 0 ? (
            <div className="p-12 rounded-2xl border border-slate-200 bg-white flex flex-col items-center justify-center text-center shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl mb-4">
                📍
              </div>
              <h3 className="text-base font-bold text-slate-900">No Parking Spots Listed</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-sm leading-relaxed">
                Start monetizing your unused parking spaces. Add your first parking listing now.
              </p>
              <Link
                href="/listings/new"
                className="mt-5 inline-flex items-center justify-center h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
              >
                Create First Listing
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {listings.map((listing) => {
                const lId = listing.id || listing._id || '';
                const reservedCount = Math.max(
                  0,
                  listing.totalSlots - listing.availableSlots
                );
                const activeResCount = listing.activeReservationsCount ?? reservedCount;

                return (
                  <div
                    key={lId}
                    className="h-full p-6 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition flex flex-col justify-between space-y-5 shadow-xs"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <AvailabilityBadge
                          availableSlots={listing.availableSlots}
                          totalSlots={listing.totalSlots}
                          status={listing.status}
                        />
                        <span className="text-sm font-extrabold text-slate-900 tabular-nums shrink-0 whitespace-nowrap">
                          ₹{listing.hourlyRate}/hour
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-slate-900 leading-snug">
                          {listing.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          📍 {listing.address.street}, {listing.address.city}
                          {listing.address.state ? `, ${listing.address.state}` : ''}
                        </p>
                      </div>

                      {/* Capacity Breakdown Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs items-stretch">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                            Total Capacity
                          </span>
                          <span className="mt-1 text-sm font-extrabold text-slate-900 tabular-nums">
                            {listing.totalSlots}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                            Available Slots
                          </span>
                          <span
                            className={`mt-1 text-sm font-extrabold tabular-nums ${
                              listing.availableSlots > 0
                                ? 'text-emerald-700'
                                : 'text-rose-600'
                            }`}
                          >
                            {listing.availableSlots}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                            Reserved Slots
                          </span>
                          <span className="mt-1 text-sm font-extrabold text-slate-900 tabular-nums">
                            {reservedCount}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                            Active Bookings
                          </span>
                          <span className="mt-1 text-sm font-extrabold text-blue-700 tabular-nums">
                            {activeResCount}
                          </span>
                        </div>
                      </div>

                      {/* Visual Availability Progress Bar */}
                      <AvailabilityBadge
                        availableSlots={listing.availableSlots}
                        totalSlots={listing.totalSlots}
                        status={listing.status}
                        showBar
                        hideBadge
                      />
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                      <Link
                        href={lId ? `/listings/${lId}` : '/listings'}
                        className="inline-flex items-center justify-center h-9 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs whitespace-nowrap transition"
                      >
                        View Public Spot
                      </Link>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleToggleStatus(listing)}
                          disabled={actionInProgress === lId}
                          className="inline-flex items-center justify-center h-9 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs whitespace-nowrap cursor-pointer disabled:opacity-50 transition"
                        >
                          {actionInProgress === lId
                            ? 'Updating...'
                            : listing.status === 'active'
                            ? 'Deactivate'
                            : 'Activate'}
                        </button>

                        <Link
                          href={lId ? `/listings/${lId}/edit` : '/owner'}
                          className="inline-flex items-center justify-center h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs whitespace-nowrap transition"
                        >
                          Edit
                        </Link>

                        <button
                          type="button"
                          onClick={() =>
                            setConfirmAction({
                              type: 'delete_listing',
                              id: lId,
                              title: listing.title,
                            })
                          }
                          disabled={actionInProgress === lId}
                          className="inline-flex items-center justify-center h-9 px-3.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INCOMING RESERVATIONS */}
      {activeTab === 'reservations' && (
        <div className="space-y-4">
          {recentReservations.length === 0 ? (
            <div className="p-12 rounded-2xl border border-slate-200 bg-white flex flex-col items-center justify-center text-center shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl mb-4">
                📋
              </div>
              <h3 className="text-base font-bold text-slate-900">No Reservations Yet</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-sm leading-relaxed">
                Customer reservations for your parking slots will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentReservations.map((booking) => {
                const bId = booking.id || booking._id || '';
                const customer =
                  typeof booking.userId === 'object' ? booking.userId : null;
                const listing =
                  typeof booking.listingId === 'object' ? booking.listingId : null;

                return (
                  <div
                    key={bId}
                    className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs"
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
                              : booking.status === 'completed'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {booking.status}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {booking.paymentStatus === 'paid' ? 'PAID' : booking.paymentStatus === 'failed' ? 'PAYMENT FAILED' : 'PAYMENT PENDING'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-700">
                        Customer:{' '}
                        <span className="font-bold text-slate-900">
                          {customer?.name || 'Customer'}
                        </span>
                        {customer?.phoneNumber && (
                          <span className="text-slate-500 ml-2">
                            ({customer.phoneNumber})
                          </span>
                        )}
                        {booking.vehicleNumber && (
                          <span className="text-blue-700 ml-2 font-mono font-bold">
                            • Vehicle: {booking.vehicleNumber}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500">
                        Schedule: {new Date(booking.startTime).toLocaleString()} &rarr;{' '}
                        {new Date(booking.endTime).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="text-right">
                        <div className="text-base font-extrabold text-emerald-700">
                          ₹{booking.totalAmount}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Ref: {booking.bookingReference || (bId ? bId.substring(0, 8) : 'BK-RES')}
                        </div>
                      </div>

                      {/* Status action buttons */}
                      {booking.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleUpdateBookingStatus(bId, 'confirmed')}
                            disabled={actionInProgress === bId}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmAction({
                                type: 'reject_booking',
                                id: bId,
                                spotTitle: listing?.title || 'this spot',
                              })
                            }
                            disabled={actionInProgress === bId}
                            className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold cursor-pointer disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}

                      {booking.status === 'confirmed' && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleUpdateBookingStatus(bId, 'completed')}
                            disabled={actionInProgress === bId}
                            className="px-3 py-1.5 rounded-xl border border-blue-300 text-blue-700 hover:bg-blue-50 text-xs font-semibold cursor-pointer disabled:opacity-50"
                          >
                            {actionInProgress === bId ? 'Updating...' : 'Mark Completed'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmAction({
                                type: 'reject_booking',
                                id: bId,
                                spotTitle: listing?.title || 'this spot',
                              })
                            }
                            disabled={actionInProgress === bId}
                            className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold cursor-pointer disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REVENUE & ANALYTICS */}
      {activeTab === 'revenue' && (
        <div className="p-8 rounded-3xl border border-slate-200 bg-white space-y-6 shadow-xs">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Financial & Utilization Overview
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
              <span className="text-xs text-slate-500 font-semibold">
                Total Earned Revenue
              </span>
              <div className="text-3xl font-extrabold text-emerald-700">
                ₹{summary.totalRevenue}
              </div>
              <p className="text-[11px] text-slate-500">
                From confirmed and fulfilled customer sessions.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
              <span className="text-xs text-slate-500 font-semibold">
                Booking Conversion Rate
              </span>
              <div className="text-3xl font-extrabold text-slate-900">
                {summary.totalBookings > 0
                  ? `${Math.round((summary.confirmedBookings / summary.totalBookings) * 100)}%`
                  : 'N/A'}
              </div>
              <p className="text-[11px] text-slate-500">
                Ratio of confirmed reservations to total attempts.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
              <span className="text-xs text-slate-500 font-semibold">
                Capacity Utilization
              </span>
              <div className="text-3xl font-extrabold text-blue-600">
                {summary.totalSlots > 0
                  ? `${Math.round(
                      ((summary.totalSlots - summary.availableSlots) / summary.totalSlots) * 100
                    )}%`
                  : '0%'}
              </div>
              <p className="text-[11px] text-slate-500">
                Currently occupied slots relative to total capacity.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog (Replaces browser confirm()) */}
      <ConfirmModal
        isOpen={Boolean(confirmAction)}
        title={
          confirmAction?.type === 'delete_listing'
            ? 'Delete Parking Listing?'
            : 'Reject / Cancel Reservation?'
        }
        description={
          confirmAction?.type === 'delete_listing'
            ? `Are you sure you want to permanently delete "${confirmAction.title}"? This action cannot be undone.`
            : `Rejecting/cancelling this reservation for "${
                confirmAction?.spotTitle || ''
              }" will release any reserved parking slot capacity back to available inventory.`
        }
        confirmLabel={
          confirmAction?.type === 'delete_listing' ? 'Delete Listing' : 'Confirm Rejection'
        }
        variant="danger"
        isProcessing={Boolean(actionInProgress)}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void handleConfirmModalExecute()}
      />
    </div>
  );
}
