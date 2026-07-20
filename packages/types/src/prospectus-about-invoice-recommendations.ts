/**
 * Suggested wording for Page 2 About the Invoice / Work Performed.
 * Templates only — Operations must confirm before Approve. Never treat as verified facts.
 */

export const PROSPECTUS_ABOUT_INVOICE_ITEM_IDS = [
  "work_under_contract",
  "certification_acceptance",
  "paymaster_trust_account",
  "deed_of_assignment",
] as const;

export type ProspectusAboutInvoiceItemId = (typeof PROSPECTUS_ABOUT_INVOICE_ITEM_IDS)[number];

export type ProspectusAboutInvoiceSourceType = "SYSTEM_SUGGESTION" | "OFFICER_ENTERED";

export type ProspectusAboutInvoiceItem = {
  id: ProspectusAboutInvoiceItemId | string;
  text: string;
  sourceType: ProspectusAboutInvoiceSourceType;
};

/** Canva-style templates — no issuer/paymaster/contract names. */
export const PROSPECTUS_ABOUT_INVOICE_SUGGESTIONS: Record<
  ProspectusAboutInvoiceItemId,
  { text: string }
> = {
  work_under_contract: {
    text: "The issuer completed work under a contract awarded by the Paymaster.",
  },
  certification_acceptance: {
    text: "The invoice represents payment for work certified and accepted by the Paymaster.",
  },
  paymaster_trust_account: {
    text: "Payment will be distributed by the Paymaster to the CashSouk trust account.",
  },
  deed_of_assignment: {
    text: "The invoice has been assigned to CashSouk through a Deed of Assignment.",
  },
};

export function buildProspectusAboutInvoiceRecommendations(): Record<
  ProspectusAboutInvoiceItemId,
  { text: string }
> {
  return { ...PROSPECTUS_ABOUT_INVOICE_SUGGESTIONS };
}
