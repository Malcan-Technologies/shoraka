/**
 * Internal tab ids for Admin Prospectus working area (not investor pages).
 */
export type PageOneTabId = "overview" | "highlights" | "track";
export type PageTwoTabId =
  | "issuer_paymaster"
  | "financial"
  | "credit_invoice"
  | "risk";
export type PageThreeTabId =
  | "overview"
  | "income"
  | "balance"
  | "coverage"
  | "takeaways";

export type ProspectusInternalTabId = PageOneTabId | PageTwoTabId | PageThreeTabId;

/** Map missing-field section labels → internal tab for navigation. */
export function resolveInternalTabForMissingSection(
  pageStep: 0 | 1 | 2 | 3,
  section: string
): ProspectusInternalTabId | null {
  if (pageStep === 0) {
    if (section === "Investor Highlights") return "highlights";
    if (section === "Issuer Track Record" || section === "Historical Notes") return "track";
    return "overview";
  }
  if (pageStep === 1) {
    if (section === "Financial Comparison") return "financial";
    if (section === "Credit Insights" || section === "About the Invoice") return "credit_invoice";
    if (section === "Risk Information" || section === "Risk & CTA") return "risk";
    return "issuer_paymaster";
  }
  if (pageStep === 2) {
    if (section === "Income Statement") return "income";
    if (section === "Balance Sheet") return "balance";
    if (section === "Coverage & Efficiency") return "coverage";
    if (section === "Investor Takeaways") return "takeaways";
    return "overview";
  }
  return null;
}

export const FINANCIAL_PLACEHOLDERS = {
  money: "Enter amount in MYR",
  ratio: "Enter ratio, e.g. 1.42",
  percent: "Enter percentage, e.g. 4.8",
  days: "Enter number of days, e.g. 74",
} as const;

export const SELECT_PLACEHOLDERS = {
  companySize: "Select company size",
  deedOfAssignment: "Select Yes or No",
  paymasterRating: "Select paymaster rating",
  confidenceGrading: "Select confidence grading",
  creditInsight: "Select credit assessment",
  takeaway: "Select a standard takeaway",
} as const;

export const HIGHLIGHT_PLACEHOLDERS = {
  title: "Enter highlight title",
  description: "Enter highlight description",
} as const;

export const INVOICE_STATEMENT_PLACEHOLDERS: Record<string, string> = {
  work_under_contract: "Enter the approved description of work performed",
  certification_acceptance: "Enter the invoice certification statement",
  paymaster_trust_account: "Enter the trust-account payment statement",
  deed_of_assignment: "Enter the deed of assignment statement",
};

export const PAYMASTER_TRACK_PLACEHOLDERS = {
  totalInvoicesPaid: "Enter total invoices paid",
  totalAmountPaid: "Enter total amount paid in MYR",
  successfulRepaymentPercent: "Enter percentage, e.g. 98",
  onTimePaymentPercent: "Enter percentage, e.g. 95",
  averagePaymentPeriodDays: "Enter number of days, e.g. 30",
} as const;
