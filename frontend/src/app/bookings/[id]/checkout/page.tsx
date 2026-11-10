'use client';

import React, { Suspense, useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../context/ToastContext';
import { api, ApiError } from '../../../../lib/api';
import { Booking } from '../../../../types';
import { DetailPageSkeleton } from '../../../../components/Skeleton';

function BookingCheckoutContent({ idPromise }: { idPromise: Promise<{ id: string }> }) {
  const { id: bookingId } = use(idPromise);
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi' | 'wallet' | 'netbanking'>('upi');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Form inputs for mock payment
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [upiId, setUpiId] = useState('internship.tester@okaxis');

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

      if (res.booking.paymentStatus === 'paid') {
        const resolvedId = res.booking.id || res.booking._id || bookingId;
        router.push(`/bookings/${resolvedId}/confirmation`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to load reservation details.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [bookingId, router]);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push(`/login?redirect=/bookings/${bookingId}/checkout`);
        return;
      }
      loadBooking();
    }
  }, [bookingId, authLoading, isAuthenticated, router, loadBooking]);

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    setPaymentError(null);
    setIsProcessing(true);

    try {
      const res = await api.payments.process({
        bookingId,
        paymentMethod: paymentMethod === 'card' ? 'card' : paymentMethod === 'upi' ? 'upi' : 'simulated_test',
        simulateFailure,
      });

      if (simulateFailure || res.payment.status === 'failed') {
        const msg = 'Simulated payment failed — held parking slot capacity has been released.';
        setPaymentError(msg);
        showToast({ type: 'error', title: 'Payment Failed', message: msg });
        return;
      }

      showToast({
        type: 'success',
        title: 'Payment Completed',
        message: `Transaction ${res.payment.transactionId} confirmed!`,
      });
      router.push(`/bookings/${bookingId}/confirmation`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Payment processing failed. Please try again.';
      setPaymentError(msg);
      showToast({ type: 'error', title: 'Payment Failed', message: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (errorMessage || !booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="p-8 rounded-3xl border border-rose-200 bg-rose-50 text-rose-800">
          <h2 className="text-lg font-bold mb-2">Reservation Error</h2>
          <p className="text-sm mb-6">{errorMessage || 'Reservation not found.'}</p>
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
  const durationHours = Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 10) / 10;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6 bg-slate-50">
      <Link
        href="/bookings"
        className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
      >
        &larr; Back to My Bookings
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        {/* Left Form: Payment Gateway Simulation */}
        <div className="md:col-span-3 space-y-6">
          <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-xs">
            {/* Header */}
            <div className="mb-6 pb-4 border-b border-slate-100">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 mb-2">
                ● Internship Demonstration Gateway
              </div>
              <h1 className="text-xl font-extrabold text-slate-900">Payment Checkout</h1>
              <p className="text-xs text-slate-500 mt-1">
                Complete slot payment to finalize your booking confirmation.
              </p>
            </div>

            {paymentError && (
              <div className="p-4 mb-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold">
                ⚠️ {paymentError}
              </div>
            )}

            <form onSubmit={handlePaymentSubmit} className="space-y-5">
              {/* Method Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Select Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                      paymentMethod === 'upi'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-base mb-1">📱</div>
                    <div className="text-xs">UPI / QR</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                      paymentMethod === 'card'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-base mb-1">💳</div>
                    <div className="text-xs">Credit/Debit Card</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('netbanking')}
                    className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                      paymentMethod === 'netbanking'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-base mb-1">🏦</div>
                    <div className="text-xs">Net Banking</div>
                  </button>
                </div>
              </div>

              {/* Method Details */}
              {paymentMethod === 'upi' && (
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Virtual Payment Address (VPA / UPI ID)
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-mono shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-500">
                    Simulated UPI handles instant authorization.
                  </p>
                </div>
              )}

              {paymentMethod === 'card' && (
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Card Number
                    </label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-mono shadow-2xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-500 font-medium mb-1">Expiry</label>
                      <input
                        type="text"
                        defaultValue="12/28"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-mono shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 font-medium mb-1">CVV</label>
                      <input
                        type="password"
                        defaultValue="888"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-mono shadow-2xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'netbanking' && (
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Select Test Bank
                  </label>
                  <select className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs shadow-2xs cursor-pointer">
                    <option>HDFC Bank (Simulated)</option>
                    <option>State Bank of India (Simulated)</option>
                    <option>ICICI Bank (Simulated)</option>
                    <option>Axis Bank (Simulated)</option>
                  </select>
                </div>
              )}

              {/* Simulation Testing Toggle */}
              <div className="p-3.5 rounded-2xl border border-dashed border-amber-300 bg-amber-50/80 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-amber-900">
                    Simulate Payment Failure
                  </div>
                  <div className="text-[11px] text-amber-700">
                    Test how the platform gracefully handles declined payments.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                />
              </div>

              {/* Disclaimer */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                ℹ️ <strong>Simulated Gateway:</strong> This module is configured for internship demonstration. All payment records are saved in MongoDB Atlas with distinct transaction identifiers without touching real bank APIs.
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Simulating Gateway Authorization...
                  </>
                ) : (
                  `Pay ₹${booking.totalAmount} & Complete Booking`
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Summary Card */}
        <div className="md:col-span-2 space-y-4">
          <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Booking Summary
            </h2>

            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">{listing?.title || 'Parking Spot'}</h3>
              <p className="text-xs text-slate-500">
                📍 {listing?.address ? `${listing.address.street}, ${listing.address.city}` : ''}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Booking Reference:</span>
                <span className="font-mono font-bold text-slate-900">
                  {booking.bookingReference || booking.id.substring(0, 8)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Arrival:</span>
                <span className="text-slate-800">
                  {start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Departure:</span>
                <span className="text-slate-800">
                  {end.toLocaleDateString()} {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Total Duration:</span>
                <span className="text-slate-900 font-bold">{durationHours} hours</span>
              </div>
              {booking.vehicleNumber && (
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>Vehicle:</span>
                  <span className="font-mono font-bold text-blue-700">{booking.vehicleNumber}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Base Rate:</span>
                <span className="text-slate-800 font-medium">₹{listing?.hourlyRate || 0}/hr</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span className="text-slate-800 font-medium">₹{booking.totalAmount}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Convenience Fee:</span>
                <span className="text-emerald-700 font-bold">FREE</span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between text-base font-extrabold text-slate-900">
                <span>Total Due:</span>
                <span className="text-blue-600 font-extrabold">₹{booking.totalAmount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingCheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="w-8 h-8 mx-auto border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm text-slate-500">Loading checkout session...</p>
        </div>
      }
    >
      <BookingCheckoutContent idPromise={params} />
    </Suspense>
  );
}
