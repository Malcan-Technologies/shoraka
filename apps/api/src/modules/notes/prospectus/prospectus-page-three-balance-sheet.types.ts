/**
 * SECTION: Prospectus Page 3 — Balance Sheet and Liquidity (visible Stage 4)
 * WHY: Confirmed Application FS lines + officer fills; MYR mil. display
 */

import type { ProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source.types";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Static Canva section title — not a database field. */
export const PROSPECTUS_PAGE_THREE_BALANCE_SHEET_SECTION_HEADING =
  "3-YEAR BALANCE SHEET & LIQUIDITY (MYR mil.)";

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
 * Missing-component policy matches Application Financial Summary:
 * nullish components → 0 in the sum (via computeTotalAssets / computeTotalLiabilities).
 * Flat CTOS totass / totlib preferred when present.
 */
export type ProspectusPageThreeBalanceSheetMissingComponentPolicy =
  "application_aligned_zero_default_with_flat_total_preference";

export interface ProspectusPageThreeBalanceSheetAudit {
  source: {
    reusedFrom: "page_2_financial_comparison_source";
    independentYearSelectionAllowed: false;
    ctosFallbackAllowed: false;
  };
  cashAndBank: {
    status: "officer_entered";
    source: "page3.manualFinancialInputs.years.{year}.cashAndBank";
    bsclbankRejected: true;
    storageUnit: "full_myr";
    formatter: "formatProspectusMyrMillions";
    requiredForApproval: true;
  };
  tradeReceivables: {
    status: "officer_entered";
    source: "page3.manualFinancialInputs.years.{year}.tradeReceivables";
    rawKeyAvailable: false;
    storageUnit: "full_myr";
    formatter: "formatProspectusMyrMillions";
    requiredForApproval: true;
  };
  currentAssets: {
    rawKey: "bscatot";
    status: "confirmed";
    formatter: "formatProspectusMyrMillions";
    storageUnit: "full_myr";
  };
  totalAssets: {
    status: "confirmed_calculation";
    inputKeys: ["totass", "bsfatot", "othass", "bscatot", "bsclbank"];
    sharedHelper: "resolveApplicationFinancialTotalAssets";
    formatter: "formatProspectusMyrMillions";
    missingComponentPolicy: ProspectusPageThreeBalanceSheetMissingComponentPolicy;
    publicationSnapshotExtensionRequired: true;
    officerOverrideAllowed: false;
    alignedWithApplicationFinancialSummary: true;
  };
  currentLiabilities: {
    rawKey: "curlib";
    status: "confirmed";
    formatter: "formatProspectusMyrMillions";
    storageUnit: "full_myr";
  };
  totalLiabilities: {
    status: "confirmed_calculation";
    inputKeys: ["totlib", "curlib", "bsslltd", "bsclstd"];
    sharedHelper: "resolveApplicationFinancialTotalLiabilities";
    formatter: "formatProspectusMyrMillions";
    missingComponentPolicy: ProspectusPageThreeBalanceSheetMissingComponentPolicy;
    publicationSnapshotExtensionRequired: true;
    officerOverrideAllowed: false;
    alignedWithApplicationFinancialSummary: true;
  };
  totalEquity: {
    status: "officer_entered";
    source: "page3.manualFinancialInputs.years.{year}.totalEquity";
    bsqpucIsPaidUpCapital: true;
    relabelAllowed: false;
    storageUnit: "full_myr";
    formatter: "formatProspectusMyrMillions";
    requiredForApproval: true;
  };
  currentRatio: {
    calculator: "calculateCurrentRatio";
    sharedWithPageTwo: true;
    formatter: "formatProspectusFinancialMultiple";
  };
  quickRatio: {
    status: "officer_entered";
    source: "page3.manualFinancialInputs.years.{year}.quickRatio";
    approvedFormulaAvailable: false;
    storageUnit: "ratio";
    formatter: "formatProspectusFinancialMultiple";
    requiredForApproval: true;
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
      status: "officer_entered",
      source: "page3.manualFinancialInputs.years.{year}.cashAndBank",
      bsclbankRejected: true,
      storageUnit: "full_myr",
      formatter: "formatProspectusMyrMillions",
      requiredForApproval: true,
    },
    tradeReceivables: {
      status: "officer_entered",
      source: "page3.manualFinancialInputs.years.{year}.tradeReceivables",
      rawKeyAvailable: false,
      storageUnit: "full_myr",
      formatter: "formatProspectusMyrMillions",
      requiredForApproval: true,
    },
    currentAssets: {
      rawKey: "bscatot",
      status: "confirmed",
      formatter: "formatProspectusMyrMillions",
      storageUnit: "full_myr",
    },
    totalAssets: {
      status: "confirmed_calculation",
      inputKeys: ["totass", "bsfatot", "othass", "bscatot", "bsclbank"],
      sharedHelper: "resolveApplicationFinancialTotalAssets",
      formatter: "formatProspectusMyrMillions",
      missingComponentPolicy: "application_aligned_zero_default_with_flat_total_preference",
      publicationSnapshotExtensionRequired: true,
      officerOverrideAllowed: false,
      alignedWithApplicationFinancialSummary: true,
    },
    currentLiabilities: {
      rawKey: "curlib",
      status: "confirmed",
      formatter: "formatProspectusMyrMillions",
      storageUnit: "full_myr",
    },
    totalLiabilities: {
      status: "confirmed_calculation",
      inputKeys: ["totlib", "curlib", "bsslltd", "bsclstd"],
      sharedHelper: "resolveApplicationFinancialTotalLiabilities",
      formatter: "formatProspectusMyrMillions",
      missingComponentPolicy: "application_aligned_zero_default_with_flat_total_preference",
      publicationSnapshotExtensionRequired: true,
      officerOverrideAllowed: false,
      alignedWithApplicationFinancialSummary: true,
    },
    totalEquity: {
      status: "officer_entered",
      source: "page3.manualFinancialInputs.years.{year}.totalEquity",
      bsqpucIsPaidUpCapital: true,
      relabelAllowed: false,
      storageUnit: "full_myr",
      formatter: "formatProspectusMyrMillions",
      requiredForApproval: true,
    },
    currentRatio: {
      calculator: "calculateCurrentRatio",
      sharedWithPageTwo: true,
      formatter: "formatProspectusFinancialMultiple",
    },
    quickRatio: {
      status: "officer_entered",
      source: "page3.manualFinancialInputs.years.{year}.quickRatio",
      approvedFormulaAvailable: false,
      storageUnit: "ratio",
      formatter: "formatProspectusFinancialMultiple",
      requiredForApproval: true,
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
  prospectusFinancialInputs?: {
    years: Record<
      string,
      {
        cashAndBank?: number | string | null;
        tradeReceivables?: number | string | null;
        totalEquity?: number | string | null;
        quickRatio?: number | string | null;
      }
    >;
  };
  /** Observational — must never fill years or cells. */
  ctosFinancials?: unknown;
}

export interface ProspectusPageThreeBalanceSheetFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static" | "stored" | "calculated" | "unresolved" | "reused" | "officer";
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
    notes: "3-YEAR BALANCE SHEET & LIQUIDITY (MYR mil.)",
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
    canonicalSource: "page3.manualFinancialInputs.years.{year}.cashAndBank",
    availability: "officer",
    surface: "canva",
    possibleAlternatives: "bsclbank — rejected (Non-Current Assets)",
    notes: "Full MYR storage; formatProspectusMyrMillions display.",
  },
  trade_receivables: {
    label: "Trade Receivables",
    canonicalSource: "page3.manualFinancialInputs.years.{year}.tradeReceivables",
    availability: "officer",
    surface: "canva",
    possibleAlternatives: "none",
    notes: "Full MYR storage; formatProspectusMyrMillions display.",
  },
  current_assets: {
    label: "Current Assets",
    canonicalSource: "rawFinancials.bscatot",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "CTOS — not used",
    notes: "formatProspectusMyrMillions; missing → DNA.",
  },
  total_assets: {
    label: "Total Assets",
    canonicalSource: "resolveApplicationFinancialTotalAssets(totass | bsfatot+othass+bscatot+bsclbank)",
    availability: "calculated",
    surface: "canva",
    possibleAlternatives: "none — must match Application Financial Summary",
    notes:
      "Prefer flat totass when present (CTOS). Else computeTotalAssets with zero-default components. Display via formatProspectusMyrMillions.",
  },
  current_liabilities: {
    label: "Current Liabilities",
    canonicalSource: "rawFinancials.curlib",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "CTOS — not used",
    notes: "formatProspectusMyrMillions; missing → DNA.",
  },
  total_liabilities: {
    label: "Total Liabilities",
    canonicalSource: "resolveApplicationFinancialTotalLiabilities(totlib | curlib+bsslltd+bsclstd)",
    availability: "calculated",
    surface: "canva",
    possibleAlternatives: "none — must match Application Financial Summary",
    notes:
      "Prefer flat totlib when present (CTOS). Else computeTotalLiabilities with zero-default components. Display via formatProspectusMyrMillions.",
  },
  total_equity: {
    label: "Total Equity",
    canonicalSource: "page3.manualFinancialInputs.years.{year}.totalEquity",
    availability: "officer",
    surface: "canva",
    possibleAlternatives: "bsqpuc (Paid-Up Capital) — not relabelled",
    notes: "Full MYR storage; formatProspectusMyrMillions display.",
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
    canonicalSource: "page3.manualFinancialInputs.years.{year}.quickRatio",
    availability: "officer",
    surface: "canva",
    possibleAlternatives: "Generic (CA−inventory)/CL — not used",
    notes: "Ratio storage (no x); formatProspectusFinancialMultiple display.",
  },
};
