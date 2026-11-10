'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../lib/api';
import { Payment } from '../../types';
import { ListRowSkeleton } from '../../components/Skeleton';

export default function PaymentsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPayments = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.payments.getMyPayments({
        status: filterStatus === 'all' ? undefined : filterStatus,
      });
      setPayments(res.payments);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to load transaction history.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/login?redirect=/payments');
        return;
      }
      loadPayments();
    }
  }, [filterStatus, authLoading, isAuthenticated, router, loadPayments]);

  if (authLoading || isLoading) {
    return (
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
        <div className="p-8 rounded-2xl border border-slate-200 bg-white animate-pulse h-28" />
        <ListRowSkeleton count={4} />
      </div>
    );
  }

  const totalPaid = payments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 min-h-full animate-fade-in-up">
      {/* Header */}
      <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 bg-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            Billing & Receipts
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Payment Transactions
          </h1>
          <p className="text-sm text-slate-600 mt-1.5">
            Complete transaction ledger for all your parking reservations.
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 text-right shrink-0">
          <span className="text-[10px] text-slate-500 block uppercase font-mono font-semibold tracking-wider">
            Total Settled
          </span>
          <span className="text-2xl font-extrabold text-emerald-700 tabular-nums">
            ₹{Math.round(totalPaid * 100) / 100}
          </span>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold overflow-x-auto">
        {['all', 'completed', 'pending', 'failed'].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setFilterStatus(st)}
            className={`inline-flex items-center h-10 border-b-2 uppercase tracking-wider whitespace-nowrap shrink-0 transition cursor-pointer ${
              filterStatus === st
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Transactions List */}
      {payments.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-slate-200 bg-white shadow-xs">
          <span className="text-3xl block mb-2">💳</span>
          <h3 className="text-base font-bold text-slate-900">No Transactions Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Payment transactions created through the checkout gateway will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => {
            const booking = typeof p.bookingId === 'object' ? p.bookingId : null;
            const isSuccess = p.status === 'completed';

            return (
              <div
                key={p.id}
                className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-slate-900">{p.transactionId}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                        isSuccess
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : p.status === 'failed'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {p.status}
                    </span>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {p.paymentMethod}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500">
                    Booking: {booking?.bookingReference || p.bookingId ? `Ref: ${(booking?.bookingReference || p.bookingId as string).substring(0, 14)}` : 'Slot Reservation'}
                  </div>

                  <div className="text-[11px] text-slate-400">
                    {p.paidAt ? new Date(p.paidAt).toLocaleString() : new Date(p.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-base font-extrabold text-slate-900">₹{p.amount}</div>
                    <div className="text-[10px] text-slate-500">
                      {isSuccess ? 'Settled via Demo Gateway' : p.failureReason || 'Declined'}
                    </div>
                  </div>

                  {booking?.id && (
                    <Link
                      href={`/bookings/${booking.id}/confirmation`}
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
  );
}
