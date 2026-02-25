import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function ReviewSupportingDocsSkeleton() {
  return (
    <div className="space-y-4 px-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex justify-between items-center py-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-24" />
        </div>
      ))}
    </div>
  );
}

