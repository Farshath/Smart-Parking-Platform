'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '../../lib/api';
import { Pagination, ParkingListing } from '../../types';
import { CardSkeletonGrid } from '../../components/Skeleton';
import AvailabilityBadge from '../../components/AvailabilityBadge';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

export default function ListingsPage() {
  const [listings, setListings] = useState<ParkingListing[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [maxRate, setMaxRate] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);

  const fetchListingsData = useCallback(
    async (currentPage: number, silent = false) => {
      if (!silent) {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const res = await api.listings.getAll({
          page: currentPage,
          limit: 9,
          search: search.trim() || undefined,
          city: city.trim() || undefined,
          maxRate: maxRate ? parseFloat(maxRate) : undefined,
          status: status || 'active',
        });

        setListings(res.listings || []);
        setPagination(res.pagination || null);
      } catch (err) {
        if (!silent) {
          if (err instanceof ApiError) {
            setErrorMessage(err.message);
          } else {
            setErrorMessage('Failed to load parking listings. Please try again.');
          }
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [search, city, maxRate, status]
  );

  useEffect(() => {
    void fetchListingsData(page);
  }, [page, fetchListingsData]);

  // Background polling for real-time capacity accuracy across sessions
  const { isSyncing, triggerSync } = useAutoRefresh({
    onRefresh: () => fetchListingsData(page, true),
    intervalMs: 10000,
    enabled: !isLoading,
  });

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void fetchListingsData(1);
  };

  const handleReset = () => {
    setSearch('');
    setCity('');
    setMaxRate('');
    setStatus('active');
    setPage(1);
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 animate-fade-in-up">
      {/* Page Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Find Parking Spots
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
            Browse verified parking slots with live capacity and instant reservation.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
          <span className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 shadow-2xs whitespace-nowrap">
            <span
              className={`w-2 h-2 rounded-full ${
                isSyncing ? 'bg-blue-500 animate-ping' : 'bg-emerald-500'
              }`}
            />
            {isSyncing ? 'Syncing availability...' : 'Auto-sync active (10s)'}
          </span>
          <button
            type="button"
            onClick={() => void triggerSync()}
            disabled={isSyncing}
            className="inline-flex items-center justify-center h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 whitespace-nowrap transition cursor-pointer disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <form
        onSubmit={handleFilterSubmit}
        className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
      >
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Keyword Search
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Chennai Central, Anna Nagar..."
            className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            City
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Chennai, Bengaluru..."
            className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Max Hourly Rate (₹)
          </label>
          <input
            type="number"
            min="0"
            value={maxRate}
            onChange={(e) => setMaxRate(e.target.value)}
            placeholder="e.g. 100"
            className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer"
          >
            <option value="active">Active Only</option>
            <option value="all">All Statuses</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 inline-flex items-center justify-center h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs whitespace-nowrap transition cursor-pointer"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center justify-center h-10 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-medium whitespace-nowrap transition cursor-pointer"
          >
            Reset
          </button>
        </div>
      </form>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm mb-8 flex items-center justify-between gap-4">
          <div>
            <span className="font-semibold">Notice:</span> {errorMessage}
          </div>
          <button
            type="button"
            onClick={() => void fetchListingsData(page)}
            className="px-3 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <CardSkeletonGrid count={6} />
      ) : listings.length === 0 ? (
        /* Empty State */
        <div className="p-12 text-center rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xl mb-4">
            🔍
          </div>
          <h3 className="text-lg font-bold text-slate-900">No parking spots found</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Try adjusting your keyword, city, or rate filters to see more available spaces.
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="mt-5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        /* Listings Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((item) => {
            const spotId = item.id || item._id || '';
            const isAvailable = item.status === 'active' && item.availableSlots > 0;

            return (
              <div
                key={spotId}
                className="rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between overflow-hidden group shadow-xs"
              >
                {item.images && item.images.length > 0 && (
                  <div className="h-44 w-full overflow-hidden bg-slate-100 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.images[0]}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase bg-white/90 text-slate-800 backdrop-blur border border-slate-200 shadow-xs">
                        {item.parkingType || 'Standard'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-6">
                  {/* Header & Availability Badge */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition line-clamp-1">
                      {item.title}
                    </h3>
                    <AvailabilityBadge
                      availableSlots={item.availableSlots}
                      totalSlots={item.totalSlots}
                      status={item.status}
                      compact
                    />
                  </div>

                  {/* Location */}
                  <div className="flex items-center text-xs text-slate-500 mb-3 gap-1.5">
                    <span>📍</span>
                    <span className="line-clamp-1">
                      {item.address.street}, {item.address.city}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4">
                    {item.description || 'Verified private parking slot with convenient access.'}
                  </p>

                  {/* Amenities */}
                  {item.amenities && item.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {item.amenities.slice(0, 3).map((amenity, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 capitalize font-medium"
                        >
                          {amenity.replace('_', ' ')}
                        </span>
                      ))}
                      {item.amenities.length > 3 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">
                          +{item.amenities.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="p-5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-extrabold text-slate-900">
                      ₹{item.hourlyRate}
                      <span className="text-xs font-normal text-slate-500"> / hr</span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      <span
                        className={`font-bold ${
                          isAvailable ? 'text-blue-700' : 'text-rose-600'
                        }`}
                      >
                        {item.availableSlots}
                      </span>{' '}
                      of {item.totalSlots} slots free
                    </div>
                  </div>

                  {isAvailable && spotId ? (
                    <Link
                      href={`/listings/${spotId}`}
                      className="inline-flex items-center justify-center h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs whitespace-nowrap transition shrink-0"
                    >
                      Reserve &rarr;
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center justify-center h-9 px-4 rounded-xl bg-slate-200 text-slate-500 font-semibold text-xs whitespace-nowrap cursor-not-allowed shrink-0"
                    >
                      {item.status !== 'active' ? 'Unavailable' : 'No Slots'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!pagination.hasPrevPage}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
          >
            &larr; Previous
          </button>
          <span className="text-xs text-slate-600 font-medium">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!pagination.hasNextPage}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
          >
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
