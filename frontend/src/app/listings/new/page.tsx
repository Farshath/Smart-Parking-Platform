'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { api, ApiError } from '../../../lib/api';

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

const PRESET_IMAGES = [
  { label: 'Modern Underground Garage', url: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80' },
  { label: 'Commercial Open Parking', url: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=800&q=80' },
  { label: 'Covered Multi-Level Garage', url: 'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=800&q=80' },
  { label: 'Private Driveway Spot', url: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80' },
];

export default function AddParkingListingPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

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
    selectedImage: PRESET_IMAGES[0].url,
    customImageUrl: '',
    amenities: ['cctv', 'covered'] as string[],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/login?redirect=/listings/new');
        return;
      }
      if (user?.role !== 'parking_owner' && user?.role !== 'admin') {
        showToast({
          type: 'error',
          title: 'Access Denied',
          message: 'Only registered parking owners or administrators can publish parking spaces.',
        });
        router.push('/dashboard');
      }
    }
  }, [authLoading, isAuthenticated, user, router, showToast]);

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

    if (formData.availableSlots > formData.totalSlots) {
      setErrorMessage('Available slots cannot exceed total slots.');
      return;
    }

    setIsSubmitting(true);

    const imageUrl = formData.customImageUrl.trim() || formData.selectedImage;

    try {
      const res = await api.listings.create({
        title: formData.title.trim(),
        description: formData.description.trim(),
        address: {
          street: formData.street.trim(),
          city: formData.city.trim(),
          state: formData.state.trim() || undefined,
          zipCode: formData.zipCode.trim() || undefined,
          country: formData.country.trim() || 'India',
        },
        hourlyRate: formData.hourlyRate,
        dailyRate: formData.dailyRate || undefined,
        parkingType: formData.parkingType,
        totalSlots: formData.totalSlots,
        availableSlots: formData.availableSlots,
        operatingHours: {
          open: formData.openTime,
          close: formData.closeTime,
          is24_7: formData.is24_7,
        },
        images: imageUrl ? [imageUrl] : [],
        amenities: formData.amenities,
      });

      showToast({
        type: 'success',
        title: 'Parking Spot Published',
        message: `"${res.listing.title}" is now live on the platform.`,
      });
      router.push(`/listings/${res.listing.id}`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Failed to create parking listing. Please verify inputs.';
      setErrorMessage(msg);
      showToast({ type: 'error', title: 'Publish Failed', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-8 h-8 mx-auto border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm text-slate-500">Verifying permissions...</p>
      </div>
    );
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
        <div className="mb-6 pb-6 border-b border-slate-100">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Add New Parking Space
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Provide details about your parking facility to publish it on the SmartPark platform.
          </p>
        </div>

        {errorMessage && (
          <div className="p-4 mb-6 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Basic Info */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-700">
              1. General Details
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Listing Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Secure Underground Parking - MG Road"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description & Access Instructions
              </label>
              <textarea
                rows={3}
                placeholder="Describe entry gate, height restrictions, security guidelines, or nearby landmarks..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Parking Type *
                </label>
                <select
                  value={formData.parkingType}
                  onChange={(e) =>
                    setFormData({ ...formData, parkingType: e.target.value as any })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer"
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Operating Hours
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={formData.openTime}
                    onChange={(e) => setFormData({ ...formData, openTime: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs shadow-2xs"
                  />
                  <span className="text-slate-500 text-xs">to</span>
                  <input
                    type="time"
                    value={formData.closeTime}
                    onChange={(e) => setFormData({ ...formData, closeTime: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs shadow-2xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Address */}
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-700">
              2. Location & Address
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Street Address *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 42, 100 Feet Road, Indiranagar"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  City *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Bengaluru"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  State / Region
                </label>
                <input
                  type="text"
                  placeholder="e.g., Karnataka"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Postal / ZIP Code
                </label>
                <input
                  type="text"
                  placeholder="e.g., 560038"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Country
                </label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Pricing & Capacity */}
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-700">
              3. Pricing & Capacity
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hourly Rate (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.hourlyRate}
                  onChange={(e) =>
                    setFormData({ ...formData, hourlyRate: parseFloat(e.target.value) || 0 })
                  }
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
                  onChange={(e) =>
                    setFormData({ ...formData, dailyRate: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Total Slots *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.totalSlots}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      totalSlots: parseInt(e.target.value, 10) || 1,
                      availableSlots: Math.min(
                        formData.availableSlots,
                        parseInt(e.target.value, 10) || 1
                      ),
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Available Currently
                </label>
                <input
                  type="number"
                  min="0"
                  max={formData.totalSlots}
                  value={formData.availableSlots}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      availableSlots: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Parking Image */}
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-700">
              4. Facility Image
            </h2>

            <p className="text-xs text-slate-500">
              Select one of our curated high-resolution presets or enter an image URL:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PRESET_IMAGES.map((preset, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setFormData({ ...formData, selectedImage: preset.url, customImageUrl: '' })}
                  className={`rounded-2xl overflow-hidden border text-left transition cursor-pointer ${
                    formData.selectedImage === preset.url && !formData.customImageUrl
                      ? 'border-blue-600 ring-2 ring-blue-500/30 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="h-20 w-full overflow-hidden bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-2 text-[10px] font-semibold text-slate-800 line-clamp-1 bg-white">
                    {preset.label}
                  </div>
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Or Custom Image URL
              </label>
              <input
                type="url"
                placeholder="https://images.unsplash.com/..."
                value={formData.customImageUrl}
                onChange={(e) => setFormData({ ...formData, customImageUrl: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
            </div>
          </div>

          {/* Section 5: Amenities */}
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-700">
              5. Facilities & Amenities
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
              className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer"
            >
              {isSubmitting ? 'Publishing Spot...' : 'Publish Parking Spot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
