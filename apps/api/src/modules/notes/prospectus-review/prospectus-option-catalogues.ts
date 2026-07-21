/**
 * SECTION: Versioned code-based prospectus option catalogues
 * WHY: Officer selects keys only; wording stays in code until legal approval
 *
 * Credit Insights labels are provisional and require business/compliance confirmation.
 * They are officer-selected display labels — not CTOS-derived classifications.
 */

export const PROSPECTUS_OPTION_CATALOGUE_VERSION =
  "2026.07.21.credit-insights.provisional.v1";

export type ProspectusFieldCategory =
  | "AUTO_DERIVED"
  | "FIXED_TEMPLATE"
  | "OFFICER_SELECTED"
  | "OFFICER_ENTERED"
  | "HIDDEN";

export interface ProspectusCatalogueOption {
  key: string;
  label: string;
  renderedText: string | null;
  category: ProspectusFieldCategory;
  isActive: boolean;
}

const DO_NOT_DISPLAY: ProspectusCatalogueOption = {
  key: "do_not_display",
  label: "Do not display",
  renderedText: null,
  category: "OFFICER_SELECTED",
  isActive: true,
};

function opt(
  key: string,
  label: string,
  renderedText: string = label,
  category: ProspectusFieldCategory = "OFFICER_SELECTED"
): ProspectusCatalogueOption {
  return { key, label, renderedText, category, isActive: true };
}

export const PROSPECTUS_CREDIT_INSIGHT_KEYS = [
  "creditScore",
  "paymentBehaviour",
  "creditUtilisation",
  "litigationCheck",
  "ccrisStatus",
] as const;

export type ProspectusCreditInsightCatalogueField =
  (typeof PROSPECTUS_CREDIT_INSIGHT_KEYS)[number];

/**
 * Provisional per-row Credit Insights catalogues.
 * All five rows are mandatory — no hide/omit option.
 * Wording requires business/compliance confirmation before treating as final legal copy.
 */
export const PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE: Record<
  ProspectusCreditInsightCatalogueField,
  readonly ProspectusCatalogueOption[]
> = {
  creditScore: [
    opt("excellent", "Excellent"),
    opt("good", "Good"),
    opt("fair", "Fair"),
    opt("weak", "Weak"),
    opt("poor", "Poor"),
  ],
  paymentBehaviour: [
    opt("excellent", "Excellent"),
    opt("good", "Good"),
    opt("satisfactory", "Satisfactory"),
    opt("weak", "Weak"),
    opt("poor", "Poor"),
  ],
  creditUtilisation: [
    opt("low", "Low"),
    opt("healthy", "Healthy"),
    opt("moderate", "Moderate"),
    opt("high", "High"),
    opt("very_high", "Very High"),
  ],
  litigationCheck: [
    opt("clear", "Clear"),
    opt("record_found", "Record Found"),
    opt("under_review", "Under Review"),
  ],
  ccrisStatus: [
    opt("no_record", "No record"),
    opt("satisfactory", "Satisfactory"),
    opt("attention_required", "Attention Required"),
    opt("adverse_record", "Adverse Record"),
    opt("under_review", "Under Review"),
  ],
};

const OPTION_KEY_FIELD_BY_STORAGE: Record<
  | "creditScoreOptionKey"
  | "paymentBehaviourOptionKey"
  | "creditUtilisationOptionKey"
  | "litigationCheckOptionKey"
  | "ccrisStatusOptionKey",
  ProspectusCreditInsightCatalogueField
> = {
  creditScoreOptionKey: "creditScore",
  paymentBehaviourOptionKey: "paymentBehaviour",
  creditUtilisationOptionKey: "creditUtilisation",
  litigationCheckOptionKey: "litigationCheck",
  ccrisStatusOptionKey: "ccrisStatus",
};

export function creditInsightFieldFromStorageKey(
  storageKey: keyof typeof OPTION_KEY_FIELD_BY_STORAGE
): ProspectusCreditInsightCatalogueField {
  return OPTION_KEY_FIELD_BY_STORAGE[storageKey];
}

export function findCreditInsightCatalogueOption(
  field: ProspectusCreditInsightCatalogueField,
  key: string | null | undefined
): ProspectusCatalogueOption | null {
  if (key == null) return null;
  const trimmed = key.trim();
  if (!trimmed) return null;
  return findCatalogueOption(PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE[field], trimmed);
}

/** Investor-facing label for a selected key; null when unknown/invalid. */
export function resolveCreditInsightRenderedText(
  field: ProspectusCreditInsightCatalogueField,
  key: string | null | undefined
): string | null {
  const hit = findCreditInsightCatalogueOption(field, key);
  return hit?.renderedText ?? null;
}

export const PROSPECTUS_INVOICE_WORK_OPTION_CATALOGUE: Record<
  string,
  readonly ProspectusCatalogueOption[]
> = {
  work_under_contract: [
    opt(
      "placeholder_work_under_contract",
      "Placeholder — work under contract",
      "Placeholder — work under contract statement (not approved)."
    ),
    DO_NOT_DISPLAY,
  ],
  certification_acceptance: [
    opt(
      "placeholder_certification_acceptance",
      "Placeholder — certification/acceptance",
      "Placeholder — certification and acceptance statement (not approved)."
    ),
    DO_NOT_DISPLAY,
  ],
  paymaster_trust_account: [
    opt(
      "placeholder_paymaster_trust_account",
      "Placeholder — paymaster trust account",
      "Placeholder — paymaster-to-trust-account statement (not approved)."
    ),
    DO_NOT_DISPLAY,
  ],
  deed_of_assignment: [
    opt(
      "placeholder_deed_of_assignment",
      "Placeholder — deed of assignment",
      "Placeholder — deed of assignment statement (not approved)."
    ),
    DO_NOT_DISPLAY,
  ],
};

