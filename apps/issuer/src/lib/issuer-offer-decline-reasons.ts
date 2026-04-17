/** Sentinel value for "Other (manual reason)" in issuer offer decline flows. */
export const OTHER_ISSUER_DECLINE_REASON_VALUE = "__other__";

export const ISSUER_OFFER_DECLINE_REASONS = [
  "Operational friction",
  "Financing amount too little",
  "Profit rate too high",
  "Found other source of financing",
] as const;

/** Combines primary reason and optional additional text, matching admin review remark resolution. */
export function resolveIssuerOfferDeclineReason(
  selectedReason: string,
  additionalOrOtherText: string
): string | undefined {
  const trimmed = additionalOrOtherText.trim();
  if (!selectedReason) return undefined;
  if (selectedReason === OTHER_ISSUER_DECLINE_REASON_VALUE) {
    return trimmed || undefined;
  }
  return trimmed ? `${selectedReason}\n${trimmed}` : selectedReason;
}
