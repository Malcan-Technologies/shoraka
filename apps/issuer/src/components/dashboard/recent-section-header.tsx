"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

export function RecentSectionHeader({
  title,
  countBadge,
  viewAllHref,
  viewAllLabel = "View all",
}: {
  title: string;
  countBadge?: React.ReactNode;
  viewAllHref: string;
  viewAllLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 md:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-xl font-semibold tracking-tight text-foreground">{title}</h3>
        {countBadge}
      </div>
      <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-sm">
        <Link href={viewAllHref}>
          {viewAllLabel}
          <ArrowRightIcon className="h-4 w-4" aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
