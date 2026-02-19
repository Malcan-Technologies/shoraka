"use client";

/** Business Details Skeleton
 *
 * What: Loading skeleton matching business-details-step layout with all form fields
 * Why: Prevents layout shift and matches exact spacing, grid, and field heights
 * Data: 2 sections (About Business, Why Raising Funds) + Declarations
 */

import { Skeleton } from "@/components/ui/skeleton";

const formOuterClassName =
  "w-full max-w-[1200px] flex flex-col gap-10 px-3";
const sectionWrapperClassName =
  "w-full max-w-[1200px]";
const rowGridClassName =
  "grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-x-12 gap-y-6 mt-4 w-full max-w-[1200px] items-start px-3";

export function BusinessDetailsSkeleton() {
  return (
    <div className={`${formOuterClassName} mt-1`}>
      {/* ===================== ABOUT YOUR BUSINESS ===================== */}
      <section className={`${sectionWrapperClassName} space-y-5`}>
        <div>
          <Skeleton className="h-6 w-[220px]" />
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className={rowGridClassName}>
          {/* What does your company do */}
          <Skeleton className="h-5 w-[280px]" />
          <Skeleton className="h-[120px] w-full rounded-xl" />

          {/* Main customers */}
          <Skeleton className="h-5 w-[280px]" />
          <Skeleton className="h-[120px] w-full rounded-xl" />

          {/* Single customer > 50% */}
          <Skeleton className="h-5 w-[280px]" />
          <div className="flex gap-6 items-center">
            <Skeleton className="h-5 w-[80px]" />
            <Skeleton className="h-5 w-[80px]" />
          </div>

          {/* Accounting software */}
          <Skeleton className="h-5 w-[280px]" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </section>

      {/* ===================== WHY ARE YOU RAISING FUNDS ===================== */}
      <section className={`${sectionWrapperClassName} space-y-4`}>
        <div>
          <Skeleton className="h-6 w-[260px]" />
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className={rowGridClassName}>
          {/* Financing for */}
          <Skeleton className="h-5 w-[280px]" />
          <Skeleton className="h-[120px] w-full rounded-xl" />

          {/* Funds usage */}
          <Skeleton className="h-5 w-[280px]" />
          <Skeleton className="h-[120px] w-full rounded-xl" />

          {/* Business plan */}
          <Skeleton className="h-5 w-[280px]" />
          <Skeleton className="h-[160px] w-full rounded-xl" />

          {/* Risks */}
          <Skeleton className="h-5 w-[280px]" />
          <Skeleton className="h-[120px] w-full rounded-xl" />

          {/* Backup plan */}
          <Skeleton className="h-5 w-[280px]" />
          <Skeleton className="h-[120px] w-full rounded-xl" />

          {/* Other P2P */}
          <Skeleton className="h-5 w-[280px]" />
          <div className="flex gap-6 items-center">
            <Skeleton className="h-5 w-[80px]" />
            <Skeleton className="h-5 w-[80px]" />
          </div>

          {/* Platform name */}
          <Skeleton className="h-5 w-[280px]" />
          <Skeleton className="h-10 w-full rounded-xl" />

          {/* Amount raised */}
          <Skeleton className="h-5 w-[280px]" />
          <Skeleton className="h-10 w-full rounded-xl" />

          {/* Same invoice */}
          <Skeleton className="h-5 w-[280px]" />
          <div className="flex gap-6 items-center">
            <Skeleton className="h-5 w-[80px]" />
            <Skeleton className="h-5 w-[80px]" />
          </div>
        </div>
      </section>

      {/* ===================== DECLARATIONS ===================== */}
      <section className={`${sectionWrapperClassName} space-y-4`}>
        <div>
          <Skeleton className="h-6 w-[160px]" />
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="h-4 w-4 rounded-sm mt-1" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[92%]" />
              <Skeleton className="h-4 w-[85%]" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
