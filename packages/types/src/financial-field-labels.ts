/**
 * Canonical field keys to display labels for financial statements.
 * Used by frontend to render form labels.
 */

export const FINANCIAL_FIELD_LABELS: Record<string, string> = {
  pldd: "Financial year end (reference)",
  bsfatot: "Fixed Assets",
  othass: "Other Assets",
  bscatot: "Current Assets",
  bsclbank: "Non-current Assets",
  curlib: "Current Liabilities",
  bsslltd: "Long-term Liabilities",
  bsclstd: "Non-current Liabilities",
  bsqpuc: "Share Capital",
  turnover: "Revenue & Other Income",
  plnpbt: "Profit / (Loss) Before Tax",
  plnpat: "Profit / (Loss) After Tax",
  plnetdiv: "Net Dividend",
  plyear: "Profit and Loss of the Year",
  gear: "Gearing Ratio",
  curlib_borrowing: "Current Borrowings",
  curlib_non_borrowing: "Other Current Liabilities",
  ncl_loan: "Non-current Loans",
  ncl_non_loan: "Other Non-current Liabilities",
  equity_share_application: "Share Application Account",
  equity_share_premium: "Share Premium & Other Reserves",
  equity_accumulated_profit: "Accumulated Profit / (Loss)",
  equity_minority: "Minority Interest",
  operating_cost: "Operating Costs",
  admin_cost: "Administrative Costs",
  interest_cost: "Interest Costs",
  other_cost: "Other Costs",
  pl_minority: "Minority Interest",
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
