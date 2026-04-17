"use client";

/**
 * Guide: docs/guides/application-flow/financial-statements-step.md — Loading skeleton for financial statements step
 */

import * as React from "react";

/**
 * Financial Statements Skeleton
 *
 * What: Loading skeleton matching financial-statements-step layout.
 * Why: Prevents layout shift; matches exact spacing, grid, and field heights.
 * Data: 4 sections (Assets, Liabilities, Equity, P&L) — no Financial Ratios.
 */

import { Skeleton } from "@/components/ui/skeleton";

const formOuterClassName = "w-full space-y-12 px-3 md:space-y-14";
const sectionWrapperClassName = "w-full";
const rowGridClassName =
  "grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 w-full items-start px-3";

export function FinancialStatementsSkeleton() {
  return (
    <div className={`${formOuterClassName} mt-1`}>
      {/* Assets (4 fields) */}
      <section className={`${sectionWrapperClassName} space-y-5`}>
        <div>
          <Skeleton className="h-6 w-[80px]" />
          <div className="mt-2 h-px bg-border" />
        </div>
        <div className={rowGridClassName}>
          {[1, 2, 3, 4].map((i) => (
            <React.Fragment key={i}>
              <Skeleton className="h-5 w-[180px]" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* Liabilities (3 fields) */}
      <section className={`${sectionWrapperClassName} space-y-5`}>
        <div>
          <Skeleton className="h-6 w-[100px]" />
          <div className="mt-2 h-px bg-border" />
        </div>
        <div className={rowGridClassName}>
          {[1, 2, 3].map((i) => (
            <React.Fragment key={i}>
              <Skeleton className="h-5 w-[180px]" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* Equity */}
      <section className={`${sectionWrapperClassName} space-y-5`}>
        <div>
          <Skeleton className="h-6 w-[70px]" />
          <div className="mt-2 h-px bg-border" />
        </div>
        <div className={rowGridClassName}>
          <Skeleton className="h-5 w-[80px]" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </section>

      {/* Profit and Loss */}
      <section className={`${sectionWrapperClassName} space-y-5`}>
        <div>
          <Skeleton className="h-6 w-[140px]" />
          <div className="mt-2 h-px bg-border" />
        </div>
        <div className={rowGridClassName}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <React.Fragment key={i}>
              <Skeleton className="h-5 w-[180px]" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </React.Fragment>
          ))}
        </div>
      </section>
    </div>
  );
}
