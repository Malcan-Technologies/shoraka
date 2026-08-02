/**
 * SECTION: Prospectus Page 1 — Issuer Fundamentals Highlight (DATA STAGE 5B)
 * WHY: Live FS source is audit-only; no approved profitability/leverage narrative
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Confirmed live Application path — not copied into Note snapshots. */
export const PROSPECTUS_ISSUER_FINANCIAL_DATA_SOURCE =
  "applications.financial_statements";

export const PROSPECTUS_ISSUER_FUNDAMENTALS_CLAIMS_REQUIRING_APPROVAL = [
  "strong",
  "healthy",
  "consistent profitability",
  "conservative leverage",
  "financially sound",
  "improving performance",
  "resilient balance sheet",
] as const;

export interface ProspectusIssuerFundamentalsHighlightAudit {
  financialDataSource: typeof PROSPECTUS_ISSUER_FINANCIAL_DATA_SOURCE;
  /** Year keys from unaudited_by_year; caller order preserved (no invented sort). */
  financialYearsAvailable: string[];
  sourceType: "live_application";
  isFrozen: false;
  snapshotDecision: "pending";
  profitabilityEvidence: {
    sourceStatus: "not_stored";
    classificationAllowed: false;
  };
  leverageEvidence: {
    sourceStatus: "not_stored";
    classificationAllowed: false;
  };
  highlightTitle: {
    sourceStatus: "not_stored";
    claimApprovalRequired: true;
  };
  highlightExplanation: {
    sourceStatus: "not_stored";
    claimApprovalRequired: true;
  };
  claimApproval: {
    status: "pending";
    requiredClaims: typeof PROSPECTUS_ISSUER_FUNDAMENTALS_CLAIMS_REQUIRING_APPROVAL;
  };
  /**
   * Documented shared calculators only — not claim evidence.
   * profit_margin, gearing, currat, workcap, totass, totlib exist in @cashsouk/types.
   */
  documentedCalculators: typeof PROSPECTUS_ISSUER_DOCUMENTED_FINANCIAL_CALCULATORS;
}

/** Names only — Stage 5B must not call these as claim evidence. */
export const PROSPECTUS_ISSUER_DOCUMENTED_FINANCIAL_CALCULATORS = [
  "calculateProfitMargin",
  "calculateCurrentRatio",
] as const;

/** Canva-facing highlight fields only. */
export interface ProspectusIssuerFundamentalsHighlight {
  profitabilityEvidence: string;
  leverageEvidence: string;
  highlightTitle: string;
  highlightExplanation: string;
  /** Audit/debug only — omitted from Canva HTML. */
  audit: ProspectusIssuerFundamentalsHighlightAudit;
}

/**
 * Raw inputs for preview/builder — not Prisma.
 * Optional year metrics prove claims stay DNA even when numbers look “strong”.
 */
export interface ProspectusIssuerFundamentalsHighlightInput {
  /**
   * Calendar year keys from applications.financial_statements.unaudited_by_year.
   * Order preserved as provided — no Stage 5B sort rule.
   */
  financialYearsAvailable: string[] | null | undefined;
  /**
   * Observational only — raw/calculated values must not invent highlight claims.
   */
  yearMetricsObserved?: Array<{
    year?: string | null;
    turnover?: number | null;
    plnpat?: number | null;
    plnpbt?: number | null;
    profitMargin?: number | null;
    gearing?: number | null;
    currentRatio?: number | null;
  }>;
}

export interface ProspectusIssuerFundamentalsHighlightFieldSource {
  label: string;
  canonicalSource: string;
  availability: "unresolved";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT_FIELD_SOURCES: Record<
  | "profitabilityEvidence"
  | "leverageEvidence"
  | "highlightTitle"
  | "highlightExplanation",
  ProspectusIssuerFundamentalsHighlightFieldSource
> = {
  profitabilityEvidence: {
    label: "Profitability Evidence",
    canonicalSource: "none confirmed for highlight claim",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "plnpat/plnpbt; calculateProfitMargin; invent profitable/consistent rules — not used",
    notes:
      "Shared profit_margin helper is not an approved claim rule. classificationAllowed = false.",
  },
  leverageEvidence: {
    label: "Leverage Evidence",
    canonicalSource: "none confirmed for highlight claim",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "gearing helpers; currat; workcap; invent conservative/high bands — not used",
    notes: "Shared gearing helper is analytics only. classificationAllowed = false.",
  },
  highlightTitle: {
    label: "Highlight Title",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "Canva \"Strong issuer fundamentals\"; derive from ratios — not used",
    notes: "claimApprovalRequired = true. Do not generate strong/healthy titles.",
  },
  highlightExplanation: {
    label: "Highlight Explanation",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "Canva healthy/consistent/conservative copy; admin free text — not used",
    notes: "claimApprovalRequired = true. Do not compose narrative from FS metrics.",
  },
};
