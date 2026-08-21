/**
 * Shared helpers for invoice offer values (requested, offered, profit rate, platform fee).
 * Mirrors contract-facility pattern for consistency.
 *
 * See docs/guides/application-flow/invoice-offer-facility-flow.md for the full flow.
 */

export type InvoiceDetailsLike = Record<string, unknown> | null | undefined;
export type InvoiceOfferDetailsLike = Record<string, unknown> | null | undefined;

/** Field names for requested/applied financing. Checked in order. */
const REQUESTED_AMOUNT_KEYS = ["applied_financing", "financing_amount"] as const;

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

/**
 * Resolve requested financing amount from invoice details.
 * Falls back to value × (financing_ratio_percent / 100) when explicit fields missing.
 */
export function resolveRequestedInvoiceAmount(details: InvoiceDetailsLike): number {
  if (!details || typeof details !== "object") return 0;
  for (const key of REQUESTED_AMOUNT_KEYS) {
    const parsed = parsePositiveAmount(details[key]);
    if (parsed != null) return parsed;
  }
  const value = parsePositiveAmount(details.value) ?? parsePositiveAmount(details.invoice_value);
  const ratio = parsePositiveAmount(details.financing_ratio_percent);
  if (value != null && Number.isFinite(value) && ratio != null && Number.isFinite(ratio)) {
    return Math.round((value * ratio) / 100);
  }
  return 0;
}

/**
 * Resolve offered amount from invoice offer_details.
 */
export function resolveOfferedAmount(offer: InvoiceOfferDetailsLike): number {
  if (!offer || typeof offer !== "object") return 0;
  return parsePositiveAmount(offer.offered_amount) ?? 0;
}

/**
 * Resolve offered profit rate (percent) from invoice offer_details.
 */
export function resolveOfferedProfitRate(offer: InvoiceOfferDetailsLike): number | null {
  if (!offer || typeof offer !== "object") return null;
  const v = offer.offered_profit_rate_percent;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  return null;
}

/**
 * Platform fee rate (percent of funded amount at disbursement) from invoice offer_details.
 * Missing or invalid values become 0.
 */
export function resolveOfferedPlatformFeeRatePercent(offer: InvoiceOfferDetailsLike): number {
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
