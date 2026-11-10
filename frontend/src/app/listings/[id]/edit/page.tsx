'use client';

import React, { Suspense, useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../context/ToastContext';
import { api, ApiError } from '../../../../lib/api';
import { ParkingListing } from '../../../../types';
import { DetailPageSkeleton } from '../../../../components/Skeleton';

const AVAILABLE_AMENITIES = [
  { id: 'cctv', label: 'CCTV Surveillance' },
  { id: 'covered', label: 'Covered Roof' },
  { id: 'ev_charging', label: 'EV Charging Port' },
  { id: 'security_guard', label: '24/7 Security Guard' },
  { id: 'wheelchair_accessible', label: 'Wheelchair Accessible' },
  { id: 'valet', label: 'Valet Service' },
  { id: 'well_lit', label: 'Well-Lit Night Parking' },
  { id: 'car_wash', label: 'Car Wash Available' },
];

function EditListingContent({ idPromise }: { idPromise: Promise<{ id: string }> }) {
  const { id: listingId } = use(idPromise);
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'India',
    hourlyRate: 50,
    dailyRate: 400,
    parkingType: 'covered' as const,
    totalSlots: 5,
    availableSlots: 5,
    openTime: '06:00',
    closeTime: '23:00',
    is24_7: false,
    imageUrl: '',
    amenities: [] as string[],
    status: 'active' as const,
  });

  const loadListing = React.useCallback(async () => {
    if (!listingId || listingId === 'undefined' || listingId === 'null') {
      setIsLoading(false);
      setErrorMessage('Invalid listing identifier.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.listings.getById(listingId);
      const l: ParkingListing = res.listing;

      // Check ownership
      const ownerId = typeof l.ownerId === 'object' ? (l.ownerId.id || l.ownerId._id) : l.ownerId;
      const currentUserId = user?.id || user?._id;
      if (ownerId && currentUserId && ownerId !== currentUserId && user?.role !== 'admin') {
        showToast({
          type: 'error',
          title: 'Permission Denied',
          message: 'You do not have permission to edit this listing.',
        });
        router.push('/owner');
        return;
      }

      setFormData({
        title: l.title,
        description: l.description || '',
        street: l.address.street,
        city: l.address.city,
        state: l.address.state || '',
        zipCode: l.address.zipCode || '',
        country: l.address.country || 'India',
        hourlyRate: l.hourlyRate,
        dailyRate: l.dailyRate || l.hourlyRate * 10,
        parkingType: (l.parkingType as any) || 'standard',
        totalSlots: l.totalSlots,
        availableSlots: l.availableSlots,
        openTime: l.operatingHours?.open || '06:00',
        closeTime: l.operatingHours?.close || '23:00',
        is24_7: !!l.operatingHours?.is24_7,
        imageUrl: l.images && l.images.length > 0 ? l.images[0] : '',
        amenities: l.amenities || [],
        status: (l.status as any) || 'active',
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to load listing information.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [listingId, user, router, showToast]);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push(`/login?redirect=/listings/${listingId}/edit`);
        return;
      }
      loadListing();
    }
  }, [authLoading, isAuthenticated, listingId, loadListing, router]);

  const toggleAmenity = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(id)
        ? prev.amenities.filter((a) => a !== id)
        : [...prev.amenities, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (formData.availableSlots > formData.totalSlots) {
      setErrorMessage('Available slots cannot exceed total slots.');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.listings.update(listingId, {
        title: formData.title.trim(),
        description: formData.description.trim(),
        address: {
          street: formData.street.trim(),
          city: formData.city.trim(),
          state: formData.state.trim() || undefined,
          zipCode: formData.zipCode.trim() || undefined,
          country: formData.country.trim() || 'India',
        },
        hourlyRate: Number(formData.hourlyRate),
        dailyRate: Number(formData.dailyRate),
        parkingType: formData.parkingType,
        totalSlots: Number(formData.totalSlots),
        availableSlots: Number(formData.availableSlots),
        operatingHours: {
          open: formData.openTime,
          close: formData.closeTime,
          is24_7: formData.is24_7,
        },
        images: formData.imageUrl ? [formData.imageUrl.trim()] : [],
        amenities: formData.amenities,
        status: formData.status,
      });

      const msg = 'Parking listing updated successfully!';
      setSuccessMessage(msg);
      showToast({ type: 'success', title: 'Listing Updated', message: msg });
      setTimeout(() => {
        router.push(`/listings/${listingId}`);
      }, 800);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Failed to update listing. Please verify inputs.';
      setErrorMessage(msg);
      showToast({ type: 'error', title: 'Update Failed', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6 bg-slate-50">
      <Link
        href="/owner"
        className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
      >
        &larr; Back to Owner Hub
      </Link>

      <div className="p-8 rounded-3xl border border-slate-200 bg-white shadow-xs">
        <div className="mb-6 pb-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Edit Parking Listing
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Update capacity, pricing, operating schedule, or address info.
            </p>
          </div>
          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
            ID: {listingId.substring(0, 8)}...
          </span>
        </div>

        {successMessage && (
          <div className="p-4 mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold">
            ✓ {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="p-4 mb-6 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-700">
              1. Listing Status & Basics
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Availability Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                >
                  <option value="active">Active (Accepting Bookings)</option>
                  <option value="inactive">Inactive / Hidden</option>
                  <option value="maintenance">Under Maintenance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Parking Type
                </label>
                <select
                  value={formData.parkingType}
                  onChange={(e) => setFormData({ ...formData, parkingType: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                >
                  <option value="covered">Covered Roof</option>
                  <option value="underground">Underground Basement</option>
                  <option value="garage">Multi-Level Garage</option>
                  <option value="open">Open Lot</option>
                  <option value="valet">Valet Attended</option>
                  <option value="rooftop">Rooftop</option>
                  <option value="standard">Standard Lot</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
            </div>
          </div>

          {/* Section 2: Pricing and Slots */}
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-700">
              2. Pricing & Capacity
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hourly Rate (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Daily Rate (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.dailyRate}
                  onChange={(e) => setFormData({ ...formData, dailyRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Total Capacity
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.totalSlots}
                  onChange={(e) => setFormData({ ...formData, totalSlots: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Available Slots
                </label>
                <input
                  type="number"
                  min="0"
                  max={formData.totalSlots}
                  value={formData.availableSlots}
                  onChange={(e) => setFormData({ ...formData, availableSlots: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Amenities */}
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-700">
              3. Amenities
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {AVAILABLE_AMENITIES.map((amenity) => {
                const selected = formData.amenities.includes(amenity.id);
                return (
                  <button
                    type="button"
                    key={amenity.id}
                    onClick={() => toggleAmenity(amenity.id)}
                    className={`p-3 rounded-xl border text-xs text-left transition cursor-pointer ${
                      selected
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span>{selected ? '✓ ' : '+ '}</span>
                    {amenity.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
            <Link
              href="/owner"
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="w-8 h-8 mx-auto border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm text-slate-500">Loading spot details...</p>
        </div>
      }
    >
      <EditListingContent idPromise={params} />
    </Suspense>
  );
}
