import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function ReviewContractSkeleton() {
  return (
    <div className="space-y-3 mt-4 px-3">
      <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-y-3 gap-x-12">
        {Array.from({ length: 8 }).map((_, i) => (
          <React.Fragment key={i}>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-56" />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

