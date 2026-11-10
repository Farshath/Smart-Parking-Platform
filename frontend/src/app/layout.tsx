import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import Navbar from '../components/Navbar';

export const metadata: Metadata = {
  title: 'Smart Parking Platform | Slot Rental & Availability',
  description:
    'Unified Mentor Internship - Full-stack smart parking slot rental and real-time availability platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
        <ToastProvider>
          <AuthProvider>
            <Suspense fallback={<header className="h-16 border-b border-slate-200 bg-white/90" />}>
              <Navbar />
            </Suspense>
            <div className="flex-1 flex flex-col">{children}</div>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
