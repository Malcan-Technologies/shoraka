import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors SelectionCard / financing card layout
export function ReviewFinancingSkeleton() {
  // Follow ProductCardSkeleton / CategorySkeleton sizing and spacing
  return (
    <div className="block w-full px-3">
      <div className="w-full rounded-xl border border-input bg-card px-4 py-3 min-h-[80px] flex items-center">
        <div className="flex w-full justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Image */}
            <div className="w-14 h-14 rounded-xl border border-input bg-muted overflow-hidden flex items-center justify-center shrink-0">
              <Skeleton className="h-full w-full" />
            </div>

            {/* Text - name and description */}
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

