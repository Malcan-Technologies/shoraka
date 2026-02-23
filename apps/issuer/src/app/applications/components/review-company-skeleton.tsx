import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

const labelClassName = "text-sm text-muted-foreground";
const valueClassName = "text-[17px] leading-7 text-foreground font-medium";
const gridClassName = "grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-x-12 gap-y-6 mt-4 px-3";

export function ReviewCompanySkeleton() {
  return (
    <div className={gridClassName}>
      <div className={labelClassName}>Company name</div>
      <div className={valueClassName}><Skeleton className="h-5 w-56" /></div>

      <div className={labelClassName}>Type of entity</div>
      <div className={valueClassName}><Skeleton className="h-5 w-40" /></div>

      <div className={labelClassName}>SSM no</div>
      <div className={valueClassName}><Skeleton className="h-5 w-32" /></div>

      <div className={labelClassName}>Industry</div>
      <div className={valueClassName}><Skeleton className="h-5 w-48" /></div>

      <div className={labelClassName}>Nature of business</div>
      <div className={valueClassName}><Skeleton className="h-5 w-32" /></div>

      <div className={labelClassName}>Number of employees</div>
      <div className={valueClassName}><Skeleton className="h-5 w-24" /></div>
    </div>
  );
}

