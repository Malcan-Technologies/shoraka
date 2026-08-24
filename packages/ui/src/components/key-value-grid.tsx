import * as React from "react";
import { cn } from "../lib/utils";

export interface KeyValueItem {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Right-align value (amounts, IDs). */
  tabular?: boolean;
  className?: string;
}

export interface KeyValueGridProps extends React.HTMLAttributes<HTMLDListElement> {
  items: KeyValueItem[];
  columns?: 1 | 2;
}

export function KeyValueGrid({
  items,
  columns = 2,
  className,
  ...props
}: KeyValueGridProps) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-3",
        columns === 2 ? "sm:grid-cols-2" : "grid-cols-1",
        className
      )}
      {...props}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className={cn(
            "grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-0.5 text-ui",
            item.className
          )}
        >
          <dt className="text-ui text-muted-foreground">{item.label}</dt>
          <dd
            className={cn(
              "min-w-0 break-words text-foreground",
              item.tabular && "text-right tabular-nums"
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
