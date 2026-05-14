"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, Skeleton } from "@cashsouk/ui";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

interface QuickActionCardProps {
  title: string;
  description: string;
  count?: number;
  countLabel?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "warning" | "urgent";
  loading?: boolean;
}

export function QuickActionCard({
  title,
  description,
  count,
  countLabel = "pending",
  href,
  icon: Icon,
  variant = "default",
  loading = false,
}: QuickActionCardProps) {
  const variantStyles = {
    default: {
      card: "hover:border-primary/50 hover:shadow-md",
      icon: "bg-muted text-muted-foreground",
      count: "text-foreground",
    },
    warning: {
      card: "border-amber-500/30 hover:border-amber-500/50 hover:shadow-md",
      icon: "bg-amber-500/10 text-amber-600",
      count: "text-amber-600",
    },
    urgent: {
      card: "border-primary/30 hover:border-primary/50 hover:shadow-md",
      icon: "bg-primary/10 text-primary",
      count: "text-primary",
    },
  };

  const styles = variantStyles[variant];

  if (loading) {
    return (
      <Card className="flex h-full min-h-0 w-full flex-col rounded-2xl shadow-sm">
        <CardContent className="flex flex-1 flex-col p-6">
          <div className="flex min-h-0 flex-1 gap-4">
            <Skeleton className="h-12 w-12 flex-shrink-0 rounded-xl" />
            <div className="flex min-w-0 flex-1 flex-col space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="mt-2 h-8 w-16" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Link href={href} className="group flex h-full min-h-0 w-full rounded-2xl">
      <Card
        className={cn(
          "flex h-full min-h-0 w-full flex-1 flex-col rounded-2xl shadow-sm transition-all duration-200 cursor-pointer",
          styles.card
        )}
      >
        <CardContent className="flex flex-1 flex-col p-6">
          <div className="flex min-h-0 flex-1 gap-4">
            <div
              className={cn(
                "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl transition-colors",
                styles.icon
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <h3 className="text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-0.5 flex-1 text-sm text-muted-foreground">{description}</p>

              {count !== undefined && count > 0 && (
                <div className="mt-3">
                  <span className={cn("text-2xl font-bold", styles.count)}>{count}</span>
                  <span className="ml-1.5 text-sm text-muted-foreground">{countLabel}</span>
                </div>
              )}

              {count === 0 && (
                <div className="mt-3">
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    All caught up
                  </span>
                </div>
              )}
            </div>
            <ArrowRightIcon className="mt-1 h-5 w-5 flex-shrink-0 self-start text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