export const PROSPECTUS_TAKEAWAY_OPTION_CATALOGUE: Record<
  string,
  readonly ProspectusCatalogueOption[]
> = {
  revenue_profitability: [
    opt(
      "placeholder_positive",
      "Placeholder — positive",
      "Placeholder — revenue/profitability description (not approved)."
    ),
    DO_NOT_DISPLAY,
  ],
  liquidity: [
    opt(
      "placeholder_stable",
      "Placeholder — stable",
      "Placeholder — liquidity description (not approved)."
    ),
    DO_NOT_DISPLAY,
  ],
  leverage: [
    opt(
      "placeholder_moderate",
      "Placeholder — moderate",
      "Placeholder — leverage description (not approved)."
    ),
    DO_NOT_DISPLAY,
  ],
  debt_servicing_capacity: [
    opt(
      "placeholder_adequate",
      "Placeholder — adequate",
      "Placeholder — debt-servicing description (not approved)."
    ),
    DO_NOT_DISPLAY,
  ],
  working_capital_efficiency: [
    opt(
      "placeholder_typical",
      "Placeholder — typical",
      "Placeholder — working-capital description (not approved)."
    ),
    DO_NOT_DISPLAY,
  ],
  overall_financial_profile: [
    opt(
      "placeholder_balanced",
      "Placeholder — balanced",
      "Placeholder — overall profile description (not approved)."
    ),
    DO_NOT_DISPLAY,
  ],
};

export const PROSPECTUS_INVOICE_WORK_KEYS = [
  "work_under_contract",
  "certification_acceptance",
  "paymaster_trust_account",
  "deed_of_assignment",
] as const;

export const PROSPECTUS_TAKEAWAY_KEYS = [
  "revenue_profitability",
  "liquidity",
  "leverage",
  "debt_servicing_capacity",
  "working_capital_efficiency",
  "overall_financial_profile",
] as const;

/** Page 3 Income Statement officer-only money fields (no Application/CTOS source). */
export const PROSPECTUS_INCOME_STATEMENT_OFFICER_FIELD_KEYS = [
  "grossProfit",
  "ebitda",
  "ebit",
] as const;

export type ProspectusIncomeStatementOfficerFieldKey =
  (typeof PROSPECTUS_INCOME_STATEMENT_OFFICER_FIELD_KEYS)[number];

/** Page 3 Balance Sheet & Liquidity officer-only fields (no Application/CTOS source). */
export const PROSPECTUS_BALANCE_SHEET_OFFICER_FIELD_KEYS = [
  "cashAndBank",
  "tradeReceivables",
  "totalEquity",
  "quickRatio",
] as const;

export type ProspectusBalanceSheetOfficerFieldKey =
  (typeof PROSPECTUS_BALANCE_SHEET_OFFICER_FIELD_KEYS)[number];

/** Page 3 Coverage officer-only fields (IC / DSCR / Receivables Days reuse Page 2). */
export const PROSPECTUS_COVERAGE_OFFICER_FIELD_KEYS = [
  "operatingCashFlow",
  "freeCashFlow",
  "debtEquity",
  "returnOnAssets",
  "payablesDays",
  "assetTurnover",
] as const;

export type ProspectusCoverageOfficerFieldKey =
  (typeof PROSPECTUS_COVERAGE_OFFICER_FIELD_KEYS)[number];

export const PROSPECTUS_MANUAL_FINANCIAL_FIELD_KEYS = [
  ...PROSPECTUS_INCOME_STATEMENT_OFFICER_FIELD_KEYS,
  ...PROSPECTUS_BALANCE_SHEET_OFFICER_FIELD_KEYS,
  ...PROSPECTUS_COVERAGE_OFFICER_FIELD_KEYS,
] as const;

/** Confirmed derived fields — never accepted as officer overrides. */
export const PROSPECTUS_DERIVED_FINANCIAL_FIELD_KEYS = [
  "revenue",
  "profitBeforeTax",
  "profitAfterTax",
  "netProfitMargin",
  "currentAssets",
  "totalAssets",
  "currentLiabilities",
  "totalLiabilities",
  "currentRatio",
  "returnOnEquity",
] as const;

export function findCatalogueOption(
  options: readonly ProspectusCatalogueOption[],
  key: string | null | undefined
): ProspectusCatalogueOption | null {
  if (key == null || key === "") return null;
  return options.find((o) => o.key === key && o.isActive) ?? null;
}

export function getActiveProspectusCatalogues() {
  return {
    version: PROSPECTUS_OPTION_CATALOGUE_VERSION,
    creditInsights: {
      creditScore: [...PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE.creditScore],
      paymentBehaviour: [...PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE.paymentBehaviour],
      creditUtilisation: [...PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE.creditUtilisation],
      litigationCheck: [...PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE.litigationCheck],
      ccrisStatus: [...PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE.ccrisStatus],
    },
    invoiceWork: PROSPECTUS_INVOICE_WORK_OPTION_CATALOGUE,
    takeaways: PROSPECTUS_TAKEAWAY_OPTION_CATALOGUE,
  };
}
