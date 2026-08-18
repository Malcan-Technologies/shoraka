import * as React from "react";
import { cn } from "../lib/utils";

export interface DetailHeaderProps extends React.HTMLAttributes<HTMLElement> {
  breadcrumb?: React.ReactNode;
  title: string;
  status?: React.ReactNode;
  facts?: React.ReactNode;
  actions?: React.ReactNode;
}

export function DetailHeader({
  breadcrumb,
  title,
  status,
  facts,
  actions,
  className,
  ...props
}: DetailHeaderProps) {
  return (
    <header
      className={cn(
        "flex min-w-0 flex-col gap-4 border-b border-border pb-6",
        className
      )}
      {...props}
    >
      {breadcrumb ? (
        <div className="text-ui text-muted-foreground">{breadcrumb}</div>
      ) : null}
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-page-title">
              {title}
            </h1>
            {status}
          </div>
          {facts ? (
            <div className="text-ui text-muted-foreground">
              {facts}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
