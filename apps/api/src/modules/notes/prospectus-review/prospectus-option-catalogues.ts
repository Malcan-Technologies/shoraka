/**
 * SECTION: Versioned code-based prospectus option catalogues
 * WHY: Officer selects keys only; wording stays in code until legal approval
 *
 * Placeholder copy is NOT legally approved production text.
 */

export const PROSPECTUS_OPTION_CATALOGUE_VERSION = "2026.07.19.placeholder.v1";

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
  renderedText: string,
  category: ProspectusFieldCategory = "OFFICER_SELECTED"
): ProspectusCatalogueOption {
  return { key, label, renderedText, category, isActive: true };
}

export const PROSPECTUS_HIGHLIGHT_OPTION_CATALOGUE: Record<
  string,
  readonly ProspectusCatalogueOption[]
> = {
  paymaster: [
    opt(
      "placeholder_paymaster",
      "Placeholder — Paymaster highlight",
      "Placeholder — Paymaster highlight (not approved).",
      "FIXED_TEMPLATE"
    ),
    DO_NOT_DISPLAY,
  ],
  issuer_fundamentals: [
    opt(
      "placeholder_issuer_fundamentals",
      "Placeholder — Issuer fundamentals",
      "Placeholder — Issuer fundamentals (not approved).",
      "FIXED_TEMPLATE"
    ),
    DO_NOT_DISPLAY,
  ],
  return: [
    opt(
      "placeholder_return",
      "Placeholder — Return highlight",
      "Placeholder — Return highlight (not approved).",
      "FIXED_TEMPLATE"
    ),
    DO_NOT_DISPLAY,
  ],
  shariah: [
    opt(
      "placeholder_shariah",
      "Placeholder — Shariah highlight",
      "Placeholder — Shariah highlight (not approved).",
      "FIXED_TEMPLATE"
    ),
    DO_NOT_DISPLAY,
  ],
};

export const PROSPECTUS_CREDIT_INSIGHT_OPTIONS: readonly ProspectusCatalogueOption[] = [
  opt("positive", "Positive", "Positive"),
  opt("neutral", "Neutral", "Neutral"),
  opt("negative", "Negative", "Negative"),
  DO_NOT_DISPLAY,
];

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

export const PROSPECTUS_HIGHLIGHT_KEYS = [
  "paymaster",
  "issuer_fundamentals",
  "return",
  "shariah",
] as const;

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

export const PROSPECTUS_CREDIT_INSIGHT_KEYS = [
  "creditScore",
  "paymentBehaviour",
  "creditUtilisation",
  "litigationCheck",
  "ccrisStatus",
] as const;

export const PROSPECTUS_MANUAL_FINANCIAL_FIELD_KEYS = [
  "grossProfit",
  "ebitda",
  "ebit",
  "cashAndBank",
  "tradeReceivables",
  "totalEquity",
  "quickRatio",
  "operatingCashFlow",
  "freeCashFlow",
  "interestCoverage",
  "dscr",
  "debtEquity",
  "returnOnAssets",
  "receivablesDays",
  "payablesDays",
  "assetTurnover",
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
    highlights: PROSPECTUS_HIGHLIGHT_OPTION_CATALOGUE,
    creditInsights: PROSPECTUS_CREDIT_INSIGHT_OPTIONS,
    invoiceWork: PROSPECTUS_INVOICE_WORK_OPTION_CATALOGUE,
    takeaways: PROSPECTUS_TAKEAWAY_OPTION_CATALOGUE,
  };
}
