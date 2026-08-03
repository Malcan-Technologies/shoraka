import * as React from "react";
import { cn } from "../lib/utils";

export interface PageShellProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  description?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}

/** Shared dashboard greeting: "Welcome back, Ada Lovelace" or "Welcome back". */
export function welcomeBackTitle(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed ? `Welcome back, ${trimmed}` : "Welcome back";
}

/**
 * Single title authority for a page: breadcrumb, title, description, primary action.
 * Do not also render a duplicate page title in chrome or body.
 */
export function PageShell({
  title,
  description,
  breadcrumb,
  action,
  children,
  className,
  ...props
}: PageShellProps) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-6", className)} {...props}>
      <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          {breadcrumb ? (
            <div className="text-sm text-muted-foreground">{breadcrumb}</div>
          ) : null}
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          {description ? (
            <div className="max-w-[70ch] text-[17px] leading-7 text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        {action ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
        ) : null}
      </header>
      {children}
    </section>
  );
}
