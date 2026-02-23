import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function ReviewDeclarationsSkeleton() {
  return (
    <div className="px-3">
      <div className="space-y-3">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-48" />
      </div>
    </div>
  );
}

