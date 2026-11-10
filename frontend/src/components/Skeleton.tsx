import React from 'react';

export function SkeletonBox({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`}
      aria-hidden="true"
    />
  );
}

export function MetricSkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3"
        >
          <SkeletonBox className="h-3.5 w-24" />
          <SkeletonBox className="h-8 w-16" />
          <SkeletonBox className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs flex flex-col justify-between"
        >
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center gap-3">
              <SkeletonBox className="h-5 w-40" />
              <SkeletonBox className="h-5 w-16 rounded-full" />
            </div>
            <SkeletonBox className="h-3.5 w-48" />
            <div className="space-y-2">
              <SkeletonBox className="h-3 w-full" />
              <SkeletonBox className="h-3 w-4/5" />
            </div>
            <div className="flex gap-2">
              <SkeletonBox className="h-5 w-14 rounded-md" />
              <SkeletonBox className="h-5 w-16 rounded-md" />
              <SkeletonBox className="h-5 w-14 rounded-md" />
            </div>
          </div>
          <div className="p-5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="space-y-1.5">
              <SkeletonBox className="h-5 w-20" />
              <SkeletonBox className="h-3 w-28" />
            </div>
            <SkeletonBox className="h-9 w-24 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="space-y-2.5 flex-1">
            <div className="flex items-center gap-2">
              <SkeletonBox className="h-4 w-44" />
              <SkeletonBox className="h-4 w-16 rounded-full" />
            </div>
            <SkeletonBox className="h-3 w-64" />
            <SkeletonBox className="h-3 w-48" />
          </div>
          <div className="flex items-center gap-3">
            <SkeletonBox className="h-8 w-16" />
            <SkeletonBox className="h-9 w-24 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      <SkeletonBox className="h-4 w-32" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 p-8 rounded-3xl border border-slate-200 bg-white space-y-6">
          <div className="flex justify-between">
            <SkeletonBox className="h-6 w-28 rounded-full" />
            <SkeletonBox className="h-8 w-24" />
          </div>
          <SkeletonBox className="h-8 w-72" />
          <SkeletonBox className="h-4 w-80" />
          <div className="grid grid-cols-3 gap-4 pt-4">
            <SkeletonBox className="h-20 rounded-xl" />
            <SkeletonBox className="h-20 rounded-xl" />
            <SkeletonBox className="h-20 rounded-xl" />
          </div>
          <SkeletonBox className="h-24 w-full" />
        </div>
        <div className="p-6 rounded-3xl border border-slate-200 bg-white space-y-5 h-fit">
          <SkeletonBox className="h-6 w-40" />
          <SkeletonBox className="h-11 w-full" />
          <SkeletonBox className="h-11 w-full" />
          <SkeletonBox className="h-24 w-full" />
          <SkeletonBox className="h-11 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

