/**
 * SECTION: Offer & acceptance display formatters (pure)
 * WHY: Live invoice/facility fields and the resubmit comparison projection must print the
 *      same strings. Kept free of React and the @cashsouk/config barrel so jest can load it.
 * INPUT: Raw contract / customer / offer / invoice JSON from the application or a revision snapshot
 * OUTPUT: Display strings and file refs
 * WHERE USED: InvoiceStackedFields (live), offer-acceptance-projection (comparison)
 */

import { formatCurrency } from "@cashsouk/config/src/currency";
import {
  resolveOfferedAmount,
  resolveRequestedInvoiceAmount,
} from "@cashsouk/config/src/offer-resolvers";
import {
  formatFinancingTenureDaysLabel,
  isValidFinancingTenureDays,
  parseFinancingTenureDays,
  parseInvoiceOfferCampaignSector,
  parseInvoiceOfferCompanyCategory,
  parseInvoiceOfferSustainabilityCategory,
  SC_CAMPAIGN_SECTOR_LABELS,
  SC_COMPANY_CATEGORY_LABELS,
  SC_SUSTAINABILITY_CATEGORY_LABELS,
} from "@cashsouk/types";
import type { ComparisonFileRef } from "./projection-types";
import {
  REVIEW_EMPTY_LABEL,
  formatFileSize,
  formatReviewDate,
  formatReviewText,
} from "./shared-format";

type InvoiceLike = { details?: unknown; offer_details?: unknown; displayReference?: string | null };

type FileDocLike = { s3_key?: string; file_name?: string; file_size?: number } | undefined;

/** formatReviewDate with the default empty label. */
export function formatOfferAcceptanceDate(dateStr: string | null | undefined): string {
  return formatReviewDate(dateStr);
}

/** Same tri-state as unknownToTriBool in comparison-field-row (both come from shared-format). */
export { unknownToTriBool as offerAcceptanceTriBool } from "./shared-format";

function finiteNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Money field shown by ContractReviewFields (contract value, requested financing).
 * Numeric strings print as currency too, so a "1000" ↔ 1000 storage change is not a visible diff.
 */
export function formatOfferAcceptanceMoney(v: unknown): string {
  const n = finiteNumber(v);
  return n != null ? formatCurrency(n) : formatReviewText(v);
}

/** Positive amount as currency, else empty label (Requested / Offered Facility, offered amount). */
export function formatPositiveAmount(amount: number): string {
  return amount > 0 ? formatCurrency(amount) : REVIEW_EMPTY_LABEL;
}

/** Facility fee rate as `${n}%` (offer_details.facility_fee_rate_percent). */
export function formatFacilityFeeRate(v: unknown): string {
  const n = finiteNumber(v);
  return n != null ? `${n}%` : REVIEW_EMPTY_LABEL;
}

/** Upfront facility fee collect amount (offer_details.facility_fee_upfront_collect_amount). */
export function formatFacilityFeeUpfront(v: unknown): string {
  const n = finiteNumber(v);
  return n != null ? formatCurrency(n) : REVIEW_EMPTY_LABEL;
}

/** Single uploaded document → comparison file refs ("Attached file" when unnamed, size as secondary). */
export function fileDocToComparisonFiles(doc: FileDocLike): ComparisonFileRef[] {
  if (!doc?.s3_key || String(doc.s3_key).trim() === "") return [];
  const fileName =
    typeof doc.file_name === "string" && doc.file_name.trim() !== ""
      ? doc.file_name
      : "Attached file";
  const secondary =
    typeof doc.file_size === "number" && doc.file_size > 0
      ? formatFileSize(doc.file_size)
      : undefined;
  return [{ s3Key: String(doc.s3_key), fileName, ...(secondary ? { secondary } : {}) }];
}

// --- Invoice (moved from invoice-stacked-fields.tsx; output unchanged) ---

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

/** Maturity date as InvoiceStackedFields prints it. */
export function invoiceMaturityDisplay(inv: { details?: unknown } | undefined): string {
  const raw = invoiceMaturityString(inv);
  return raw === REVIEW_EMPTY_LABEL
    ? REVIEW_EMPTY_LABEL
    : formatOfferAcceptanceDate(raw);
}

export function invoiceFinancingTenureDisplay(inv: { details?: unknown } | undefined): string {
  if (!inv) return REVIEW_EMPTY_LABEL;
  const d = inv.details as Record<string, unknown> | null | undefined;
  const parsed = parseFinancingTenureDays(d?.financing_tenure_days);
  if (parsed == null || !isValidFinancingTenureDays(parsed)) return REVIEW_EMPTY_LABEL;
  return formatFinancingTenureDaysLabel(parsed);
}

/** Invoice value as InvoiceStackedFields prints it. */
export function invoiceValueDisplay(inv: { details?: unknown } | undefined): string {
  const valueRaw = invoiceDetailString(inv, "value");
  const valueNum = Number(String(valueRaw).replace(/,/g, ""));
  return Number.isFinite(valueNum) && valueNum > 0 ? formatCurrency(valueNum) : valueRaw;
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
  const requested = resolveRequestedInvoiceAmount(
    inv.details as Record<string, unknown> | undefined
  );
  return requested != null ? formatCurrency(requested) : REVIEW_EMPTY_LABEL;
}

/** Offered financing amount only (invoice Send offer stage). */
export function invoiceOfferedAmountDisplay(inv: { offer_details?: unknown } | undefined): string {
  return formatPositiveAmount(
    resolveOfferedAmount(inv?.offer_details as Record<string, unknown> | null | undefined)
  );
}

export function invoiceTabLabel(inv: InvoiceLike): string {
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

export function invoiceDocumentFiles(details: unknown): ComparisonFileRef[] {
  const d = details as Record<string, unknown> | null | undefined;
  return fileDocToComparisonFiles(d?.document as FileDocLike);
}
