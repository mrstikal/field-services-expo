'use client';

import React from 'react';

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

/**
 * Skeleton Table Component
 * Shows loading state for data tables
 */
export function SkeletonTable({ rows = 5, columns = 4 }: SkeletonTableProps) {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="grid grid-cols-12 border-b border-gray-200 bg-gray-50 px-6 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="col-span-3 h-4 w-24 animate-pulse rounded bg-gray-200" />
        ))}
      </div>
      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-12 px-6 py-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div key={colIndex} className="col-span-3 h-4 w-20 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton Card Component
 * Shows loading state for card layouts
 */
export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 h-4 w-3/4 rounded bg-gray-200" />
      <div className="mb-2 h-3 w-1/2 rounded bg-gray-100" />
      <div className="h-3 w-1/3 rounded bg-gray-100" />
    </div>
  );
}

/**
 * Skeleton List Component
 * Shows loading state for list layouts
 */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="h-4 w-1/2 rounded bg-gray-200" />
            <div className="h-4 w-16 rounded bg-gray-100" />
          </div>
          <div className="mt-2 h-3 w-3/4 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton Stats Component
 * Shows loading state for statistics cards
 */
export function SkeletonStats({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-2 h-4 w-1/3 rounded bg-gray-200" />
          <div className="h-8 w-1/2 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton Form Component
 * Shows loading state for forms
 */
export function SkeletonForm() {
  return (
    <div className="space-y-4">
      <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-4 h-4 w-1/4 rounded bg-gray-200" />
        <div className="space-y-3">
          <div className="h-10 w-full rounded bg-gray-100" />
          <div className="h-10 w-full rounded bg-gray-100" />
          <div className="h-10 w-full rounded bg-gray-100" />
        </div>
      </div>
    </div>
  );
}

export default SkeletonTable;