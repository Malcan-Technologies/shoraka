/**
 * Offer and facility resolution helpers for frontend display.
 * Kept in sync with apps/api/src/lib/contract-facility.ts and invoice-offer.ts.
 * Use for normalizing API shape to display values in issuer/admin UIs.
 */

import { readInvoiceProductRules } from "@cashsouk/types";
import { currencyAmountExceeds, roundCurrencyAmount } from "./currency";

export { parseInvoiceMaturityDate, maturityMeetsMinimumMonthsFrom } from "@cashsouk/types";

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

export function readInvoiceMaturityMonthsFromWorkflow(workflow: unknown): {
  minMonthsApplicationToMaturity: number | null;
  minMonthsReviewToMaturity: number | null;
} {
  const rules = readInvoiceProductRules(workflow);
  return {
    minMonthsApplicationToMaturity: rules.minMonthsApplicationToMaturity,
    minMonthsReviewToMaturity: rules.minMonthsReviewToMaturity,
  };
}
