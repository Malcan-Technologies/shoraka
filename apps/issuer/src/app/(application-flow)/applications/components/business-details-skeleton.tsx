"use client";

/** Business Details Skeleton
 *
 * What: Loading skeleton matching business-details-step layout with all form fields
 * Why: Prevents layout shift and matches exact spacing, grid, and field heights
 * Data: 2 sections (About Business, Why Raising Funds) + Declarations
 */

import { Skeleton } from "@/components/ui/skeleton";

const formOuterClassName = "w-full flex flex-col gap-12 md:gap-14 px-3";
const sectionWrapperClassName = "w-full";
const rowGridClassName =
  "grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-x-12 gap-y-8 mt-5 w-full items-start px-3";

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

      {/* ===================== GUARANTOR DETAILS ===================== */}
      <section className={`${sectionWrapperClassName} space-y-5`}>
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-6 w-[180px]" />
            <Skeleton className="h-10 w-full sm:w-[160px] rounded-xl shrink-0" />
          </div>
          <div className="mt-3 mb-4 h-px bg-border" />
        </div>
        <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
          <div className="flex justify-between items-center gap-3 pb-4 mb-4 border-b border-border">
            <Skeleton className="h-5 w-[120px]" />
            <Skeleton className="h-8 w-[88px]" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-5 w-[140px]" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
        <Skeleton className="hidden h-12 w-full rounded-xl" aria-hidden />
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
