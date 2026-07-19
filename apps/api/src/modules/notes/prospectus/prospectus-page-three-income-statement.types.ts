/**
 * SECTION: Prospectus Page 3 — 3-Year Income Statement Summary (visible Stage 3)
 * WHY: Confirmed Application FS rows only; Gross Profit/EBITDA/EBIT stay DNA
 */

import type { ProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source.types";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Static Canva section title — not a database field. */
export const PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_SECTION_HEADING =
  "3-YEAR INCOME STATEMENT SUMMARY";

export const PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_ROW_KEYS = [
  "revenue",
  "gross_profit",
  "ebitda",
  "ebit",
  "profit_before_tax",
  "profit_after_tax",
  "net_profit_margin",
] as const;

export type ProspectusPageThreeIncomeStatementRowKey =
  (typeof PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_ROW_KEYS)[number];

export const PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_ROW_LABELS: Record<
  ProspectusPageThreeIncomeStatementRowKey,
  string
> = {
  revenue: "Revenue",
  gross_profit: "Gross Profit",
  ebitda: "EBITDA",
  ebit: "EBIT",
  profit_before_tax: "Profit Before Tax",
  profit_after_tax: "Profit After Tax",
  net_profit_margin: "Net Profit Margin",
};

export interface ProspectusPageThreeIncomeStatementYear {
  year: number;
  yearLabel: string;
  financialYearEndLabel: string;
}

export interface ProspectusPageThreeIncomeStatementRow {
  key: ProspectusPageThreeIncomeStatementRowKey;
  label: string;
  /** One formatted value per selected year, same order as Page 2 Stage 4A. */
  values: string[];
}

export interface ProspectusPageThreeIncomeStatementAudit {
  source: {
    reusedFrom: "page_2_financial_comparison_source";
    independentYearSelectionAllowed: false;
    ctosFallbackAllowed: false;
  };
  revenue: {
    rawKey: "turnover";
    status: "confirmed";
    formatter: "formatProspectusMoneyMyr";
  };
  grossProfit: {
    status: "unresolved";
    rawKeyAvailable: false;
    generatedCalculationAllowed: false;
  };
  ebitda: {
    status: "unresolved";
    rawKeyAvailable: false;
    generatedCalculationAllowed: false;
  };
  ebit: {
    status: "unresolved";
    rawKeyAvailable: false;
    generatedCalculationAllowed: false;
  };
  profitBeforeTax: {
    rawKey: "plnpbt";
    status: "confirmed";
    publicationSnapshotExtensionRequired: true;
  };
  profitAfterTax: {
    rawKey: "plnpat";
    status: "confirmed";
  };
  netProfitMargin: {
    calculator: "calculateProfitMargin";
    sharedWithPageTwo: true;
  };
  snapshot: {
    currentSharedBranch: "page_2.financial_comparison";
    liveFallbackForPublishedAllowed: false;
    publicationExtensionPending: true;
  };
}

export const PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_AUDIT: ProspectusPageThreeIncomeStatementAudit =
  {
    source: {
      reusedFrom: "page_2_financial_comparison_source",
      independentYearSelectionAllowed: false,
      ctosFallbackAllowed: false,
    },
    revenue: {
      rawKey: "turnover",
      status: "confirmed",
      formatter: "formatProspectusMoneyMyr",
    },
    grossProfit: {
      status: "unresolved",
      rawKeyAvailable: false,
      generatedCalculationAllowed: false,
    },
    ebitda: {
      status: "unresolved",
      rawKeyAvailable: false,
      generatedCalculationAllowed: false,
    },
    ebit: {
      status: "unresolved",
      rawKeyAvailable: false,
      generatedCalculationAllowed: false,
    },
    profitBeforeTax: {
      rawKey: "plnpbt",
      status: "confirmed",
      publicationSnapshotExtensionRequired: true,
    },
    profitAfterTax: {
      rawKey: "plnpat",
      status: "confirmed",
    },
    netProfitMargin: {
      calculator: "calculateProfitMargin",
      sharedWithPageTwo: true,
    },
    snapshot: {
      currentSharedBranch: "page_2.financial_comparison",
      liveFallbackForPublishedAllowed: false,
      publicationExtensionPending: true,
    },
  };

export interface ProspectusPageThreeIncomeStatement {
  sectionHeading: string;
  years: ProspectusPageThreeIncomeStatementYear[];
  rows: ProspectusPageThreeIncomeStatementRow[];
  /** Audit/debug only — omitted from Canva HTML. */
  audit: ProspectusPageThreeIncomeStatementAudit;
}

export interface ProspectusPageThreeIncomeStatementInput {
  /** Existing Page 2 Stage 4A result — required; never re-parsed here. */
  financialSource: ProspectusFinancialComparisonSource;
  /**
   * Temporary builder-only manual fills for unsupported rows.
   * Cannot override confirmed derived fields (revenue/PBT/PAT/NPM).
   */
  prospectusFinancialInputs?: {
    years: Record<
      string,
      {
        grossProfit?: number | string | null;
        ebitda?: number | string | null;
        ebit?: number | string | null;
      }
    >;
  };
  /** Observational — must never fill years or cells. */
  ctosFinancials?: unknown;
}

export interface ProspectusPageThreeIncomeStatementFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static" | "stored" | "calculated" | "unresolved" | "reused";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_FIELD_SOURCES: Record<
  ProspectusPageThreeIncomeStatementRowKey | "sectionHeading" | "years",
  ProspectusPageThreeIncomeStatementFieldSource
> = {
  sectionHeading: {
    label: "Section heading",
    canonicalSource: "static",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "none",
    notes: "3-YEAR INCOME STATEMENT SUMMARY",
  },
  years: {
    label: "Selected financial years",
    canonicalSource: "page_2_financial_comparison_source.years",
    availability: "reused",
    surface: "canva",
    possibleAlternatives: "Independent Page 3 year selection; CTOS — not used",
    notes: "Pass-through year / yearLabel / financialYearEndLabel only.",
  },
  revenue: {
    label: "Revenue",
    canonicalSource: "rawFinancials.turnover",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "CTOS turnover — not used",
    notes: "formatProspectusMoneyMyr; full MYR; zero kept.",
  },
  gross_profit: {
    label: "Gross Profit",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "Infer from revenue/PAT — not used",
    notes: "No confirmed Application FS key.",
  },
  ebitda: {
    label: "EBITDA",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "Generic EBITDA identity — not used",
    notes: "No confirmed Application FS key.",
  },
  ebit: {
    label: "EBIT",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "Generic EBIT identity — not used",
    notes: "No confirmed Application FS key.",
  },
  profit_before_tax: {
    label: "Profit Before Tax",
    canonicalSource: "rawFinancials.plnpbt",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "Live Application read — not used",
    notes:
      "Confirmed issuer/admin field. Current page_2 freeze lacks plnpbt; missing → DNA until snapshot extension.",
  },
  profit_after_tax: {
    label: "Profit After Tax",
    canonicalSource: "rawFinancials.plnpat",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "CTOS PAT — not used",
    notes: "Same key as Page 2 Stage 4B.",
  },
  net_profit_margin: {
    label: "Net Profit Margin",
    canonicalSource: "calculateProfitMargin(plnpat, turnover)",
    availability: "calculated",
    surface: "canva",
    possibleAlternatives: "Local duplicate formula — not used",
    notes: "Same helper + percent formatter as Page 2 Stage 4B.",
  },
};
