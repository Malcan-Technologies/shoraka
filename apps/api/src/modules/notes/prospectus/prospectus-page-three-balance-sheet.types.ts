/**
 * SECTION: Prospectus Page 3 — Balance Sheet and Liquidity (DATA STAGE 3)
 * WHY: Confirmed Application FS lines + admin shared totals; unsupported Canva rows DNA
 */

import type { ProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source.types";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Static Canva section title — not a database field. */
export const PROSPECTUS_PAGE_THREE_BALANCE_SHEET_SECTION_HEADING =
  "BALANCE SHEET AND LIQUIDITY";

export const PROSPECTUS_PAGE_THREE_BALANCE_SHEET_ROW_KEYS = [
  "cash_and_bank",
  "trade_receivables",
  "current_assets",
  "total_assets",
  "current_liabilities",
  "total_liabilities",
  "total_equity",
  "current_ratio",
  "quick_ratio",
] as const;

export type ProspectusPageThreeBalanceSheetRowKey =
  (typeof PROSPECTUS_PAGE_THREE_BALANCE_SHEET_ROW_KEYS)[number];

export const PROSPECTUS_PAGE_THREE_BALANCE_SHEET_ROW_LABELS: Record<
  ProspectusPageThreeBalanceSheetRowKey,
  string
> = {
  cash_and_bank: "Cash & Bank",
  trade_receivables: "Trade Receivables",
  current_assets: "Current Assets",
  total_assets: "Total Assets",
  current_liabilities: "Current Liabilities",
  total_liabilities: "Total Liabilities",
  total_equity: "Total Equity",
  current_ratio: "Current Ratio",
  quick_ratio: "Quick Ratio",
};

export interface ProspectusPageThreeBalanceSheetYear {
  year: number;
  yearLabel: string;
  financialYearEndLabel: string;
}

export interface ProspectusPageThreeBalanceSheetRow {
  key: ProspectusPageThreeBalanceSheetRowKey;
  label: string;
  /** One formatted value per selected year, same order as Page 2 Stage 4A. */
  values: string[];
}

/**
 * Missing-component policy for Total Assets / Total Liabilities matches
 * computeTotalAssets / computeTotalLiabilities: nullish components → 0 in the sum.
 * Entirely missing inputs therefore yield 0 (finance/product risk for incomplete freezes).
 */
export type ProspectusPageThreeBalanceSheetMissingComponentPolicy =
  "nullish_component_defaults_to_zero_in_sum";

export interface ProspectusPageThreeBalanceSheetAudit {
  source: {
    reusedFrom: "page_2_financial_comparison_source";
    independentYearSelectionAllowed: false;
    ctosFallbackAllowed: false;
  };
  cashAndBank: {
    status: "unresolved";
    bsclbankRejected: true;
  };
  tradeReceivables: {
    status: "unresolved";
    rawKeyAvailable: false;
  };
  currentAssets: {
    rawKey: "bscatot";
    status: "confirmed";
  };
  totalAssets: {
    status: "confirmed_calculation";
    inputKeys: ["bsfatot", "othass", "bscatot", "bsclbank"];
    sharedHelper: "computeTotalAssets";
    missingComponentPolicy: ProspectusPageThreeBalanceSheetMissingComponentPolicy;
    publicationSnapshotExtensionRequired: true;
    financeProductRiskAllMissingYieldsZero: true;
  };
  currentLiabilities: {
    rawKey: "curlib";
    status: "confirmed";
  };
  totalLiabilities: {
    status: "confirmed_calculation";
    inputKeys: ["curlib", "bsslltd", "bsclstd"];
    sharedHelper: "computeTotalLiabilities";
    missingComponentPolicy: ProspectusPageThreeBalanceSheetMissingComponentPolicy;
    publicationSnapshotExtensionRequired: true;
    financeProductRiskAllMissingYieldsZero: true;
  };
  totalEquity: {
    status: "unresolved";
    bsqpucIsPaidUpCapital: true;
    relabelAllowed: false;
  };
  currentRatio: {
    calculator: "calculateCurrentRatio";
    sharedWithPageTwo: true;
  };
  quickRatio: {
    status: "unresolved";
    approvedFormulaAvailable: false;
  };
  snapshot: {
    currentSharedBranch: "page_2.financial_comparison";
    liveFallbackForPublishedAllowed: false;
    publicationExtensionPending: true;
  };
}

export const PROSPECTUS_PAGE_THREE_BALANCE_SHEET_AUDIT: ProspectusPageThreeBalanceSheetAudit =
  {
    source: {
      reusedFrom: "page_2_financial_comparison_source",
      independentYearSelectionAllowed: false,
      ctosFallbackAllowed: false,
    },
    cashAndBank: {
      status: "unresolved",
      bsclbankRejected: true,
    },
    tradeReceivables: {
      status: "unresolved",
      rawKeyAvailable: false,
    },
    currentAssets: {
      rawKey: "bscatot",
      status: "confirmed",
    },
    totalAssets: {
      status: "confirmed_calculation",
      inputKeys: ["bsfatot", "othass", "bscatot", "bsclbank"],
      sharedHelper: "computeTotalAssets",
      missingComponentPolicy: "nullish_component_defaults_to_zero_in_sum",
      publicationSnapshotExtensionRequired: true,
      financeProductRiskAllMissingYieldsZero: true,
    },
    currentLiabilities: {
      rawKey: "curlib",
      status: "confirmed",
    },
    totalLiabilities: {
      status: "confirmed_calculation",
      inputKeys: ["curlib", "bsslltd", "bsclstd"],
      sharedHelper: "computeTotalLiabilities",
      missingComponentPolicy: "nullish_component_defaults_to_zero_in_sum",
      publicationSnapshotExtensionRequired: true,
      financeProductRiskAllMissingYieldsZero: true,
    },
    totalEquity: {
      status: "unresolved",
      bsqpucIsPaidUpCapital: true,
      relabelAllowed: false,
    },
    currentRatio: {
      calculator: "calculateCurrentRatio",
      sharedWithPageTwo: true,
    },
    quickRatio: {
      status: "unresolved",
      approvedFormulaAvailable: false,
    },
    snapshot: {
      currentSharedBranch: "page_2.financial_comparison",
      liveFallbackForPublishedAllowed: false,
      publicationExtensionPending: true,
    },
  };

export interface ProspectusPageThreeBalanceSheet {
  sectionHeading: string;
  years: ProspectusPageThreeBalanceSheetYear[];
  rows: ProspectusPageThreeBalanceSheetRow[];
  /** Audit/debug only — omitted from Canva HTML. */
  audit: ProspectusPageThreeBalanceSheetAudit;
}

export interface ProspectusPageThreeBalanceSheetInput {
  /** Existing Page 2 Stage 4A result — required; never re-parsed here. */
  financialSource: ProspectusFinancialComparisonSource;
  /** Observational — must never fill years or cells. */
  ctosFinancials?: unknown;
}

export interface ProspectusPageThreeBalanceSheetFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static" | "stored" | "calculated" | "unresolved" | "reused";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_PAGE_THREE_BALANCE_SHEET_FIELD_SOURCES: Record<
  ProspectusPageThreeBalanceSheetRowKey | "sectionHeading" | "years",
  ProspectusPageThreeBalanceSheetFieldSource
> = {
  sectionHeading: {
    label: "Section heading",
    canonicalSource: "static",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "none",
    notes: "BALANCE SHEET AND LIQUIDITY",
  },
  years: {
    label: "Selected financial years",
    canonicalSource: "page_2_financial_comparison_source.years",
    availability: "reused",
    surface: "canva",
    possibleAlternatives: "Independent Page 3 year selection; CTOS — not used",
    notes: "Pass-through year / yearLabel / financialYearEndLabel only.",
  },
  cash_and_bank: {
    label: "Cash & Bank",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "bsclbank — rejected (Non-Current Assets)",
    notes: "No confirmed cash/bank Application FS key.",
  },
  trade_receivables: {
    label: "Trade Receivables",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "none",
    notes: "No confirmed receivables Application FS key.",
  },
  current_assets: {
    label: "Current Assets",
    canonicalSource: "rawFinancials.bscatot",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "CTOS — not used",
    notes: "formatProspectusMoneyMyr; missing → DNA.",
  },
  total_assets: {
    label: "Total Assets",
    canonicalSource: "computeTotalAssets(bsfatot, othass, bscatot, bsclbank)",
    availability: "calculated",
    surface: "canva",
    possibleAlternatives: "Local sum; CTOS totass — not used",
    notes:
      "Admin Application path helper. bsclbank = Non-Current Assets. Missing components → 0 in sum.",
  },
  current_liabilities: {
    label: "Current Liabilities",
    canonicalSource: "rawFinancials.curlib",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "CTOS — not used",
    notes: "formatProspectusMoneyMyr; missing → DNA.",
  },
  total_liabilities: {
    label: "Total Liabilities",
    canonicalSource: "computeTotalLiabilities(curlib, bsslltd, bsclstd)",
    availability: "calculated",
    surface: "canva",
    possibleAlternatives: "Local sum; CTOS totlib — not used",
    notes: "Admin Application path helper. Missing components → 0 in sum.",
  },
  total_equity: {
    label: "Total Equity",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "bsqpuc (Paid-Up Capital) — not relabelled",
    notes: "Finance approval required before using paid-up capital as Total Equity.",
  },
  current_ratio: {
    label: "Current Ratio",
    canonicalSource: "calculateCurrentRatio(bscatot, curlib)",
    availability: "calculated",
    surface: "canva",
    possibleAlternatives: "Local duplicate formula — not used",
    notes: "Same helper + multiple formatter as Page 2 Stage 4B.",
  },
  quick_ratio: {
    label: "Quick Ratio",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "Generic (CA−inventory)/CL — not used",
    notes: "No approved shared formula or inventory field.",
  },
};
