'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const isOwner = user?.role === 'parking_owner' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  const navLinkBase =
    'inline-flex items-center justify-center h-9 px-3 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 leading-none transition';

  const mobileLinkBase =
    'flex items-center justify-between h-10 px-3.5 rounded-xl text-sm font-medium whitespace-nowrap transition';

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand + Desktop Navigation */}
        <div className="flex items-center gap-5 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2.5 group shrink-0 whitespace-nowrap"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition shrink-0">
              P
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="font-bold text-base tracking-tight text-slate-900">
                SmartPark
              </span>
              <span className="hidden sm:inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold whitespace-nowrap">
                Unified Mentor
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links (shown >= 1280px so all 7 role links stay single-line without squeezing) */}
          <nav
            aria-label="Primary Navigation"
            className="hidden xl:flex items-center gap-1.5"
          >
            <Link
              href="/listings"
              className={`${navLinkBase} ${
                isActive('/listings') && !pathname.includes('/new')
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Explore Spots
            </Link>

            {isAuthenticated && (
              <>
                <Link
                  href="/dashboard"
                  className={`${navLinkBase} ${
                    isActive('/dashboard')
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Dashboard
                </Link>

                <Link
                  href="/bookings"
                  className={`${navLinkBase} ${
                    isActive('/bookings')
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  My Bookings
                </Link>

                <Link
                  href="/payments"
                  className={`${navLinkBase} ${
                    isActive('/payments')
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Payments
                </Link>

                {isOwner && (
                  <Link
                    href="/owner"
                    className={`${navLinkBase} ${
                      isActive('/owner')
                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                        : 'text-blue-700 hover:bg-blue-50'
                    }`}
                  >
                    Owner Hub
                  </Link>
                )}

                {isOwner && (
                  <Link
                    href="/listings/new"
                    className={`${navLinkBase} ${
                      pathname === '/listings/new'
                        ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                        : 'text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                    }`}
                  >
                    + Add Parking
                  </Link>
                )}

                {isAdmin && (
                  <Link
                    href="/admin"
                    className={`${navLinkBase} ${
                      isActive('/admin')
                        ? 'bg-purple-600 text-white font-semibold shadow-xs'
                        : 'text-purple-700 hover:bg-purple-50 border border-purple-200'
                    }`}
                  >
                    Admin Portal
                  </Link>
                )}
              </>
            )}
          </nav>
        </div>

        {/* Right: Desktop User Profile & Actions */}
        <div className="hidden xl:flex items-center gap-3 shrink-0">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className={`flex flex-col items-end justify-center text-right h-11 px-2.5 rounded-xl transition hover:bg-slate-100 whitespace-nowrap ${
                  isActive('/profile') ? 'ring-2 ring-blue-500/30 bg-blue-50/50' : ''
                }`}
              >
                <span className="text-xs font-bold text-slate-800 leading-tight max-w-[160px] truncate">
                  {user.name}
                </span>
                <span className="mt-0.5 text-[10px] uppercase tracking-wider font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-blue-700 border border-slate-200 leading-none">
                  {user.role.replace('_', ' ')}
                </span>
              </Link>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center justify-center h-9 px-3.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition whitespace-nowrap shrink-0"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition whitespace-nowrap shrink-0"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>

        {/* Mobile / Tablet Controls (< 1280px) */}
        <div className="xl:hidden flex items-center gap-2.5 shrink-0">
          {isAuthenticated && user && (
            <Link
              href="/profile"
              className="hidden sm:inline-flex items-center gap-2 h-9 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition whitespace-nowrap"
            >
              <span className="max-w-[120px] truncate">{user.name}</span>
              <span className="text-[10px] uppercase font-mono text-blue-700">
                {user.role.replace('_', ' ')}
              </span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
            aria-label="Toggle Navigation Menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Responsive Mobile & Tablet Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-slate-200 bg-white px-4 sm:px-6 pt-3 pb-5 space-y-1.5 shadow-lg">
          {isAuthenticated && user && (
            <div className="pb-3 mb-2 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">{user.name}</div>
                <div className="text-xs text-slate-500 truncate">{user.email}</div>
              </div>
              <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap shrink-0">
                {user.role.replace('_', ' ')}
              </span>
            </div>
          )}

          <Link
            href="/listings"
            onClick={() => setMobileMenuOpen(false)}
            className={`${mobileLinkBase} ${
              isActive('/listings') && !pathname.includes('/new')
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Explore Spots
          </Link>

          {isAuthenticated ? (
            <>
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className={`${mobileLinkBase} ${
                  isActive('/dashboard')
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/bookings"
                onClick={() => setMobileMenuOpen(false)}
                className={`${mobileLinkBase} ${
                  isActive('/bookings')
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                My Bookings
              </Link>
              <Link
                href="/payments"
                onClick={() => setMobileMenuOpen(false)}
                className={`${mobileLinkBase} ${
                  isActive('/payments')
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Payments
              </Link>

              {isOwner && (
                <Link
                  href="/owner"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`${mobileLinkBase} ${
                    isActive('/owner')
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  Owner Hub
                </Link>
              )}

              {isOwner && (
                <Link
                  href="/listings/new"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`${mobileLinkBase} ${
                    pathname === '/listings/new'
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  + Add Parking
                </Link>
              )}

              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`${mobileLinkBase} ${
                    isActive('/admin')
                      ? 'bg-purple-600 text-white font-semibold'
                      : 'text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  Admin Portal
                </Link>
              )}

              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className={`${mobileLinkBase} ${
                  isActive('/profile')
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Account & Profile
              </Link>

              <div className="pt-2 mt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full h-10 inline-flex items-center justify-center rounded-xl text-sm font-semibold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <div className="pt-3 mt-2 border-t border-slate-100 grid grid-cols-2 gap-2.5">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex items-center justify-center h-10 rounded-xl text-sm font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition"
              >
                Log In
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex items-center justify-center h-10 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
