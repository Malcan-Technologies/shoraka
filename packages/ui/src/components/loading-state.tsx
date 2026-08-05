import * as React from "react";
import { cn } from "../lib/utils";
import { Skeleton } from "./skeleton";

export type LoadingStateVariant = "list" | "cards" | "detail" | "table";

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: LoadingStateVariant;
  rows?: number;
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border p-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="hidden h-8 w-20 sm:block" />
        </div>
      ))}
    </div>
  );
}

function CardsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-3 rounded-2xl border p-6">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-40" />
          </div>
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2 rounded-xl border p-4">
      <div className="hidden gap-4 md:grid md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="grid gap-2 border-t pt-3 md:grid-cols-4 md:gap-4"
        >
          {Array.from({ length: 4 }, (_, j) => (
            <Skeleton key={j} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function LoadingState({
  variant = "list",
  rows = 4,
  className,
  ...props
}: LoadingStateProps) {
  return (
    <div
      className={cn("w-full", className)}
      role="status"
      aria-busy="true"
      aria-label="Loading"
      {...props}
    >
      {variant === "list" ? <ListSkeleton rows={rows} /> : null}
      {variant === "cards" ? <CardsSkeleton rows={rows} /> : null}
      {variant === "detail" ? <DetailSkeleton /> : null}
      {variant === "table" ? <TableSkeleton rows={rows} /> : null}
      <span className="sr-only">Loading</span>
    </div>
  );
}
