'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  type: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: string;
}

interface ToastContextType {
  showToast: (options: ToastOptions) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_STYLES: Record<
  ToastType,
  { container: string; iconBg: string; icon: string }
> = {
  success: {
    container: 'border-emerald-200 bg-white text-slate-900 shadow-lg shadow-emerald-900/5',
    iconBg: 'bg-emerald-100 text-emerald-700',
    icon: '✓',
  },
  error: {
    container: 'border-rose-200 bg-white text-slate-900 shadow-lg shadow-rose-900/5',
    iconBg: 'bg-rose-100 text-rose-700',
    icon: '!',
  },
  warning: {
    container: 'border-amber-200 bg-white text-slate-900 shadow-lg shadow-amber-900/5',
    iconBg: 'bg-amber-100 text-amber-700',
    icon: '⚠',
  },
  info: {
    container: 'border-blue-200 bg-white text-slate-900 shadow-lg shadow-blue-900/5',
    iconBg: 'bg-blue-100 text-blue-700',
    icon: 'i',
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, durationMs = 4200 }: ToastOptions) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-4), { id, type, title, message, durationMs }]);

      if (durationMs > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, durationMs);
      }
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}

      {/* Accessible Global Toast Viewport */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2.5 w-full max-w-sm pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((toast) => {
          const style = TOAST_STYLES[toast.type];
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto animate-toast-in rounded-2xl border p-4 flex items-start gap-3 transition-all ${style.container}`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 mt-0.5 ${style.iconBg}`}
              >
                {style.icon}
              </span>
              <div className="flex-1 min-w-0">
                {toast.title && (
                  <p className="text-xs font-bold text-slate-900 mb-0.5">
                    {toast.title}
                  </p>
                )}
                <p className="text-xs text-slate-600 leading-relaxed break-words">
                  {toast.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
                className="text-slate-400 hover:text-slate-700 text-sm leading-none p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                &times;
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};

