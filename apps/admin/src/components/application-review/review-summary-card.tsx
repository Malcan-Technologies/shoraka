"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { getReviewTabLabel } from "./review-registry";

export interface ReviewSummaryCardProps {
  sections: { section: string; status: string }[];
  reviewItems: { item_type: string; item_id: string; status: string }[];
}

function getSummaryBadgeClasses(status: string): string {
  switch (status) {
    case "APPROVED":
      return "border-green-500/30 bg-green-500/10 text-green-800 dark:text-green-200";
    case "REJECTED":
      return "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200";
    case "AMENDMENT_REQUESTED":
      return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200";
    default:
      return "border-muted-foreground/30 bg-muted/60 text-muted-foreground";
  }
}

function getStatusDotClass(status: string): string {
  switch (status) {
    case "APPROVED":
      return "bg-green-500";
    case "AMENDMENT_REQUESTED":
      return "bg-yellow-500";
    case "REJECTED":
      return "bg-destructive";
    default:
      return "bg-muted-foreground";
  }
}

function getStatusLabel(status: string): string {
  if (status === "AMENDMENT_REQUESTED") return "Amendment";
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function ReviewSummaryCard({ sections }: ReviewSummaryCardProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ClipboardDocumentCheckIcon className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">Review Summary</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Section Status
          </h4>
          <div className="space-y-1.5">
            {sections.map((s) => (
              <div key={s.section} className="flex items-center justify-between text-sm">
                <span>{getReviewTabLabel(s.section)}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-6 px-2.5 text-[11px] font-semibold tracking-wide gap-1.5",
                    getSummaryBadgeClasses(s.status)
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("inline-block h-2 w-2 rounded-full shrink-0", getStatusDotClass(s.status))}
                  />
                  {getStatusLabel(s.status)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
