import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

const labelClassName = "text-sm text-muted-foreground";
const valueClassName = "text-[17px] leading-7 text-foreground font-medium";
const gridClassName = "grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-x-12 gap-y-6 mt-4 px-3";

export function ReviewContractSkeleton() {
  return (
    <div className={gridClassName}>
      <div className={labelClassName}>Contract title</div>
      <div className={valueClassName}><Skeleton className="h-5 w-48" /></div>

      <div className={labelClassName}>Contract status</div>
      <div className={valueClassName}><Skeleton className="h-5 w-40" /></div>

      <div className={labelClassName}>Customer</div>
      <div className={valueClassName}><Skeleton className="h-5 w-56" /></div>

      <div className={labelClassName}>Contract value</div>
      <div className={valueClassName}><Skeleton className="h-5 w-32" /></div>

      <div className={labelClassName}>Contract financing</div>
      <div className={valueClassName}><Skeleton className="h-5 w-32" /></div>

      <div className={labelClassName}>Approved facility</div>
      <div className={valueClassName}><Skeleton className="h-5 w-32" /></div>

      <div className={labelClassName}>Utilised facility</div>
      <div className={valueClassName}><Skeleton className="h-5 w-32" /></div>

      <div className={labelClassName}>Available facility</div>
      <div className={valueClassName}><Skeleton className="h-5 w-32" /></div>
    </div>
  );
}

