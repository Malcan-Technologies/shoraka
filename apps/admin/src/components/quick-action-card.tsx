"use client";

import * as React from "react";
import Link from "next/link";
import { Skeleton } from "@cashsouk/ui";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

export interface QuickActionCardProps {
  title: string;
  description?: string;
  count?: number;
  countLabel?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "warning" | "urgent";
  loading?: boolean;
  /** When true, show the green “All caught up” treatment instead of a count. */
  caughtUp?: boolean;
}

function CountPill({ count }: { count: number }) {
  return (
    <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-meta font-normal tabular-nums text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function QuickActionCard({
  title,
  description,
  count,
  href,
  icon: Icon,
  variant = "default",
  loading = false,
  caughtUp = false,
}: QuickActionCardProps) {
  const variantStyles = {
    default: {
      row: "border-border hover:border-primary/40 hover:bg-muted/40",
      icon: "bg-muted text-muted-foreground",
    },
    warning: {
      row: "border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/5",
      icon: "bg-amber-500/10 text-amber-600",
    },
    urgent: {
      row: "border-primary/30 hover:border-primary/50 hover:bg-primary/5",
      icon: "bg-primary/10 text-primary",
    },
  };

  const styles = variantStyles[variant];

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
        <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-full max-w-[12rem]" />
        </div>
        <Skeleton className="h-5 w-7 shrink-0 rounded-full" />
      </div>
    );
  }

  return (
    <Link
      href={href}
      title={description}
      className={cn(
        "group flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition-colors",
        styles.row
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          styles.icon
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 truncate text-ui font-semibold leading-6 text-foreground">
            {title}
          </p>
          {!caughtUp && count !== undefined && count > 0 ? <CountPill count={count} /> : null}
        </div>
        {caughtUp ? (
          <span className="mt-0.5 inline-flex items-center rounded-md bg-emerald-100 px-1.5 py-0.5 text-ui font-normal leading-5 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            All caught up
          </span>
        ) : description ? (
          <p className="mt-0.5 line-clamp-2 text-ui leading-5 text-muted-foreground">
            {description}
          </p>
        ) : (
          <p className="mt-0.5 text-ui leading-5 text-muted-foreground">No open items</p>
        )}
      </div>
      <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}
