'use client';

import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="flex-1 flex flex-col justify-between bg-slate-50">
      {/* Hero Section */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 flex flex-col items-center text-center">
        {/* Status Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold mb-8 shadow-xs">
          <span>🚀 Smart Parking Platform • Live Monorepo</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl leading-tight">
          Smart Parking Slot Rental &{' '}
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent">
            Real-Time Availability
          </span>
        </h1>

        <p className="mt-6 text-slate-600 text-base sm:text-lg max-w-2xl leading-relaxed">
          Discover, compare, and reserve verified parking spots with atomic capacity protection, role-based dashboards, and instant digital receipts.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/listings"
            className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-500/25 transition"
          >
            Explore Available Spots &rarr;
          </Link>

          {isAuthenticated ? (
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard"
                className="px-6 py-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm shadow-xs transition"
              >
                Go to Dashboard
              </Link>
              {(user?.role === 'parking_owner' || user?.role === 'admin') && (
                <Link
                  href="/owner"
                  className="px-6 py-3.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100/70 text-blue-700 font-semibold text-sm shadow-xs transition"
                >
                  Owner Hub &rarr;
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="px-6 py-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm shadow-xs transition"
              >
                Create Account
              </Link>
              <Link
                href="/login"
                className="px-6 py-3.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-16 w-full grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold mb-4">
              ⚡
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1.5">Real-Time Availability</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Live capacity monitoring prevents overbooking with mathematical interval overlap detection and atomic rollbacks.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold mb-4">
              🛡️
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1.5">Verified Parking Spaces</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Curated spots with 24/7 access, underground garages, valet options, and verified security amenities.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 font-bold mb-4">
              💳
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1.5">Instant Checkout & Receipts</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Transparent duration-based pricing calculation, simulated checkout, and printable digital receipts.
            </p>
          </div>
        </div>

        {/* Monorepo Architecture Overview */}
        <div className="mt-8 w-full grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {/* Frontend Card */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900">Next.js App Router Frontend</h2>
              <span className="text-xs px-2.5 py-1 rounded-md bg-sky-50 text-sky-700 border border-sky-200 font-mono font-semibold">
                Port 3000
              </span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Equipped with Search & Filters, Real-Time Price Estimator, Session Authentication, and Role-Based Dashboards.
            </p>
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="px-2.5 py-1 rounded-md bg-slate-100 font-medium">Next.js 16</span>
              <span className="px-2.5 py-1 rounded-md bg-slate-100 font-medium">React 19</span>
              <span className="px-2.5 py-1 rounded-md bg-slate-100 font-medium">Tailwind CSS v4</span>
            </div>
          </div>

          {/* Backend Card */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900">Express & MongoDB Atlas API</h2>
              <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-semibold">
                Port 5000
              </span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Engineered with atomic capacity checks, bcryptjs salted hashing, JWT verification, and Mongoose indexing.
            </p>
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="px-2.5 py-1 rounded-md bg-slate-100 font-medium">Express 4.21</span>
              <span className="px-2.5 py-1 rounded-md bg-slate-100 font-medium">Mongoose 8.9</span>
              <span className="px-2.5 py-1 rounded-md bg-slate-100 font-medium">Zod Validation</span>
            </div>
          </div>
        </div>

        {/* API Check */}
        <div className="mt-8 w-full p-5 rounded-xl border border-slate-200 bg-white shadow-xs text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-slate-900">Backend Health Endpoint</div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">GET /api/health</div>
          </div>
          <a
            href="http://localhost:5000/api/health"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition shadow-sm"
          >
            Check Health Response &rarr;
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 bg-white">
        Unified Mentor Internship &bull; Smart Parking Slot Rental & Availability Platform
      </footer>
    </div>
  );
}
