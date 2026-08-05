"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import {
  AMENDMENT_CALLOUT_BODY,
  AMENDMENT_CALLOUT_CONTENT,
  AMENDMENT_CALLOUT_ICON_WRAP,
  AMENDMENT_CALLOUT_ROOT,
  AMENDMENT_CALLOUT_TITLE,
} from "./amendment-callout-styles";

type AcceptanceDocumentChangesRequestedBannerProps = {
  flaggedCount: number;
  className?: string;
};

/** Step-level notice when admin has requested acceptance document changes (Review Offer Step 1). */
export function AcceptanceDocumentChangesRequestedBanner({
  flaggedCount,
  className,
}: AcceptanceDocumentChangesRequestedBannerProps) {
  const docLabel = flaggedCount === 1 ? "document" : "documents";

  return (
    <div
      className={cn(
        AMENDMENT_CALLOUT_ROOT,
        "border-primary/55 bg-primary/10 p-4 sm:p-5",
        className
      )}
      role="status"
    >
      <div
        className={cn(AMENDMENT_CALLOUT_ICON_WRAP, "border-primary/45 bg-primary/20")}
        aria-hidden
      >
        <ExclamationTriangleIcon className="h-5 w-5 text-primary" />
      </div>
      <div className={AMENDMENT_CALLOUT_BODY}>
        <p className={cn(AMENDMENT_CALLOUT_TITLE, "text-primary")}>Changes requested</p>
        <p className={cn(AMENDMENT_CALLOUT_CONTENT, "text-foreground")}>
          CashSouk requested updates to {flaggedCount} {docLabel} below. Replace only the
          highlighted rows, then use <span className="font-medium">View Remarks</span> on each
          flagged document before you submit for review.
        </p>
      </div>
    </div>
  );
}
