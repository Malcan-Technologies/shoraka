"use client";

/** Financing Type Skeleton
 *
 * What: Loading skeleton that matches the 3-card product selector layout
 * Why: Prevents layout shift and matches actual card dimensions exactly
 * Data: Shows 2 category sections with 2 products each = 4 cards total
 */

import { Skeleton } from "@/components/ui/skeleton";

function SkeletonProductCard() {
  return (
    <div className="block w-full">
      <div className="w-full rounded-xl border border-border bg-background px-6 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            {/* Product image placeholder */}
            <div className="shrink-0">
              <div className="h-14 w-14 rounded-md border border-border bg-white overflow-hidden">
                <Skeleton className="h-full w-full" />
              </div>
            </div>

            {/* Product text placeholder */}
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-[20px] w-[62%] rounded" />
              <Skeleton className="h-[16px] w-[78%] rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonCategory() {
  return (
    <section className="space-y-4">
      {/* Category header */}
      <div>
        <Skeleton className="h-[24px] w-[160px] rounded" />
        <div className="mt-2 h-px bg-border" />
      </div>

      {/* 2 product cards per category */}
      <div className="space-y-3 px-3">
        <SkeletonProductCard />
        <SkeletonProductCard />
      </div>
    </section>
  );
}

export function FinancingTypeSkeleton() {
  return (
    <div className="px-3">
      <div className="space-y-10">
        <SkeletonCategory />
        <SkeletonCategory />
      </div>
    </div>
  );
}
