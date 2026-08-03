"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NextActionBannerProps = {
  title: string;
  description?: string;
  href: string;
  ctaLabel: string;
  tone?: "action" | "neutral";
  className?: string;
};

export function NextActionBanner({
  title,
  description,
  href,
  ctaLabel,
  tone = "action",
  className,
}: NextActionBannerProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border px-5 py-5 sm:flex-row sm:items-center sm:justify-between",
        tone === "action" &&
          "border-status-action-text/15 bg-[hsl(var(--status-action-bg)/0.45)] text-foreground",
        tone === "neutral" && "border-border bg-card",
        className
      )}
      role="status"
    >
      <div className="min-w-0 space-y-1">
        <p className="text-[17px] font-semibold leading-7">{title}</p>
        {description ? (
          <p className="text-[15px] leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Button asChild className="h-11 shrink-0 gap-2 rounded-xl font-semibold">
        <Link href={href}>
          {ctaLabel}
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
