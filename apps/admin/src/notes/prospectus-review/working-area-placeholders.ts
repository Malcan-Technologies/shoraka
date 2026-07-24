/**
 * Placeholders for Admin Prospectus editable fields only.
 * Never store these as field values.
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

/** Compact placeholders for narrow financial table cells. */
export const FINANCIAL_CELL_PLACEHOLDERS = {
  money: "MYR amount",
  ratio: "e.g. 1.42",
  percent: "e.g. 4.8",
  days: "e.g. 74",
} as const;

/** Accessible / full guidance (title attribute). */
export const FINANCIAL_PLACEHOLDERS = {
  money: "Enter amount in MYR",
  ratio: "Enter ratio, e.g. 1.42",
  percent: "Enter percentage, e.g. 4.8",
  days: "Enter days, e.g. 74",
  multiple: "Enter multiple, e.g. 12.1",
} as const;

export const SELECT_PLACEHOLDERS = {
  companySize: "Select company size",
  deedOfAssignment: "Select Yes or No",
  paymasterRating: "Select paymaster rating",
  confidenceGrading: "Select confidence grading",
  creditScore: "Select credit score",
  paymentBehaviour: "Select payment behaviour",
  creditUtilisation: "Select credit utilisation",
  litigationCheck: "Select litigation status",
  ccrisStatus: "Select CCRIS status",
  takeaway: "Select a takeaway",
} as const;

export const HIGHLIGHT_PLACEHOLDERS = {
  paymaster: {
    title: "Enter paymaster highlight title",
    description: "Enter paymaster highlight description",
  },
  issuer_fundamentals: {
    title: "Enter issuer fundamentals title",
    description: "Enter issuer fundamentals description",
  },
  return: {
    title: "Enter return highlight title",
    description: "Enter return highlight description",
  },
} as const;

export const INVOICE_STATEMENT_PLACEHOLDERS: Record<string, string> = {
  work_under_contract: "Enter the approved work-performed statement",
  certification_acceptance: "Enter the invoice certification statement",
  paymaster_trust_account: "Enter the trust-account payment statement",
  deed_of_assignment: "Enter the Deed of Assignment statement",
};

export const PAYMASTER_TRACK_PLACEHOLDERS = {
  totalInvoicesPaid: "Enter number of invoices",
  totalAmountPaid: "Enter total amount in MYR",
  successfulRepaymentPercent: "Enter percentage, e.g. 100",
  onTimePaymentPercent: "Enter percentage, e.g. 94",
  averagePaymentPeriodDays: "Enter number of days",
} as const;

export const PAGE_TWO_FINANCIAL_PLACEHOLDERS = {
  netDebtEquity: "Enter ratio, e.g. 0.24",
  interestCoverage: "Enter multiple, e.g. 12.1",
  dscr: "Enter multiple, e.g. 1.42",
  receivablesDays: "Enter days, e.g. 74",
} as const;
