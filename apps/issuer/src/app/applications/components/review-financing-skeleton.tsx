import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors SelectionCard / financing card layout
export function ReviewFinancingSkeleton() {
  // Follow ProductCardSkeleton / CategorySkeleton sizing and spacing
  return (
    <div className="block w-full px-3">
      <div className="w-full rounded-xl border border-border bg-background px-6 py-3">
        <div className="flex items-start gap-4">
          {/* Image */}
          <div className="shrink-0">
            <div className="h-14 w-14 rounded-md border border-border bg-white overflow-hidden">
              <Skeleton className="h-full w-full" />
            </div>
          </div>

          {/* Text - name and description */}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-6 w-[62%] rounded" />
            <Skeleton className="h-5 w-[78%] rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

