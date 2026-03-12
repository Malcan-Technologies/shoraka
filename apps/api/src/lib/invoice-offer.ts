  /**
 * Shared helpers for invoice offer values (requested, offered, profit rate).
 * Mirrors contract-facility pattern for consistency.
 *
 * See docs/guides/application-flow/invoice-offer-facility-flow.md for the full flow.
 */

export type InvoiceDetailsLike = Record<string, unknown> | null | undefined;
export type InvoiceOfferDetailsLike = Record<string, unknown> | null | undefined;

/** Field names for requested/applied financing. Checked in order. */
const REQUESTED_AMOUNT_KEYS = ["applied_financing", "financing_amount"] as const;

/**
 * Resolve requested financing amount from invoice details.
 * Falls back to value × (financing_ratio_percent / 100) when explicit fields missing.
 */
export function resolveRequestedInvoiceAmount(details: InvoiceDetailsLike): number {
  if (!details || typeof details !== "object") return 0;
  for (const key of REQUESTED_AMOUNT_KEYS) {
    const v = details[key];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  }
  const value =
    typeof details.value === "number"
      ? details.value
      : typeof details.invoice_value === "number"
        ? details.invoice_value
        : null;
  const ratio =
    typeof details.financing_ratio_percent === "number"
      ? details.financing_ratio_percent
      : typeof details.financing_ratio_percent === "string"
        ? Number(details.financing_ratio_percent)
        : null;
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
  const v = offer.offered_amount;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
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
