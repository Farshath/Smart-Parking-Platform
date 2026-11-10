'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAutoRefreshOptions {
  /** Silent background fetch callback (should NOT trigger full-page loading skeletons). */
  onRefresh: () => Promise<void> | void;
  /** Polling interval in milliseconds (default: 10000ms). */
  intervalMs?: number;
  /** Whether auto-polling is enabled. */
  enabled?: boolean;
}

/**
 * Polls for fresh availability data when the browser tab is visible and triggers an
 * immediate background refresh whenever the user returns focus to the tab.
 */
export function useAutoRefresh({
  onRefresh,
  intervalMs = 10000,
  enabled = true,
}: UseAutoRefreshOptions) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const callbackRef = useRef(onRefresh);

  useEffect(() => {
    callbackRef.current = onRefresh;
  }, [onRefresh]);

  const triggerSync = useCallback(async () => {
    if (!enabled) return;
    setIsSyncing(true);
    try {
      await callbackRef.current();
      setLastSyncedAt(new Date());
    } catch {
      // Background polling failures are non-fatal; regular error states handle primary loads
    } finally {
      setIsSyncing(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void triggerSync();
      }
    }, intervalMs);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void triggerSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, intervalMs, triggerSync]);

  return { isSyncing, lastSyncedAt, triggerSync };
}

