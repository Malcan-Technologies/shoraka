import * as React from "react";
import { cn } from "@/lib/utils";

export type AdminRelatedRecordsRailProps = {
  /** Primary column (usually the tab strip and its panels). */
  main: React.ReactNode;
  /** Rail content: quick links, prospectus, other related records. */
  children: React.ReactNode;
  label?: string;
  className?: string;
};

/** Two-column detail layout that collapses to a single column below `lg`. */
export function AdminRelatedRecordsRail({
  main,
  children,
  label = "Related records",
  className,
}: AdminRelatedRecordsRailProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]",
        className
      )}
    >
      <div className="min-w-0">{main}</div>
      <aside aria-label={label} className="min-w-0 space-y-6">
        {children}
      </aside>
    </div>
  );
}
