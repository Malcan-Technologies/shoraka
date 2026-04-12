"use client";

/**
 * SECTION: Blocked / loading wizard shell
 * WHY: Full-page placeholder while route or product is unresolved; must not mimic one step (e.g. contract grid).
 * INPUT: progress row as children from parent.
 * OUTPUT: Generic title skeleton + neutral content blocks; works for any step shape.
 * WHERE USED: applications/edit/[id] loading shell, blocked flow, Suspense fallback.
 */
import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function ApplicationFlowBlockedBackdrop({
  children,
}: {
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    console.log("ApplicationFlowBlockedBackdrop: showing header + progress shell");
  }, []);

  return (
    <>
      {/*
        Mirrors edit/[id] page title stack: mb-4 sm:mb-6, h1 text-xl/sm:text-2xl/md:text-3xl,
        description text-sm sm:text-[15px] leading-6 sm:leading-7 mt-1
      */}
      <div className="mb-4 sm:mb-6">
        <Skeleton className="h-7 sm:h-8 md:h-9 w-full max-w-[20rem] sm:max-w-xl rounded-md" />
        <Skeleton className="mt-1 h-4 sm:h-[15px] w-full max-w-2xl rounded-md" />
        <Skeleton className="mt-1 h-4 sm:h-[15px] w-full max-w-[28rem] rounded-md opacity-80" />
      </div>
      {children}
    </>
  );
}

/**
 * SECTION: Generic step body skeleton
 * WHY: Any step can be form, list, or review — use neutral blocks, not contract field grid.
 * INPUT: none
 * OUTPUT: One primary card + lines + media block; optional secondary row.
 * WHERE USED: ApplicationFlowBlockedStepSkeleton, Suspense fallback step area.
 */
export function ApplicationFlowGenericStepSkeleton() {
  React.useEffect(() => {
    console.log("ApplicationFlowGenericStepSkeleton: showing generic step placeholder");
  }, []);

  return (
    <div className="pb-6 sm:pb-8 space-y-6 px-1 sm:px-0">
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <Skeleton className="h-5 w-[40%] max-w-xs rounded-md" />
        <Skeleton className="h-4 w-full max-w-3xl rounded-md" />
        <Skeleton className="h-4 w-full max-w-2xl rounded-md" />
        <Skeleton className="h-4 w-[85%] max-w-xl rounded-md" />
        <Skeleton className="h-36 sm:h-44 w-full rounded-lg" />
      </div>
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <Skeleton className="h-20 sm:h-24 flex-1 rounded-xl border border-border" />
        <Skeleton className="h-20 sm:h-24 flex-1 rounded-xl border border-border" />
      </div>
    </div>
  );
}

export function ApplicationFlowBlockedStepSkeleton() {
  return <ApplicationFlowGenericStepSkeleton />;
}
