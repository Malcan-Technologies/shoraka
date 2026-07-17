/**
 * SECTION: Prospectus Page 1 — Main Financial Terms (DATA STAGE 4A)
 * WHY: Confirmed money/rate sources; period return unresolved; Stage 6 reuses flat fields
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Internal audit for unresolved expected period return — not Canva-facing. */
export interface ProspectusExpectedReturnAudit {
  status: "unresolved";
  formulaDecision: "pending";
  grossOrNetDecision: "pending";
  dayCountDecision: "pending";
  roundingDecision: "pending";
}

export const PROSPECTUS_EXPECTED_RETURN_AUDIT: ProspectusExpectedReturnAudit = {
  status: "unresolved",
  formulaDecision: "pending",
  grossOrNetDecision: "pending",
  dayCountDecision: "pending",
  roundingDecision: "pending",
};

/**
 * Flat Canva-facing fields kept at root so Stage 6 can reuse
 * buildProspectusMainFinancialTerms without a second formatter path.
 */
export interface ProspectusMainFinancialTerms {
  financingAmount: string;
  minimumInvestment: string;
  /** Annual gross percent display (no "p.a." suffix — label carries it). */
  profitRate: string;
  expectedReturnForInvestmentPeriod: string;
  /** Audit/debug only — omitted from Canva HTML. */
  audit: {
    expectedReturn: ProspectusExpectedReturnAudit;
  };
}

/** Raw numeric inputs for preview/builder — not Prisma. */
export interface ProspectusMainFinancialTermsInput {
  /** notes.target_amount */
  targetAmount: number | null | undefined;
  /** notes.profit_rate_percent (annual gross before investor service fees) */
  profitRatePercent: number | null | undefined;
}

export interface ProspectusMainFinancialTermsFieldSource {
  label: string;
  canonicalSource: string;
  availability: "stored" | "constant" | "unresolved";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_MAIN_FINANCIAL_TERMS_FIELD_SOURCES: Record<
  "financingAmount" | "minimumInvestment" | "profitRate" | "expectedReturnForInvestmentPeriod",
  ProspectusMainFinancialTermsFieldSource
> = {
  financingAmount: {
    label: "Financing Amount",
    canonicalSource: "notes.target_amount",
    availability: "stored",
    surface: "canva",
    possibleAlternatives:
      "invoice value; offered amount; funded_amount; disbursed; principal — not used",
    notes: "Marketplace financing target. API: NoteListItem.targetAmount.",
  },
  minimumInvestment: {
    label: "Minimum Investment",
    canonicalSource: "MARKETPLACE_MIN_COMMIT_MYR (@cashsouk/types)",
    availability: "constant",
    surface: "canva",
    possibleAlternatives:
      "computeMarketplaceCommitBounds().minCommit (capacity-adjusted) — not used for prospectus",
    notes: "Platform-wide minimum. Do not hardcode 100 in this module.",
  },
  profitRate: {
    label: "Profit Rate (p.a.)",
    canonicalSource: "notes.profit_rate_percent",
    availability: "stored",
    surface: "canva",
    possibleAlternatives:
      "live offer rate; annual net expectedReturnRatePercent; period return — not used",
    notes:
      "Annual GROSS before investor service fees. Value uses formatInvestorReturnRatePercent (no duplicated p.a.). Not \"Profit Rate for Investors\".",
  },
  expectedReturnForInvestmentPeriod: {
    label: "Expected Return for Investment Period",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "gross×days/365; computeNetExpectedReturnRatePercent; Canva 3.95% — not used",
    notes:
      "No approved formula/gross-vs-net/day-count/rounding. Tenure omitted here (Stage 2/6). audit.expectedReturn.* pending.",
  },
};
