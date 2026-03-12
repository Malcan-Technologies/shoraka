/**
 * Offer and facility resolution helpers for frontend display.
 * Kept in sync with apps/api/src/lib/contract-facility.ts and invoice-offer.ts.
 * Use for normalizing API shape to display values in issuer/admin UIs.
 */

export type DetailsLike = Record<string, unknown> | null | undefined;

/** Contract: requested facility keys, checked in order. */
const REQUESTED_FACILITY_KEYS = ["financing", "value", "facility_applied", "contract_value"] as const;

/** Invoice: requested amount keys, checked in order. */
const REQUESTED_AMOUNT_KEYS = ["applied_financing", "financing_amount"] as const;

// --- Contract ---

export function resolveRequestedFacility(cd: DetailsLike): number {
  if (!cd || typeof cd !== "object") return 0;
  for (const key of REQUESTED_FACILITY_KEYS) {
    const v = cd[key];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  }
  return 0;
}

/** Approved facility: non-zero only when APPROVED and set from accepted offer. */
export function resolveApprovedFacility(
  contractStatus: string,
  cd: DetailsLike
): number {
  if (
    contractStatus === "APPROVED" &&
    typeof cd?.approved_facility === "number" &&
    (cd.approved_facility as number) > 0
  ) {
    return cd.approved_facility as number;
  }
  return 0;
}

export function resolveOfferedFacility(offer: DetailsLike): number {
  if (!offer || typeof offer !== "object") return 0;
  const v = offer.offered_facility;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

// --- Invoice ---

export function resolveRequestedInvoiceAmount(details: DetailsLike): number | null {
  if (!details || typeof details !== "object") return null;
  for (const key of REQUESTED_AMOUNT_KEYS) {
    const v = details[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
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
  return null;
}

export function resolveOfferedAmount(offer: DetailsLike): number {
  if (!offer || typeof offer !== "object") return 0;
  const v = offer.offered_amount;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
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
