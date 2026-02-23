import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function ReviewSupportingDocsSkeleton() {
  return (
    <div className="space-y-4 px-3">
      <div className="flex justify-between items-center py-2">
        <div><Skeleton className="h-5 w-40" /></div>
        <div><Skeleton className="h-5 w-28" /></div>
      </div>
      <div className="flex justify-between items-center py-2">
        <div><Skeleton className="h-5 w-40" /></div>
        <div><Skeleton className="h-5 w-28" /></div>
      </div>
      <div className="flex justify-between items-center py-2">
        <div><Skeleton className="h-5 w-40" /></div>
        <div><Skeleton className="h-5 w-28" /></div>
      </div>
    </div>
  );
}

