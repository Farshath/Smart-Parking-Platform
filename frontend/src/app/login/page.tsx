'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api, ApiError } from '../../lib/api';

interface DemoAccount {
  key: 'customer' | 'parking_owner' | 'admin';
  cardTitle: string;
  roleLabel: string;
  email: string;
  password: string;
  purpose: string;
  buttonLabel: string;
  badgeClasses: string;
  buttonClasses: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    key: 'customer',
    cardTitle: 'Customer Demo',
    roleLabel: 'Customer',
    email: 'customer.demo@smartparking.com',
    password: 'Customer@123',
    purpose:
      'Browse parking spots, check availability, reserve parking slots, make simulated payments, and view booking history.',
    buttonLabel: 'Login as Customer',
    badgeClasses: 'bg-blue-50 text-blue-700 border-blue-200',
    buttonClasses:
      'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 shadow-blue-500/20',
  },
  {
    key: 'parking_owner',
    cardTitle: 'Parking Owner Demo',
    roleLabel: 'Parking Owner',
    email: 'owner.demo@smartparking.com',
    password: 'Owner@123',
    purpose:
      'Access the owner dashboard, add parking locations, manage spots, set hourly rates, and approve or reject bookings.',
    buttonLabel: 'Login as Owner',
    badgeClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    buttonClasses:
      'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 shadow-emerald-500/20',
  },
  {
    key: 'admin',
    cardTitle: 'Administrator Demo',
    roleLabel: 'Admin',
    email: 'admin.demo@smartparking.com',
    password: 'Admin@123',
    purpose:
      'Access the admin dashboard, manage users, monitor parking listings, view bookings, payments, and platform activity.',
    buttonLabel: 'Login as Admin',
    badgeClasses: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    buttonClasses:
      'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 shadow-indigo-500/20',
  },
];

function CopyIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 text-emerald-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeDemoKey, setActiveDemoKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const performLogin = async (
    targetEmail: string,
    targetPassword: string,
    demoKey?: string
  ) => {
    setErrorMessage(null);

    if (!targetEmail.trim() || !targetPassword) {
      setErrorMessage('Please provide both email and password.');
      return;
    }

    setIsLoading(true);
    setActiveDemoKey(demoKey || null);

    try {
      const response = await api.auth.login({
        email: targetEmail.trim().toLowerCase(),
        password: targetPassword,
      });

      login(response.token, response.user);
      showToast({
        type: 'success',
        title: 'Signed in successfully',
        message: `Welcome back, ${response.user.name}!`,
      });

      const redirect = !demoKey ? searchParams.get('redirect') : null;
      if (redirect) {
        router.push(redirect);
      } else if (response.user.role === 'parking_owner') {
        router.push('/owner');
      } else if (response.user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'An unexpected error occurred. Please try again.';
      setErrorMessage(msg);
      showToast({ type: 'error', title: 'Sign in failed', message: msg });
    } finally {
      setIsLoading(false);
      setActiveDemoKey(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(email, password);
  };

  const handleDemoLogin = async (account: DemoAccount) => {
    setEmail(account.email);
    setPassword(account.password);
    await performLogin(account.email, account.password, account.key);
  };

  const handleCopy = async (fieldId: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(fieldId);
      setTimeout(() => {
        setCopiedField((prev) => (prev === fieldId ? null : prev));
      }, 1800);
    } catch {
      // Fallback for restricted clipboard environments
      setCopiedField(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8 bg-slate-50">
      {/* Sign-In Form Card */}
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl border border-slate-200/90 shadow-md">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xl shadow-md shadow-blue-500/25 mb-4">
            P
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Or{' '}
            <Link
              href="/register"
              className="font-semibold text-blue-600 hover:text-blue-700 transition"
            >
              create a new account today
            </Link>
          </p>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm flex items-start gap-3">
            <span className="text-lg leading-none font-bold">&times;</span>
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition shadow-2xs"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition shadow-2xs"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md shadow-blue-500/20 cursor-pointer"
          >
            {isLoading && !activeDemoKey ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>

      {/* Demo Accounts Section */}
      <section className="w-full max-w-5xl mt-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold uppercase tracking-wider mb-2">
            <span>Demonstration Only</span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">
            Demo Accounts – Try the Platform
          </h3>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl mx-auto">
            Explore customer reservations, owner listing management, and admin analytics using one-click login or by copying the demonstration credentials below.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {DEMO_ACCOUNTS.map((account) => {
            const isThisDemoLoading = isLoading && activeDemoKey === account.key;
            const emailCopyId = `${account.key}-email`;
            const passCopyId = `${account.key}-password`;

            return (
              <div
                key={account.key}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h4 className="text-base font-bold text-slate-900">
                      {account.cardTitle}
                    </h4>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${account.badgeClasses}`}
                    >
                      {account.roleLabel}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    {account.purpose}
                  </p>

                  {/* Credentials Box */}
                  <div className="space-y-2.5 bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 mb-5">
                    <div>
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">
                        Demo Email
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-xs font-mono text-slate-800 truncate">
                          {account.email}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopy(emailCopyId, account.email)}
                          title="Copy demo email"
                          aria-label={`Copy ${account.roleLabel} email`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition shrink-0 cursor-pointer"
                        >
                          {copiedField === emailCopyId ? <CheckIcon /> : <CopyIcon />}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/80">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">
                        Demo Password
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-xs font-mono text-slate-800">
                          {account.password}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopy(passCopyId, account.password)}
                          title="Copy demo password"
                          aria-label={`Copy ${account.roleLabel} password`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition shrink-0 cursor-pointer"
                        >
                          {copiedField === passCopyId ? <CheckIcon /> : <CopyIcon />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleDemoLogin(account)}
                  className={`w-full flex items-center justify-center py-2.5 px-4 rounded-xl text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm cursor-pointer ${account.buttonClasses}`}
                >
                  {isThisDemoLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Signing in...
                    </span>
                  ) : (
                    account.buttonLabel
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center text-xs text-slate-500">
          Loading sign in...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
