import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function ReviewInvoiceSkeleton() {
  return (
    <div className="px-3">
      <div className="border rounded-xl bg-card overflow-hidden p-4">
        <div className="mb-3">
          <Skeleton className="h-4 w-56" />
        </div>
        {/* Table header skeleton */}
        <div className="flex gap-4 items-center mb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
        </div>
        {/* Row skeletons */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-3 items-center">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-3 items-center">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

