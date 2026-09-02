"use client";

import { ArrowDownTrayIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import type { InvestmentSettlementConfirmationPdfPayload } from "@cashsouk/types";
import { StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";

type Props = {
  confirmation: InvestmentSettlementConfirmationPdfPayload;
  onView: () => void;
  onDownload: () => void;
  viewPending?: boolean;
  downloadPending?: boolean;
};

export function InvestmentSettlementConfirmationCard({
  confirmation,
  onView,
  onDownload,
  viewPending = false,
  downloadPending = false,
}: Props) {
  if (confirmation.status !== "READY") return null;
  const busy = viewPending || downloadPending;

  return (
    <section
      className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5"
      aria-labelledby="investment-settlement-confirmation-title"
      data-investment-settlement-confirmation
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="investment-settlement-confirmation-title" className="text-section-title">
              Investment Settlement Confirmation
            </h2>
            <StatusBadge label={confirmation.statusLabel} status="success" />
          </div>
          {confirmation.settlementDateDisplay ? (
            <p className="text-ui text-muted-foreground">
              Settlement date: {confirmation.settlementDateDisplay}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onView}
            disabled={busy}
            aria-label="View PDF"
          >
            <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden />
            View
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onDownload}
            disabled={busy}
            aria-label="Download PDF"
          >
            <ArrowDownTrayIcon className="h-4 w-4" aria-hidden />
            Download
          </Button>
        </div>
      </div>
    </section>
  );
}
