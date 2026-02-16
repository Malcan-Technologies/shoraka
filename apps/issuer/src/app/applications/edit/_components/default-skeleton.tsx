"use client";

/**
 * DEFAULT SKELETON
 *
 * What: Shared skeleton UI for edit page loading states.
 * Why: Consistent loading experience; avoids duplicate skeleton markup.
 * Data: Optional workflow steps array for progress indicator.
 */
import * as React from "react";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@cashsouk/ui";
import { ProgressIndicator } from "../../components/progress-indicator";

interface DefaultSkeletonProps {
  /**
   * Optional steps for progress indicator.
   * If not provided, shows 4 placeholder skeletons.
   */
  steps?: string[];
  /**
   * Current step number (1-based).
   * Defaults to 1.
   */
  currentStep?: number;
}

export function DefaultSkeleton({ steps, currentStep = 1 }: DefaultSkeletonProps) {
  const displaySteps = steps || ["", "", "", ""];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex h-14 sm:h-16 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Skeleton className="h-5 sm:h-6 w-28 sm:w-32" />
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 py-4 sm:py-8">
          {/* Title skeleton */}
          <Skeleton className="h-7 sm:h-9 w-48 sm:w-64 mb-2" />
          <Skeleton className="h-4 sm:h-5 w-64 sm:w-96 mb-6 sm:mb-8" />

          {/* Progress indicator skeleton */}
          <ProgressIndicator
            steps={displaySteps}
            currentStep={currentStep}
            isLoading
          />
        </div>

        {/* Divider */}
        <div className="h-px bg-border w-full mt-6" />

        {/* Content skeleton */}
        <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 pt-4 sm:pt-6">
          <Skeleton className="h-64 sm:h-96 w-full" />
        </div>
      </main>

      {/* Footer with buttons */}
      <footer className="sticky bottom-0 border-t bg-background">
        <div className="max-w-7xl mx-auto w-full px-3 sm:px-4 py-3 sm:py-4 flex flex-col sm:flex-row gap-3 sm:gap-0 sm:justify-between">
          <Skeleton className="h-11 sm:h-12 w-full sm:w-32 rounded-xl order-2 sm:order-1" />
          <Skeleton className="h-11 sm:h-12 w-full sm:w-48 rounded-xl order-1 sm:order-2" />
        </div>
      </footer>
    </div>
  );
}
