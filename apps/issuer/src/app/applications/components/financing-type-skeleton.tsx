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
      <div className="w-full rounded-xl border border-input bg-card px-4 py-3 min-h-[80px] flex items-center">
        <div className="flex w-full justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Product image placeholder */}
            <div className="w-14 h-14 rounded-xl border border-input bg-muted overflow-hidden flex items-center justify-center shrink-0">
              <Skeleton className="h-full w-full" />
            </div>

            {/* Product text placeholder - name and description */}
            <div className="min-w-0 flex-1">
              <div className="space-y-1">
                <Skeleton className="h-5 w-[62%] rounded" />
                <Skeleton className="h-4 w-[78%] rounded" />
              </div>
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
        <div className="border-b border-border mt-3 -mb-1" />
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
