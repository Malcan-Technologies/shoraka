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
  formatReviewDate,
  formatFileSize,
} from "../review-section-styles";
import { formatCurrency, resolveOfferedAmount, resolveRequestedInvoiceAmount } from "@cashsouk/config";
import {
  formatFinancingTenureDaysLabel,
  parseFinancingTenureDays,
  parseInvoiceOfferCampaignSector,
  parseInvoiceOfferCompanyCategory,
  parseInvoiceOfferSustainabilityCategory,
  isValidFinancingTenureDays,
  SC_CAMPAIGN_SECTOR_LABELS,
  SC_COMPANY_CATEGORY_LABELS,
  SC_MONTHLY_CAMPAIGN,
  SC_SUSTAINABILITY_CATEGORY_LABELS,
} from "@cashsouk/types";
import { fileDocToComparisonChips } from "../comparison-document-pair";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function invoiceDetailsDocumentChips(details: unknown) {
  const d = details as Record<string, unknown> | null | undefined;
  const doc = d?.document as { s3_key?: string; file_name?: string; file_size?: number } | undefined;
  return fileDocToComparisonChips(doc);
}

export function invoiceDetailString(inv: { details?: unknown } | undefined, key: string): string {
  if (!inv) return REVIEW_EMPTY_LABEL;
  const d = inv.details as Record<string, unknown> | null | undefined;
  if (!d) return REVIEW_EMPTY_LABEL;
  const v = d[key] ?? d[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
  if (v == null || v === "") return REVIEW_EMPTY_LABEL;
  return String(v);
}

export function invoiceMaturityString(inv: { details?: unknown } | undefined): string {
  if (!inv) return REVIEW_EMPTY_LABEL;
  const d = inv.details as Record<string, unknown> | null | undefined;
  if (!d) return REVIEW_EMPTY_LABEL;
  const raw = d.maturity_date ?? d.maturityDate ?? d.due_date ?? d.dueDate;
  if (raw == null || raw === "") return REVIEW_EMPTY_LABEL;
  return String(raw);
}

export function invoiceFinancingTenureDisplay(inv: { details?: unknown } | undefined): string {
  if (!inv) return REVIEW_EMPTY_LABEL;
  const d = inv.details as Record<string, unknown> | null | undefined;
  const parsed = parseFinancingTenureDays(d?.financing_tenure_days);
  if (parsed == null || !isValidFinancingTenureDays(parsed)) return REVIEW_EMPTY_LABEL;
  return formatFinancingTenureDaysLabel(parsed);
}

export function invoiceFinancingRatioDisplay(inv: { details?: unknown } | undefined): string {
  if (!inv) return REVIEW_EMPTY_LABEL;
  const d = inv.details as Record<string, unknown> | null | undefined;
  if (!d) return REVIEW_EMPTY_LABEL;
  const v = d.financing_ratio_percent ?? d.financingRatioPercent;
  if (v == null || v === "") return REVIEW_EMPTY_LABEL;
  if (typeof v === "number" && Number.isFinite(v)) return `${v}%`;
  const n = Number(String(v).replace(/,/g, ""));
  if (Number.isFinite(n)) return `${n}%`;
  return String(v);
}

export function invoiceFinancingAmountDisplay(inv: {
  details?: unknown;
  offer_details?: unknown;
}): string {
  const offered = resolveOfferedAmount(inv.offer_details as Record<string, unknown> | null);
  if (offered > 0) return formatCurrency(offered);
  const requested = resolveRequestedInvoiceAmount(inv.details as Record<string, unknown> | undefined);
  return requested != null ? formatCurrency(requested) : REVIEW_EMPTY_LABEL;
}

export function invoiceTabLabel(inv: {
  displayReference?: string | null;
  details?: unknown;
}): string {
  const reference = inv.displayReference?.trim();
  if (reference) return reference;
  const number = invoiceDetailString(inv, "number");
  return number !== REVIEW_EMPTY_LABEL ? number : "Invoice";
}

export function invoiceSubmittedCompanyCategoryLabel(
  invoice: { details?: unknown } | undefined
): string {
  const value = parseInvoiceOfferCompanyCategory(invoice?.details);
  return value ? SC_COMPANY_CATEGORY_LABELS[value] : REVIEW_EMPTY_LABEL;
}

export function invoiceSubmittedCampaignSectorLabel(
  invoice: { details?: unknown } | undefined
): string {
  const value = parseInvoiceOfferCampaignSector(invoice?.details);
  return value ? SC_CAMPAIGN_SECTOR_LABELS[value] : REVIEW_EMPTY_LABEL;
}

export function invoiceSubmittedSustainabilityCategoryLabel(
  invoice: { details?: unknown } | undefined
): string {
  const value = parseInvoiceOfferSustainabilityCategory(invoice?.details);
  return value ? SC_SUSTAINABILITY_CATEGORY_LABELS[value] : REVIEW_EMPTY_LABEL;
}

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
  const valueRaw = invoiceDetailString(invoice, "value");
  const valueNum = Number(String(valueRaw).replace(/,/g, ""));
  const valueDisplay =
    Number.isFinite(valueNum) && valueNum > 0 ? formatCurrency(valueNum) : valueRaw;

  return (
    <div className={reviewRowGridClass}>
      <Label className={reviewLabelClass}>Invoice number</Label>
      <div className={reviewValueClass}>{invoiceDetailString(invoice, "number")}</div>
      <Label className={reviewLabelClass}>Maturity date</Label>
      <div className={reviewValueClass}>
        {invoiceMaturityString(invoice) === REVIEW_EMPTY_LABEL
          ? REVIEW_EMPTY_LABEL
          : formatReviewDate(invoiceMaturityString(invoice))}
      </div>
      <Label className={reviewLabelClass}>Financing tenure</Label>
      <div className={reviewValueClass}>{invoiceFinancingTenureDisplay(invoice)}</div>
      <Label className={reviewLabelClass}>Invoice value</Label>
      <div className={reviewValueClass}>{valueDisplay}</div>
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
