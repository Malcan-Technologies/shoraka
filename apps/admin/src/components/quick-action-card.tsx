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
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-8 w-16 mt-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Link href={href} className="block group">
      <Card
        className={cn(
          "rounded-2xl shadow-sm transition-all duration-200 cursor-pointer",
          styles.card
        )}
      >
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl flex-shrink-0 transition-colors",
                styles.icon
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>

              {count !== undefined && count > 0 && (
                <div className="mt-3">
                  <span className={cn("text-2xl font-bold", styles.count)}>{count}</span>
                  <span className="text-sm text-muted-foreground ml-1.5">{countLabel}</span>
                </div>
              )}

              {count === 0 && (
                <div className="mt-3">
                  <span className="text-sm text-muted-foreground">All caught up</span>
                </div>
              )}
            </div>
            <ArrowRightIcon className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
