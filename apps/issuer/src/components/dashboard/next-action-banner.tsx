"use client";

import Link from "next/link";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NextActionBannerProps = {
  title: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  ctaLabel: string;
  tone?: "action" | "neutral";
  className?: string;
};

export function NextActionBanner({
  title,
  description,
  href,
  onClick,
  ctaLabel,
  tone = "action",
  className,
}: NextActionBannerProps) {
  const cta = href ? (
    <Button asChild className="h-10 shrink-0 rounded-xl font-semibold">
      <Link href={href}>{ctaLabel}</Link>
    </Button>
  ) : (
    <Button type="button" className="h-10 shrink-0 rounded-xl font-semibold" onClick={onClick}>
      {ctaLabel}
    </Button>
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border px-5 py-5 sm:flex-row sm:items-center",
        tone === "action" &&
          "border-status-action-text/40 bg-status-action-bg text-foreground",
        tone === "neutral" && "border-border bg-card",
        className
      )}
      role="status"
    >
      {tone === "action" ? (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-status-action-text text-status-action-bg">
          <CheckCircleIcon className="h-6 w-6" aria-hidden />
        </span>
      ) : null}
      <div className="min-w-0 flex-1 space-y-1">
        <p
          className={cn(
            "text-body font-semibold leading-7",
            tone === "action" && "text-status-action-text"
          )}
        >
          {title}
        </p>
        {description ? (
          <p
            className={cn(
              "text-pretty text-ui leading-6",
              tone === "action" ? "text-status-action-text/80" : "text-muted-foreground"
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">{cta}</div>
    </div>
  );
}
