/**
 * Canonical field keys to display labels for financial statements.
 * Used by frontend to render form labels.
 */

export const FINANCIAL_FIELD_LABELS: Record<string, string> = {
  pldd: "Financial year end (reference)",
  bsfatot: "Fixed Assets",
  othass: "Other Assets",
  bscatot: "Current Assets",
  bsclbank: "Non-Current Assets",
  curlib: "Current Liability",
  bsslltd: "Long-Term Liability",
  bsclstd: "Non-Current Liability",
  bsqpuc: "Equity Capital",
  turnover: "Total Revenue and Income",
  plnpbt: "Profit Before Tax",
  plnpat: "Profit After Tax",
  plnetdiv: "Net Dividend",
  plyear: "Profit and Loss of the Year",
  gear: "Gearing Ratio",
  curlib_borrowing: "Current Liabilities — Borrowing",
  curlib_non_borrowing: "Current Liabilities — Non-Borrowing",
  ncl_loan: "Non-Current Liabilities — Loan",
  ncl_non_loan: "Non-Current Liabilities — Non-Loan",
  equity_share_application: "Share Application Account",
  equity_share_premium: "Share Premium & Other Reserves",
  equity_accumulated_profit: "Accumulated Profit Carried Forward",
  equity_minority: "Minority Interest",
  operating_cost: "Operating Cost",
  admin_cost: "Administrative Cost",
  interest_cost: "Interest Cost",
  other_cost: "Other Cost",
  pl_minority: "Minority Interest (P&L)",
};

/** Profile editor keys. Internal names are legacy; labels above are the SC wording. */
export const ISSUER_PROFILE_BALANCE_SHEET_KEYS = [
  "bscatot",
  "bsclbank",
  "curlib_borrowing",
  "curlib_non_borrowing",
  "ncl_loan",
  "ncl_non_loan",
  "bsqpuc",
  "equity_share_application",
  "equity_share_premium",
  "equity_accumulated_profit",
  "equity_minority",
] as const;

export const ISSUER_PROFILE_PNL_KEYS = [
  "turnover",
  "operating_cost",
  "admin_cost",
  "interest_cost",
  "other_cost",
  "plnpbt",
  "plnpat",
  "pl_minority",
  "plnetdiv",
] as const;

export const ISSUER_PROFILE_FINANCIAL_EDITABLE_KEYS = [
  ...ISSUER_PROFILE_BALANCE_SHEET_KEYS,
  ...ISSUER_PROFILE_PNL_KEYS,
] as const;
