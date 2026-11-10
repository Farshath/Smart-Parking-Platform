'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api, ApiError } from '../../lib/api';
import { Booking, Pagination } from '../../types';
import { ListRowSkeleton } from '../../components/Skeleton';

export default function BookingsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { showToast } = useToast();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Cancellation modal state
  const [selectedBookingForCancel, setSelectedBookingForCancel] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!isAuthLoading && !isAuthenticated) {
      router.push('/login?redirect=/bookings');
      return;
    }

    if (isAuthenticated) {
      const load = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
          const res = await api.bookings.getMyBookings({
            page,
            limit: 10,
            status: statusFilter,
          });
          if (isMounted) {
            setBookings(res.bookings || []);
            setPagination(res.pagination || null);
          }
        } catch (err) {
          if (isMounted) {
            if (err instanceof ApiError) {
              setErrorMessage(err.message);
            } else {
              setErrorMessage('Failed to load your reservations.');
            }
          }
        } finally {
          if (isMounted) setIsLoading(false);
        }
      };

      load();
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isAuthLoading, page, statusFilter, router]);

  const handleCancelConfirm = async () => {
    if (!selectedBookingForCancel) return;

    setIsCancelling(true);
    setCancelError(null);

    const targetId = selectedBookingForCancel.id || selectedBookingForCancel._id;
    if (!targetId) return;

    try {
      const res = await api.bookings.cancel(targetId, cancelReason);

      setBookings((prev) =>
        prev.map((b) => ((b.id || b._id) === (res.booking.id || res.booking._id) ? res.booking : b))
      );

      setSelectedBookingForCancel(null);
      setCancelReason('');
      showToast({
        type: 'success',
        title: 'Reservation Cancelled',
        message: 'Your booking was cancelled and the parking slot has been restored.',
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Could not cancel booking. Please try again.';
      setCancelError(msg);
      showToast({ type: 'error', title: 'Cancellation Failed', message: msg });
    } finally {
      setIsCancelling(false);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return isoString;
    }
  };

  const calculateHours = (start: string, end: string) => {
    try {
      const diff = new Date(end).getTime() - new Date(start).getTime();
      return Math.round((diff / (1000 * 60 * 60)) * 10) / 10;
    } catch {
      return 0;
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
        <div className="h-10 w-64 rounded-xl bg-slate-200 animate-pulse" />
        <ListRowSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 min-h-full animate-fade-in-up">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            My Parking Reservations
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
            View, track, and manage your reserved parking slots.
          </p>
        </div>

        <Link
          href="/listings"
          className="self-start sm:self-auto inline-flex items-center justify-center h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs whitespace-nowrap transition shadow-xs"
        >
          + Find More Spots
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-200 gap-2 mb-8 overflow-x-auto pb-2.5">
        {['all', 'pending', 'confirmed', 'cancelled', 'completed'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setStatusFilter(tab);
              setPage(1);
            }}
            className={`inline-flex items-center justify-center h-9 px-4 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition cursor-pointer ${
              statusFilter === tab
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Backend Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm mb-8">
          <span className="font-semibold">Notice:</span> {errorMessage}
        </div>
      )}

      {/* Bookings List */}
      {bookings.length === 0 ? (
        <div className="p-12 rounded-2xl border border-slate-200 bg-white flex flex-col items-center justify-center text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl mb-4">
            🅿️
          </div>
          <h3 className="text-base font-bold text-slate-900">No bookings found</h3>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 max-w-sm leading-relaxed">
            You do not have any {statusFilter !== 'all' ? statusFilter : ''} reservations yet.
          </p>
          <Link
            href="/listings"
            className="mt-5 inline-flex items-center justify-center h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs whitespace-nowrap transition shadow-xs"
          >
            Explore Available Parking Spots
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => {
            const bId = booking.id || booking._id || '';
            const listing = typeof booking.listingId === 'object' ? booking.listingId : null;
            const canCancel =
              (booking.status === 'confirmed' || booking.status === 'pending') &&
              new Date(booking.endTime) > new Date();

            return (
              <div
                key={bId}
                className="p-6 rounded-2xl border border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-slate-300 hover:shadow-xs transition shadow-2xs"
              >
                {/* Info Left */}
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold text-slate-900">
                      {listing ? listing.title : 'Reserved Parking Space'}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                        booking.status === 'confirmed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : booking.status === 'cancelled'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : booking.status === 'completed'
                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      ● {booking.status}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {booking.paymentStatus === 'paid' ? 'PAID' : 'PENDING'}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono font-semibold text-blue-700">
                    Ref: {booking.bookingReference || (bId ? bId.substring(0, 8) : 'BK-RES')}
                    {booking.vehicleNumber && ` • Vehicle: ${booking.vehicleNumber}`}
                  </div>

                  {listing && listing.address && (
                    <div className="text-xs text-slate-500">
                      📍 {listing.address.street}, {listing.address.city}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600 pt-1">
                    <div>
                      <span className="text-slate-400">From:</span>{' '}
                      <span className="font-semibold text-slate-800">{formatDate(booking.startTime)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">To:</span>{' '}
                      <span className="font-semibold text-slate-800">{formatDate(booking.endTime)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Duration:</span>{' '}
                      <span className="font-semibold text-slate-800">{calculateHours(booking.startTime, booking.endTime)} hrs</span>
                    </div>
                  </div>

                  {booking.status === 'cancelled' && booking.cancellationReason && (
                    <div className="text-[11px] text-rose-600 italic pt-1">
                      Reason: {booking.cancellationReason}
                    </div>
                  )}
                </div>

                {/* Info Right & Actions */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100 gap-3">
                  <div className="text-right">
                    <div className="text-xs text-slate-400 font-medium">Total Billed</div>
                    <div className="text-lg font-extrabold text-slate-900">₹{booking.totalAmount}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {booking.paymentStatus !== 'paid' && booking.status !== 'cancelled' && (
                      <Link
                        href={`/bookings/${bId}/checkout`}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
                      >
                        Pay Now
                      </Link>
                    )}

                    <Link
                      href={`/bookings/${bId}/confirmation`}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition"
                    >
                      Receipt
                    </Link>

                    {canCancel && (
                      <button
                        onClick={() => {
                          setSelectedBookingForCancel(booking);
                          setCancelError(null);
                          setCancelReason('');
                        }}
                        className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!pagination.hasPrevPage}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
          >
            &larr; Previous
          </button>
          <span className="text-xs text-slate-500 font-medium">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!pagination.hasNextPage}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
          >
            Next &rarr;
          </button>
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {selectedBookingForCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md p-6 rounded-3xl border border-slate-200 bg-white shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Confirm Cancellation</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to cancel your reservation? This will immediately free up the parking slot for other drivers.
            </p>

            {cancelError && (
              <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-medium">
                {cancelError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for cancellation <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Plans changed, found alternative spot..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedBookingForCancel(null)}
                disabled={isCancelling}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleCancelConfirm}
                disabled={isCancelling}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition flex items-center gap-2 cursor-pointer shadow-xs"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
