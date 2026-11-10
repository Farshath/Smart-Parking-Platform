import React from 'react';
import { ListingStatus } from '../types';

interface AvailabilityBadgeProps {
  availableSlots: number;
  totalSlots: number;
  status?: ListingStatus;
  showBar?: boolean;
  hideBadge?: boolean;
  compact?: boolean;
}

export function getAvailabilityMeta(
  availableSlots: number,
  totalSlots: number,
  status?: ListingStatus
) {
  const safeTotal = Math.max(1, totalSlots || 1);
  const safeAvailable = Math.max(0, Math.min(safeTotal, availableSlots ?? 0));
  const reservedSlots = Math.max(0, safeTotal - safeAvailable);
  const ratio = safeAvailable / safeTotal;

  if (status && status !== 'active') {
    return {
      level: 'red' as const,
      label: status === 'maintenance' ? 'Maintenance' : 'Unavailable',
      pillClasses: 'bg-rose-50 text-rose-700 border-rose-200',
      dotClasses: 'bg-rose-500',
      barClasses: 'bg-rose-500',
      safeTotal,
      safeAvailable,
      reservedSlots,
      occupiedPct: 100,
      availablePct: 0,
    };
  }

  if (safeAvailable <= 0) {
    return {
      level: 'red' as const,
      label: 'Fully Occupied',
      pillClasses: 'bg-rose-50 text-rose-700 border-rose-200',
      dotClasses: 'bg-rose-500',
      barClasses: 'bg-rose-500',
      safeTotal,
      safeAvailable: 0,
      reservedSlots: safeTotal,
      occupiedPct: 100,
      availablePct: 0,
    };
  }

  const isLimited = safeAvailable <= 2 || ratio <= 0.3;
  if (isLimited) {
    return {
      level: 'orange' as const,
      label: `Limited (${safeAvailable} left)`,
      pillClasses: 'bg-amber-50 text-amber-800 border-amber-200',
      dotClasses: 'bg-amber-500',
      barClasses: 'bg-amber-500',
      safeTotal,
      safeAvailable,
      reservedSlots,
      occupiedPct: Math.round((reservedSlots / safeTotal) * 100),
      availablePct: Math.round((safeAvailable / safeTotal) * 100),
    };
  }

  return {
    level: 'green' as const,
    label: 'Available',
    pillClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClasses: 'bg-emerald-500',
    barClasses: 'bg-emerald-500',
    safeTotal,
    safeAvailable,
    reservedSlots,
    occupiedPct: Math.round((reservedSlots / safeTotal) * 100),
    availablePct: Math.round((safeAvailable / safeTotal) * 100),
  };
}

export default function AvailabilityBadge({
  availableSlots,
  totalSlots,
  status = 'active',
  showBar = false,
  hideBadge = false,
  compact = false,
}: AvailabilityBadgeProps) {
  const meta = getAvailabilityMeta(availableSlots, totalSlots, status);

  return (
    <div className={showBar ? 'space-y-2' : 'inline-flex items-center'}>
      {!hideBadge && (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border font-bold whitespace-nowrap ${
            compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]'
          } ${meta.pillClasses}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClasses}`} />
          <span>{meta.label}</span>
        </span>
      )}

      {showBar && (
        <div className="space-y-1">
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200/70">
            <div
              className={`h-full transition-all duration-500 ${meta.barClasses}`}
              style={{ width: `${meta.availablePct}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-medium">
            <span>
              <strong className="text-slate-800">{meta.safeAvailable}</strong> available
            </span>
            <span>
              <strong className="text-slate-800">{meta.reservedSlots}</strong> reserved / {meta.safeTotal} total
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

