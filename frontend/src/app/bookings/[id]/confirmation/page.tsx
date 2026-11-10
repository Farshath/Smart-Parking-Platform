'use client';

import React, { Suspense, useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../context/AuthContext';
import { api, ApiError } from '../../../../lib/api';
import { Booking } from '../../../../types';

function BookingConfirmationContent({ idPromise }: { idPromise: Promise<{ id: string }> }) {
  const { id: bookingId } = use(idPromise);
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadBooking = React.useCallback(async () => {
    if (!bookingId || bookingId === 'undefined' || bookingId === 'null') {
      setIsLoading(false);
      setErrorMessage('Invalid booking reservation requested.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.bookings.getById(bookingId);
      setBooking(res.booking);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to load reservation confirmation.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push(`/login?redirect=/bookings/${bookingId}/confirmation`);
        return;
      }
      loadBooking();
    }
  }, [bookingId, authLoading, isAuthenticated, router, loadBooking]);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-8 h-8 mx-auto border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm text-slate-500">Loading booking receipt...</p>
      </div>
    );
  }

  if (errorMessage || !booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="p-8 rounded-3xl border border-rose-200 bg-rose-50 text-rose-800">
          <h2 className="text-lg font-bold mb-2">Receipt Unavailable</h2>
          <p className="text-xs mb-6">{errorMessage || 'Booking receipt not found.'}</p>
          <Link
            href="/bookings"
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
          >
            &larr; Back to My Bookings
          </Link>
        </div>
      </div>
    );
  }

  const listing = typeof booking.listingId === 'object' ? booking.listingId : null;
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  const isPaid = booking.paymentStatus === 'paid';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6 bg-slate-50">
      {/* Success Badge */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 text-2xl font-bold shadow-xs">
          ✓
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Reservation & Receipt Confirmed!
        </h1>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Your parking spot is securely reserved. Present this digital confirmation or booking reference upon arrival.
        </p>
      </div>

      {/* Digital Receipt Card */}
      <div className="p-8 rounded-3xl border border-slate-200 bg-white shadow-md space-y-6 print:border-none print:shadow-none">
        {/* Receipt Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div>
            <span className="text-[10px] uppercase font-mono font-semibold tracking-wider text-slate-400 block">
              Official Booking Reference
            </span>
            <div className="text-lg sm:text-xl font-mono font-bold text-blue-700 tracking-wider">
              {booking.bookingReference || `BK-${booking.id.substring(0, 8).toUpperCase()}`}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${
                booking.status === 'confirmed'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              ● {booking.status}
            </span>

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${
                isPaid
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {isPaid ? 'PAID' : 'PAYMENT PENDING'}
            </span>
          </div>
        </div>

        {/* Spot and Schedule */}
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">{listing?.title || 'Parking Space'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              📍 {listing?.address ? `${listing.address.street}, ${listing.address.city}, ${listing.address.state || ''}` : ''}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-[11px] text-slate-400 font-semibold block">Arrival Schedule</span>
              <span className="text-xs font-bold text-slate-800">
                {start.toLocaleDateString()} at {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-semibold block">Departure Schedule</span>
              <span className="text-xs font-bold text-slate-800">
                {end.toLocaleDateString()} at {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {booking.vehicleNumber && (
              <div className="sm:col-span-2 pt-2 border-t border-slate-200 flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Assigned Vehicle Number:</span>
                <span className="font-mono font-bold text-blue-700 uppercase">{booking.vehicleNumber}</span>
              </div>
            )}
          </div>
        </div>

        {/* Billing Breakdown */}
        <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>Hourly Rental Rate:</span>
            <span className="text-slate-800 font-medium">₹{listing?.hourlyRate || 0}/hour</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Calculated Total Duration:</span>
            <span className="text-slate-800 font-medium">
              {Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 10) / 10} hours
            </span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Platform Convenience Fee:</span>
            <span className="text-emerald-700 font-bold">₹0.00 (Free Demo)</span>
          </div>
          <div className="pt-3 border-t border-slate-100 flex justify-between text-base font-extrabold text-slate-900">
            <span>Total Amount:</span>
            <span className="text-blue-600 font-extrabold">₹{booking.totalAmount}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition cursor-pointer"
          >
            🖨️ Print Receipt
          </button>

          <div className="flex gap-2">
            {!isPaid && booking.status !== 'cancelled' && (
              <Link
                href={`/bookings/${booking.id}/checkout`}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
              >
                Pay Now &rarr;
              </Link>
            )}
            <Link
              href="/bookings"
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition"
            >
              My Bookings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="w-8 h-8 mx-auto border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm text-slate-500">Loading booking receipt...</p>
        </div>
      }
    >
      <BookingConfirmationContent idPromise={params} />
    </Suspense>
  );
}
