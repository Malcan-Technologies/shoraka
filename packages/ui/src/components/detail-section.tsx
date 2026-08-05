import * as React from "react";
import { cn } from "../lib/utils";

export interface DetailSectionProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function DetailSection({
  title,
  description,
  action,
  children,
  className,
  ...props
}: DetailSectionProps) {
  return (
    <section className={cn("space-y-4", className)} {...props}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-semibold md:text-2xl">{title}</h2>
          {description ? (
            <div className="max-w-[70ch] text-[15px] leading-6 text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
