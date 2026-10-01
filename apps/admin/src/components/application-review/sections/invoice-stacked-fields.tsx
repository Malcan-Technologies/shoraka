"use client";

import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import {
  REVIEW_EMPTY_LABEL,
  reviewLabelClass,
  reviewRowGridClass,
  reviewValueClass,
  formatFileSize,
} from "../review-section-styles";
import { SC_MONTHLY_CAMPAIGN } from "@cashsouk/types";
import {
  invoiceDetailString,
  invoiceFinancingAmountDisplay,
  invoiceFinancingRatioDisplay,
  invoiceFinancingTenureDisplay,
  invoiceMaturityDisplay,
  invoiceSubmittedCampaignSectorLabel,
  invoiceSubmittedCompanyCategoryLabel,
  invoiceSubmittedSustainabilityCategoryLabel,
  invoiceValueDisplay,
} from "@/lib/resubmit-comparison/offer-acceptance-format";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/** Pure formatters live in offer-acceptance-format so the resubmit comparison prints the same strings. */
export {
  invoiceDetailString,
  invoiceFinancingAmountDisplay,
  invoiceFinancingRatioDisplay,
  invoiceFinancingTenureDisplay,
  invoiceMaturityString,
  invoiceSubmittedCampaignSectorLabel,
  invoiceSubmittedCompanyCategoryLabel,
  invoiceSubmittedSustainabilityCategoryLabel,
  invoiceTabLabel,
} from "@/lib/resubmit-comparison/offer-acceptance-format";

function invoiceDocument(details: unknown) {
  const d = details as Record<string, unknown> | null | undefined;
  return d?.document as { s3_key?: string; file_name?: string; file_size?: number } | undefined;
}

export function InvoiceStackedFields({
  invoice,
  onViewDocument,
  onDownloadDocument,
  viewDocumentPending,
}: {
  invoice: { details?: unknown; offer_details?: unknown };
  onViewDocument: (s3Key: string) => void;
  onDownloadDocument: (s3Key: string, fileName?: string) => void;
  viewDocumentPending: boolean;
}) {
  const doc = invoiceDocument(invoice.details);

  return (
    <div className={reviewRowGridClass}>
      <Label className={reviewLabelClass}>Invoice number</Label>
      <div className={reviewValueClass}>{invoiceDetailString(invoice, "number")}</div>
      <Label className={reviewLabelClass}>Maturity date</Label>
      <div className={reviewValueClass}>{invoiceMaturityDisplay(invoice)}</div>
      <Label className={reviewLabelClass}>Financing tenure</Label>
      <div className={reviewValueClass}>{invoiceFinancingTenureDisplay(invoice)}</div>
      <Label className={reviewLabelClass}>Invoice value</Label>
      <div className={reviewValueClass}>{invoiceValueDisplay(invoice)}</div>
      <Label className={reviewLabelClass}>Financing ratio</Label>
      <div className={reviewValueClass}>{invoiceFinancingRatioDisplay(invoice)}</div>
      <Label className={reviewLabelClass}>Financing amount</Label>
      <div className={reviewValueClass}>{invoiceFinancingAmountDisplay(invoice)}</div>
      <Label className={reviewLabelClass}>{SC_MONTHLY_CAMPAIGN.companyCategory.label}</Label>
      <div className={reviewValueClass} aria-label={SC_MONTHLY_CAMPAIGN.companyCategory.label}>
        {invoiceSubmittedCompanyCategoryLabel(invoice)}
      </div>
      <Label className={reviewLabelClass}>{SC_MONTHLY_CAMPAIGN.campaignSector.label}</Label>
      <div className={reviewValueClass} aria-label={SC_MONTHLY_CAMPAIGN.campaignSector.label}>
        {invoiceSubmittedCampaignSectorLabel(invoice)}
      </div>
      <Label className={reviewLabelClass}>{SC_MONTHLY_CAMPAIGN.sustainabilityCategory.label}</Label>
      <div
        className={reviewValueClass}
        aria-label={SC_MONTHLY_CAMPAIGN.sustainabilityCategory.label}
      >
        {invoiceSubmittedSustainabilityCategoryLabel(invoice)}
      </div>
      <Label className={reviewLabelClass}>Document</Label>
      <div className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-input bg-background px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            {doc?.file_name ?? REVIEW_EMPTY_LABEL}
          </div>
          {typeof doc?.file_size === "number" && doc.file_size > 0 ? (
            <div className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</div>
          ) : null}
        </div>
        {doc?.s3_key ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg h-9 gap-1"
              onClick={() => onViewDocument(doc.s3_key!)}
              disabled={viewDocumentPending}
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              View
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg h-9 gap-1"
              onClick={() => onDownloadDocument(doc.s3_key!, doc.file_name)}
              disabled={viewDocumentPending}
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Download
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
