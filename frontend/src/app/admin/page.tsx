'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api, ApiError } from '../../lib/api';
import { AdminStats, Booking, ListingStatus, ParkingListing, User, UserRole } from '../../types';
import { MetricSkeletonGrid, ListRowSkeleton } from '../../components/Skeleton';
import ConfirmModal from '../../components/ConfirmModal';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'listings' | 'bookings'>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);

  // Users tab state
  const [userList, setUserList] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  // Listings tab state
  const [listingList, setListingList] = useState<ParkingListing[]>([]);
  const [listingStatusFilter, setListingStatusFilter] = useState('all');

  // Bookings tab state
  const [bookingList, setBookingList] = useState<Booking[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [deleteTargetUser, setDeleteTargetUser] = useState<{ id: string; name: string } | null>(null);

  const loadAdminOverview = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.admin.getStats();
      setStats(res.stats);
      setRecentUsers(res.recentUsers);
      setRecentBookings(res.recentBookings);
    } catch (err) {
      if (!silent) {
        if (err instanceof ApiError) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage('Failed to load system metrics.');
        }
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await api.admin.getUsers({
        role: userRoleFilter === 'all' ? undefined : userRoleFilter,
        search: userSearch.trim() || undefined,
        limit: 25,
      });
      setUserList(res.users);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to load users',
        message: err instanceof Error ? err.message : 'Unable to fetch user roster.',
      });
    }
  }, [userRoleFilter, userSearch, showToast]);

  const loadListings = useCallback(async () => {
    try {
      const res = await api.admin.getListings({
        status: listingStatusFilter === 'all' ? undefined : listingStatusFilter,
        limit: 25,
      });
      setListingList(res.listings);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to load listings',
        message: err instanceof Error ? err.message : 'Unable to fetch listings.',
      });
    }
  }, [listingStatusFilter, showToast]);

  const loadBookings = useCallback(async () => {
    try {
      const res = await api.admin.getBookings({ limit: 25 });
      setBookingList(res.bookings);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to load bookings',
        message: err instanceof Error ? err.message : 'Unable to fetch bookings.',
      });
    }
  }, [showToast]);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/login?redirect=/admin');
        return;
      }
      if (user?.role !== 'admin') {
        showToast({
          type: 'error',
          title: 'Access Denied',
          message: 'Administrator privileges required.',
        });
        router.push('/dashboard');
        return;
      }
      void loadAdminOverview(false);
    }
  }, [authLoading, isAuthenticated, user, router, loadAdminOverview, showToast]);

  useAutoRefresh({
    onRefresh: () => loadAdminOverview(true),
    intervalMs: 15000,
    enabled: Boolean(isAuthenticated && user?.role === 'admin' && !isLoading),
  });

  useEffect(() => {
    if (activeTab === 'users') void loadUsers();
    if (activeTab === 'listings') void loadListings();
    if (activeTab === 'bookings') void loadBookings();
  }, [activeTab, loadUsers, loadListings, loadBookings]);

  const handleRoleChange = async (targetUserId: string, nextRole: string) => {
    setActionInProgress(targetUserId);
    setActionSuccess(null);
    try {
      await api.admin.updateUserRole(targetUserId, nextRole as UserRole);
      setUserList((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, role: nextRole as UserRole } : u))
      );
      const msg = `User role updated to '${nextRole}'.`;
      setActionSuccess(msg);
      showToast({ type: 'success', title: 'Role Updated', message: msg });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: err instanceof Error ? err.message : 'Failed to change role',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteTargetUser) return;
    setActionInProgress(deleteTargetUser.id);
    setActionSuccess(null);
    try {
      await api.admin.deleteUser(deleteTargetUser.id);
      setUserList((prev) => prev.filter((u) => u.id !== deleteTargetUser.id));
      const msg = `User "${deleteTargetUser.name}" deleted.`;
      setActionSuccess(msg);
      showToast({ type: 'success', title: 'User Removed', message: msg });
      setDeleteTargetUser(null);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: err instanceof Error ? err.message : 'Failed to delete user',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleListingStatusToggle = async (listingId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    setActionInProgress(listingId);
    setActionSuccess(null);
    try {
      await api.admin.updateListingStatus(listingId, nextStatus);
      setListingList((prev) =>
        prev.map((l) => (l.id === listingId ? { ...l, status: nextStatus as ListingStatus } : l))
      );
      const msg = `Listing status changed to '${nextStatus}'.`;
      setActionSuccess(msg);
      showToast({ type: 'success', title: 'Listing Updated', message: msg });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: err instanceof Error ? err.message : 'Failed to update listing',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
        <div className="p-8 rounded-2xl border border-slate-200 bg-white animate-pulse h-32" />
        <MetricSkeletonGrid count={4} />
        <ListRowSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 min-h-full animate-fade-in-up">
      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-2xl border border-purple-200 bg-white shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
            Platform Administrator Console
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Administrator Command Center
          </h1>
          <p className="text-sm text-slate-600 mt-1.5">
            System overview, user role management, listing moderation, and booking telemetry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            href="/owner"
            className="inline-flex items-center justify-center h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs whitespace-nowrap transition"
          >
            Owner View
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs whitespace-nowrap transition"
          >
            User View
          </Link>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs flex items-center justify-between gap-4">
          <span className="font-semibold">✓ {actionSuccess}</span>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-xs font-bold hover:text-emerald-950 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <div className="h-full flex flex-col justify-between p-5 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Users
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
            {stats?.users.total || 0}
          </div>
          <div className="mt-2 text-xs text-purple-700 font-semibold">
            {stats?.users.customers} customers &bull; {stats?.users.owners} owners
          </div>
        </div>

        <div className="h-full flex flex-col justify-between p-5 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Parking Listings
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
            {stats?.listings.total || 0}
          </div>
          <div className="mt-2 text-xs text-emerald-700 font-semibold">
            {stats?.listings.active} active spots
          </div>
        </div>

        <div className="h-full flex flex-col justify-between p-5 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Bookings
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
            {stats?.bookings.total || 0}
          </div>
          <div className="mt-2 text-xs text-blue-700 font-semibold">
            {stats?.bookings.confirmed} confirmed reservations
          </div>
        </div>

        <div className="h-full flex flex-col justify-between p-5 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Platform Revenue
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-700 tabular-nums">
            ₹{stats?.revenue.totalRevenue || 0}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            {stats?.revenue.completedPaymentsCount} paid transactions
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 gap-6 text-sm font-semibold overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`inline-flex items-center h-11 border-b-2 whitespace-nowrap shrink-0 transition cursor-pointer ${
            activeTab === 'overview'
              ? 'border-purple-600 text-purple-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          System Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`inline-flex items-center h-11 border-b-2 whitespace-nowrap shrink-0 transition cursor-pointer ${
            activeTab === 'users'
              ? 'border-purple-600 text-purple-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          User Management
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('listings')}
          className={`inline-flex items-center h-11 border-b-2 whitespace-nowrap shrink-0 transition cursor-pointer ${
            activeTab === 'listings'
              ? 'border-purple-600 text-purple-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Listing Moderation
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bookings')}
          className={`inline-flex items-center h-11 border-b-2 whitespace-nowrap shrink-0 transition cursor-pointer ${
            activeTab === 'bookings'
              ? 'border-purple-600 text-purple-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Bookings Monitoring
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Recent Users */}
          <div className="p-6 rounded-3xl border border-slate-200 bg-white space-y-4 shadow-xs">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Recently Registered Accounts
            </h2>
            <div className="space-y-3">
              {recentUsers.map((u) => (
                <div
                  key={u.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900">{u.name}</div>
                    <div className="text-[11px] text-slate-500">{u.email}</div>
                  </div>
                  <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    {u.role.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Reservations */}
          <div className="p-6 rounded-3xl border border-slate-200 bg-white space-y-4 shadow-xs">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Live Reservation Stream
            </h2>
            <div className="space-y-3">
              {recentBookings.map((b) => {
                const customer = typeof b.userId === 'object' ? b.userId : null;
                const spot = typeof b.listingId === 'object' ? b.listingId : null;

                return (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{spot?.title || 'Parking Spot'}</div>
                      <div className="text-[11px] text-slate-500">
                        By {customer?.name || 'Customer'} • Ref: {b.bookingReference || b.id.substring(0, 8)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-emerald-700">₹{b.totalAmount}</div>
                      <span className="text-[10px] uppercase font-bold text-slate-600">{b.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USERS */}
      {activeTab === 'users' && (
        <div className="p-6 rounded-3xl border border-slate-200 bg-white space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-base font-bold text-slate-900">Registered Users Roster</h2>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
                className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs shadow-2xs"
              />
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs shadow-2xs cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="customer">Customers</option>
                <option value="parking_owner">Owners</option>
                <option value="admin">Admins</option>
              </select>
              <button
                onClick={loadUsers}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Filter
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Phone</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {userList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3 font-bold text-slate-900">{u.name}</td>
                    <td className="py-3 px-3 text-slate-600 font-mono">{u.email}</td>
                    <td className="py-3 px-3 text-slate-500">{u.phoneNumber || '—'}</td>
                    <td className="py-3 px-3">
                      <select
                        value={u.role}
                        disabled={actionInProgress === u.id || u.id === user?.id}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="px-2 py-1 rounded bg-slate-50 border border-slate-300 text-slate-800 text-xs font-medium cursor-pointer"
                      >
                        <option value="customer">customer</option>
                        <option value="parking_owner">parking_owner</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {u.id !== user?.id && (
                        <button
                          type="button"
                          onClick={() => setDeleteTargetUser({ id: u.id, name: u.name })}
                          disabled={actionInProgress === u.id}
                          className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold cursor-pointer disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LISTINGS */}
      {activeTab === 'listings' && (
        <div className="p-6 rounded-3xl border border-slate-200 bg-white space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">All Platform Listings</h2>
            <select
              value={listingStatusFilter}
              onChange={(e) => setListingStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div className="space-y-3">
            {listingList.map((spot) => {
              const owner = typeof spot.ownerId === 'object' ? spot.ownerId : null;
              return (
                <div
                  key={spot.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{spot.title}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                          spot.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        ● {spot.status}
                      </span>
                    </div>
                    <p className="text-slate-500">
                      📍 {spot.address.street}, {spot.address.city} • Owner: {owner?.name || 'Owner'}
                    </p>
                    <div className="text-[11px] text-slate-400">
                      Rate: ₹{spot.hourlyRate}/hr • Capacity: {spot.availableSlots}/{spot.totalSlots} Slots
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleListingStatusToggle(spot.id, spot.status)}
                      disabled={actionInProgress === spot.id}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                    >
                      {spot.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <Link
                      href={`/listings/${spot.id}`}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs"
                    >
                      Inspect
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: BOOKINGS */}
      {activeTab === 'bookings' && (
        <div className="p-6 rounded-3xl border border-slate-200 bg-white space-y-4 shadow-xs">
          <h2 className="text-base font-bold text-slate-900">Platform Bookings Stream</h2>

          <div className="space-y-3">
            {bookingList.map((b) => {
              const customer = typeof b.userId === 'object' ? b.userId : null;
              const listing = typeof b.listingId === 'object' ? b.listingId : null;

              return (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{listing?.title || 'Parking Spot'}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-blue-50 text-blue-700 border border-blue-200">
                        {b.status}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {b.paymentStatus === 'paid' ? 'PAID' : 'PENDING'}
                      </span>
                    </div>
                    <div className="text-slate-700">
                      Customer: {customer?.name || 'Customer'} ({customer?.email})
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Ref: {b.bookingReference || b.id} • {new Date(b.startTime).toLocaleString()}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-extrabold text-emerald-700">₹{b.totalAmount}</div>
                    <Link
                      href={`/bookings/${b.id}/confirmation`}
                      className="text-blue-600 hover:underline text-[11px] font-semibold"
                    >
                      Receipt &rarr;
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTargetUser)}
        title="Delete User Account?"
        description={`Are you sure you want to delete user "${
          deleteTargetUser?.name || ''
        }"? This will remove their access and associated records.`}
        confirmLabel="Delete User"
        variant="danger"
        isProcessing={Boolean(actionInProgress)}
        onCancel={() => setDeleteTargetUser(null)}
        onConfirm={() => void handleConfirmDeleteUser()}
      />
    </div>
  );
}
