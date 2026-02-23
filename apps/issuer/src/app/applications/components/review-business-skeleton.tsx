import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

const labelClassName = "text-sm text-muted-foreground";
const valueClassName = "text-[17px] leading-7 text-foreground font-medium";
const gridClassName = "grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-x-12 gap-y-6 mt-4 px-3";

export function ReviewBusinessSkeleton() {
  return (
    <div className={gridClassName}>
      <div className={labelClassName}>Business registration</div>
      <div className={valueClassName}><Skeleton className="h-5 w-40" /></div>

      <div className={labelClassName}>Primary activity</div>
      <div className={valueClassName}><Skeleton className="h-5 w-56" /></div>

      <div className={labelClassName}>Annual turnover</div>
      <div className={valueClassName}><Skeleton className="h-5 w-32" /></div>
    </div>
  );
}

