"use client";

import type { AcceptanceDeadlinePreview } from "@cashsouk/types";

/**
 * Stacked acceptance-deadline rows for Send Offer confirm dialogs.
 * Shared by contract and invoice offer confirms so layout stays aligned.
 */
export function OfferAcceptanceDeadlineConfirmRows({
  preview,
  labelClassName = "text-muted-foreground",
  valueClassName = "font-medium",
}: {
  preview: AcceptanceDeadlinePreview;
  labelClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex justify-between items-baseline gap-4">
      <span className={labelClassName}>Acceptance deadline</span>
      <span className={`min-w-0 text-right ${valueClassName}`}>
        {preview.confirmDialogLines.deadlineAt}
      </span>
    </div>
  );
}
