/**
 * SECTION: Prospectus Page 3 — Investor Takeaways (visible Stage 6)
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
  "4. INVESTOR TAKEAWAYS";

export const PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAY_KEYS = [
  "revenue_profitability",
  "liquidity",
  "leverage",
  "debt_servicing_capacity",
  "receivables_collection",
  "overall_financial_profile",
] as const;

export type ProspectusPageThreeInvestorTakeawayKey =
  (typeof PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAY_KEYS)[number];

export const PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAY_LABELS: Record<
  ProspectusPageThreeInvestorTakeawayKey,
  string
> = {
  revenue_profitability: "Revenue & Profitability",
  liquidity: "Liquidity",
  leverage: "Leverage",
  debt_servicing_capacity: "Debt Servicing Capacity",
  receivables_collection: "Receivables Collection",
  overall_financial_profile: "Overall Financial Profile",
};

export interface ProspectusPageThreeInvestorTakeawayItem {
  key: ProspectusPageThreeInvestorTakeawayKey;
  label: string;
  /** Catalogue investor text, empty when omitted, or Data not available when unset. */
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
  /** Category keys with selection `do_not_display` — not rendered. */
  omittedKeys: string[];
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
  /**
   * Optional typed catalogue + selections (preview/future workflow).
   * Production Prisma path leaves these undefined → DNA.
   * Free-text takeaways are not accepted.
   */
  investorTakeawayOptions?: Record<
    ProspectusPageThreeInvestorTakeawayKey,
    Array<{ key: string; text: string | null }>
  >;
  investorTakeawaySelections?: Partial<
    Record<ProspectusPageThreeInvestorTakeawayKey, string>
  >;
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
    notes: "4. INVESTOR TAKEAWAYS",
  },
  revenue_profitability: {
    label: "Revenue & Profitability",
    canonicalSource: "officer_selected_catalogue_key",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "Auto-derive from Revenue/PAT/NPM — not used",
    notes: "Officer selects a hard-coded option key; text from catalogue only.",
  },
  liquidity: {
    label: "Liquidity",
    canonicalSource: "officer_selected_catalogue_key",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "Current/Quick ratio thresholds — not used",
    notes: "Officer selects a hard-coded option key; text from catalogue only.",
  },
  leverage: {
    label: "Leverage",
    canonicalSource: "officer_selected_catalogue_key",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "Debt/Equity inference — not used",
    notes: "Officer selects a hard-coded option key; text from catalogue only.",
  },
  debt_servicing_capacity: {
    label: "Debt Servicing Capacity",
    canonicalSource: "officer_selected_catalogue_key",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "DSCR/Interest Coverage inference — not used",
    notes: "Officer selects a hard-coded option key; text from catalogue only.",
  },
  receivables_collection: {
    label: "Receivables Collection",
    canonicalSource: "officer_selected_catalogue_key",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "Receivables Days inference — not used",
    notes: "Officer selects a hard-coded option key; text from catalogue only.",
  },
  overall_financial_profile: {
    label: "Overall Financial Profile",
    canonicalSource: "officer_selected_catalogue_key",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "Investment recommendation; risk rating as claim — not used",
    notes: "Officer selects a hard-coded option key; text from catalogue only.",
  },
};
