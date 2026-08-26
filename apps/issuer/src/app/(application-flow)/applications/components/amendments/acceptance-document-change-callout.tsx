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
  documentCount?: number;
  partyCount?: number;
  className?: string;
};

function describeAcceptanceChangeTargets(
  flaggedCount: number,
  documentCount: number,
  partyCount: number
): string {
  const parts: string[] = [];
  if (documentCount > 0) {
    parts.push(`${documentCount} ${documentCount === 1 ? "document" : "documents"}`);
  }
  if (partyCount > 0) {
    parts.push(
      `${partyCount} representative ${partyCount === 1 ? "list" : "lists"}`
    );
  }
  if (parts.length > 0) return parts.join(" and ");
  return `${flaggedCount} ${flaggedCount === 1 ? "item" : "items"}`;
}

/** Step-level notice when admin has requested acceptance document or representative-list changes. */
export function AcceptanceDocumentChangesRequestedBanner({
  flaggedCount,
  documentCount = 0,
  partyCount = 0,
  className,
}: AcceptanceDocumentChangesRequestedBannerProps) {
  const targets = describeAcceptanceChangeTargets(flaggedCount, documentCount, partyCount);

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
          CashSouk requested updates to {targets} below. Change only the highlighted items, then
          submit for review.
          {documentCount > 0 ? (
            <>
              {" "}
              Use <span className="font-medium">View Remarks</span> on each flagged document.
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
