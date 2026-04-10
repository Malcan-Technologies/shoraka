import type { ReviewSectionId } from "./section-types";

const SHARED_RISK_REASONS = [
  "Paymaster risk",
  "Issuer risk",
  "Fraud/Compliance risk",
  "Internal policy/risk appetite",
] as const;

/**
 * Section-level reject reasons shown as quick-pick options in the reject dialog.
 * Update this map to add/remove reasons for specific sections.
 */
export const SECTION_REJECT_COMMON_REASONS: Partial<Record<ReviewSectionId, readonly string[]>> = {
  contract_details: ["Contract quality risk", ...SHARED_RISK_REASONS],
  invoice_details: ["Invoice quality risk", ...SHARED_RISK_REASONS],
};

export function getSectionRejectCommonReasons(section: ReviewSectionId): readonly string[] {
  return SECTION_REJECT_COMMON_REASONS[section] ?? [];
}
