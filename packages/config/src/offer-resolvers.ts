/**
 * Offer and facility resolution helpers for frontend display.
 * Kept in sync with apps/api/src/lib/contract-facility.ts and invoice-offer.ts.
 * Use for normalizing API shape to display values in issuer/admin UIs.
 */

import { addMonths, isBefore, parseISO, startOfDay, isValid } from "date-fns";
import { currencyAmountExceeds, roundCurrencyAmount } from "./currency";

export type DetailsLike = Record<string, unknown> | null | undefined;

/** Contract: requested facility keys, checked in order. */
const REQUESTED_FACILITY_KEYS = ["financing", "value", "facility_applied", "contract_value"] as const;

/** Invoice: requested amount keys, checked in order. */
const REQUESTED_AMOUNT_KEYS = ["applied_financing", "financing_amount"] as const;

// --- Contract ---

function parsePositiveAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

export function resolveRequestedFacility(cd: DetailsLike): number {
  if (!cd || typeof cd !== "object") return 0;
  for (const key of REQUESTED_FACILITY_KEYS) {
    const parsed = parsePositiveAmount(cd[key]);
    if (parsed != null) return parsed;
  }
  return 0;
}

/** Approved facility: non-zero when APPROVED, or in amendment after the issuer already accepted. */
export function resolveApprovedFacility(
  contractStatus: string,
  cd: DetailsLike
): number {
  if (contractStatus !== "APPROVED" && contractStatus !== "AMENDMENT_REQUESTED") return 0;
  return parsePositiveAmount(cd?.approved_facility) ?? 0;
}

export function resolveOfferedFacility(offer: DetailsLike): number {
  if (!offer || typeof offer !== "object") return 0;
  return parsePositiveAmount(offer.offered_facility) ?? 0;
}

// --- Invoice ---

/** Face × integer percent, rounded to sen. Prefer this over `(face * ratio) / 100`. */
export function invoiceAmountFromFaceAndRatio(face: number, ratioPercent: number): number {
  if (!Number.isFinite(face) || !Number.isFinite(ratioPercent) || face <= 0 || ratioPercent <= 0) {
    return 0;
  }
  return Math.round(face * ratioPercent) / 100;
}

export function resolveRequestedInvoiceAmount(details: DetailsLike): number | null {
  if (!details || typeof details !== "object") return null;
  for (const key of REQUESTED_AMOUNT_KEYS) {
    const parsed = parsePositiveAmount(details[key]);
    if (parsed != null) return roundCurrencyAmount(parsed);
  }
  const value = parsePositiveAmount(details.value) ?? parsePositiveAmount(details.invoice_value);
  const ratio = parsePositiveAmount(details.financing_ratio_percent);
  if (value != null && ratio != null) {
    const requested = invoiceAmountFromFaceAndRatio(value, ratio);
    return requested > 0 ? requested : null;
  }
  return null;
}

/** True when the offer is above the issuer request after sen rounding. */
export function invoiceOfferExceedsRequested(
  offeredAmount: number | null | undefined,
  requestedAmount: number | null | undefined
): boolean {
  if (offeredAmount == null || requestedAmount == null) return false;
  return currencyAmountExceeds(offeredAmount, requestedAmount);
}

export function resolveOfferedAmount(offer: DetailsLike): number {
  if (!offer || typeof offer !== "object") return 0;
  return parsePositiveAmount(offer.offered_amount) ?? 0;
}

export function resolveOfferedProfitRate(offer: DetailsLike): number | null {
  if (!offer || typeof offer !== "object") return null;
  const v = offer.offered_profit_rate_percent;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  return null;
}

/** Platform fee (% of funded amount at disbursement) from offer_details. */
export function resolveOfferedPlatformFeeRatePercent(offer: DetailsLike): number {
  if (!offer || typeof offer !== "object") return 0;
  const v = offer.platform_fee_rate_percent;
  let n: number | null = null;
  if (typeof v === "number" && Number.isFinite(v)) n = v;
  else if (typeof v === "string" && v.trim() !== "") {
    const parsed = Number(v);
    n = Number.isFinite(parsed) ? parsed : null;
  }
  if (n == null || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

// --- Invoice maturity (product workflow + review UI) ---

function workflowStepId(step: unknown): string {
  return (step as { id?: string })?.id ?? "";
}

function invoiceDetailsConfigFromWorkflow(workflow: unknown): Record<string, unknown> | null {
  if (!Array.isArray(workflow)) return null;
  const step = workflow.find((s) => workflowStepId(s).toLowerCase().startsWith("invoice_details"));
  if (!step || typeof step !== "object") return null;
  const config = (step as { config?: unknown }).config;
  return config && typeof config === "object" ? (config as Record<string, unknown>) : null;
}

/** Parse invoice maturity from stored details (ISO yyyy-MM-dd or full ISO). */
export function parseInvoiceMaturityDate(value: string | undefined | null): Date | null {
  if (value == null || typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  const iso = trimmed.length === 10 ? parseISO(`${trimmed}T00:00:00`) : parseISO(trimmed);
  if (!isValid(iso)) return null;
  return startOfDay(iso);
}

/** True if maturity is on or after addMonths(startOfDay(referenceDate), minMonths). */
export function maturityMeetsMinimumMonthsFrom(
  maturityDate: Date,
  referenceDate: Date,
  minMonths: number | null | undefined
): boolean {
  if (minMonths == null || !Number.isFinite(minMonths) || minMonths <= 0) return true;
  const months = Math.min(120, Math.max(0, Math.floor(minMonths)));
  if (months === 0) return true;
  const minAllowed = addMonths(startOfDay(referenceDate), months);
  return !isBefore(startOfDay(maturityDate), minAllowed);
}

export function readInvoiceMaturityMonthsFromWorkflow(workflow: unknown): {
  minMonthsApplicationToMaturity: number | null;
  minMonthsReviewToMaturity: number | null;
} {
  const c = invoiceDetailsConfigFromWorkflow(workflow);
  if (!c) {
    return { minMonthsApplicationToMaturity: null, minMonthsReviewToMaturity: null };
  }
  const parse = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = parseInt(v, 10);
      return !Number.isNaN(n) ? n : null;
    }
    return null;
  };
  const application = parse(c.min_months_application_to_maturity);
  const review = parse(c.min_months_review_to_maturity);
  return {
    minMonthsApplicationToMaturity: application != null && application > 0 ? application : null,
    minMonthsReviewToMaturity: review != null && review > 0 ? review : null,
  };
}
