"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { ADMIN_ACTION_SURFACE_CLASS } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";

export type AdminNextActionBannerProps = {
  title: string;
  description?: string;
  ctaLabel?: string;
  /** Navigate elsewhere. Use `onClick` instead when the CTA moves to another tab. */
  href?: string;
  onClick?: () => void;
  tone?: "action" | "neutral";
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
};

/**
 * "What should I do next" banner for admin entity-detail pages. Yellow means
 * CashSouk must act; the CTA either links out or switches the active tab.
 */
export function AdminNextActionBanner({
  title,
  description,
  ctaLabel,
  href,
  onClick,
  tone = "action",
  icon: Icon = ExclamationTriangleIcon,
  className,
}: AdminNextActionBannerProps) {
  const cta = ctaLabel && (href || onClick) ? ctaLabel : null;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-3 rounded-xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        tone === "action" ? cn(ADMIN_ACTION_SURFACE_CLASS, "text-foreground") : "border-border bg-card",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {tone === "action" ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-status-action-bg text-status-action-text">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0 space-y-1">
          <p className="text-body font-semibold">{title}</p>
          {description ? <p className="text-ui text-muted-foreground">{description}</p> : null}
        </div>
      </div>

      {cta ? (
        href ? (
          <Button asChild className="w-full shrink-0 gap-2 sm:w-auto">
            <Link href={href}>
              <span className="truncate">{cta}</span>
              <ArrowRightIcon className="h-4 w-4 shrink-0" />
            </Link>
          </Button>
        ) : (
          <Button type="button" onClick={onClick} className="w-full shrink-0 gap-2 sm:w-auto">
            <span className="truncate">{cta}</span>
            <ArrowRightIcon className="h-4 w-4 shrink-0" />
          </Button>
        )
      ) : null}
    </div>
  );
}
