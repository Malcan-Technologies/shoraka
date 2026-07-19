/**
 * SECTION: Prospectus Page 3 — Investor Takeaways (DATA STAGE 6)
 * WHY: Structural takeaway slots only; no generated financial/investment claims
 */

import type { ProspectusPageThreeBalanceSheet } from "./prospectus-page-three-balance-sheet.types";
import type { ProspectusPageThreeCoverageEfficiency } from "./prospectus-page-three-coverage-efficiency.types";
import type { ProspectusPageThreeIncomeStatement } from "./prospectus-page-three-income-statement.types";
import type { ProspectusPageThreeMetadata } from "./prospectus-page-three-metadata.types";
import type { ProspectusPageThreeTrends } from "./prospectus-page-three-trends.types";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Static Canva section title — not a database field. */
export const PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_SECTION_HEADING =
  "INVESTOR TAKEAWAYS";

export const PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAY_KEYS = [
  "revenue_profitability",
  "liquidity",
  "leverage",
  "debt_servicing_capacity",
  "working_capital_efficiency",
  "overall_financial_profile",
] as const;

export type ProspectusPageThreeInvestorTakeawayKey =
  (typeof PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAY_KEYS)[number];

export const PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAY_LABELS: Record<
  ProspectusPageThreeInvestorTakeawayKey,
  string
> = {
  revenue_profitability: "Revenue and Profitability",
  liquidity: "Liquidity",
  leverage: "Leverage",
  debt_servicing_capacity: "Debt-Servicing Capacity",
  working_capital_efficiency: "Working-Capital Efficiency",
  overall_financial_profile: "Overall Financial Profile",
};

export interface ProspectusPageThreeInvestorTakeawayItem {
  key: ProspectusPageThreeInvestorTakeawayKey;
  label: string;
  /** Always Data not available until approved frozen narrative exists. */
  takeaway: string;
}

export interface ProspectusPageThreeInvestorTakeawaysAudit {
  source: {
    approvedNarrativeSourceAvailable: false;
    adminAuthoredMemoAvailable: false;
    frozenProspectusCopyAvailable: false;
    generatedTextAllowed: false;
  };
  composition: {
    metadataInputAccepted: true;
    incomeStatementInputAccepted: true;
    balanceSheetInputAccepted: true;
    coverageEfficiencyInputAccepted: true;
    trendsInputAccepted: true;
    inputsUsedToGenerateClaims: false;
  };
  rules: {
    thresholdBasedClaimsAllowed: false;
    trendBasedClaimsAllowed: false;
    positiveValueClaimsAllowed: false;
    overallInvestmentRecommendationAllowed: false;
  };
  approval: {
    financeApprovalRequired: true;
    legalComplianceApprovalRequired: true;
    publicationFreezeRequired: true;
    versioningRequired: true;
  };
  snapshot: {
    futureBranch: "page_3.investor_takeaways";
    implemented: false;
    liveFallbackAllowed: false;
  };
}

export const PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_AUDIT: ProspectusPageThreeInvestorTakeawaysAudit =
  {
    source: {
      approvedNarrativeSourceAvailable: false,
      adminAuthoredMemoAvailable: false,
      frozenProspectusCopyAvailable: false,
      generatedTextAllowed: false,
    },
    composition: {
      metadataInputAccepted: true,
      incomeStatementInputAccepted: true,
      balanceSheetInputAccepted: true,
      coverageEfficiencyInputAccepted: true,
      trendsInputAccepted: true,
      inputsUsedToGenerateClaims: false,
    },
    rules: {
      thresholdBasedClaimsAllowed: false,
      trendBasedClaimsAllowed: false,
      positiveValueClaimsAllowed: false,
      overallInvestmentRecommendationAllowed: false,
    },
    approval: {
      financeApprovalRequired: true,
      legalComplianceApprovalRequired: true,
      publicationFreezeRequired: true,
      versioningRequired: true,
    },
    snapshot: {
      futureBranch: "page_3.investor_takeaways",
      implemented: false,
      liveFallbackAllowed: false,
    },
  };

export interface ProspectusPageThreeInvestorTakeaways {
  sectionHeading: string;
  items: ProspectusPageThreeInvestorTakeawayItem[];
  /** Audit/debug only — omitted from Canva HTML. */
  audit: ProspectusPageThreeInvestorTakeawaysAudit;
}

/**
 * Compose completed Stage 1–5 results for future wiring only.
 * Numerical and trend values must never become takeaway text today.
 */
export interface ProspectusPageThreeInvestorTakeawaysInput {
  metadata: ProspectusPageThreeMetadata;
  incomeStatement: ProspectusPageThreeIncomeStatement;
  balanceSheet: ProspectusPageThreeBalanceSheet;
  coverageEfficiency: ProspectusPageThreeCoverageEfficiency;
  trends: ProspectusPageThreeTrends;
  /** Observational — must never fill takeaways. */
  ctosFinancials?: unknown;
  /** Observational — must never fill takeaways. */
  adminMemoText?: string | null;
  /** Observational Canva sample — must never be used. */
  canvaSampleTakeaways?: string[] | null;
}

export interface ProspectusPageThreeInvestorTakeawaysFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static" | "unresolved";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_FIELD_SOURCES: Record<
  ProspectusPageThreeInvestorTakeawayKey | "sectionHeading",
  ProspectusPageThreeInvestorTakeawaysFieldSource
> = {
  sectionHeading: {
    label: "Section heading",
    canonicalSource: "static",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "none",
    notes: "INVESTOR TAKEAWAYS",
  },
  revenue_profitability: {
    label: "Revenue and Profitability",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "Revenue/PAT/NPM movement; Canva growth copy — not used",
    notes: "No approved frozen narrative.",
  },
  liquidity: {
    label: "Liquidity",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "Current Ratio thresholds; Canva healthy-liquidity copy — not used",
    notes: "No approved frozen narrative.",
  },
  leverage: {
    label: "Leverage",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "calculateGearing; bsqpuc as equity — rejected",
    notes: "No approved frozen narrative.",
  },
  debt_servicing_capacity: {
    label: "Debt-Servicing Capacity",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "DSCR/Interest Coverage inference — not used",
    notes: "Coverage metrics themselves unresolved.",
  },
  working_capital_efficiency: {
    label: "Working-Capital Efficiency",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "Receivables/Payables Days inference — not used",
    notes: "Days metrics unresolved; no approved narrative.",
  },
  overall_financial_profile: {
    label: "Overall Financial Profile",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "Investment recommendation; risk rating as claim — not used",
    notes: "No summary rating or recommendation allowed.",
  },
};
