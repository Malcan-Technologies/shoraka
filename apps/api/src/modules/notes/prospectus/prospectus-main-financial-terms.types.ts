/**
 * SECTION: Prospectus Page 1 — Main Financial Terms (DATA STAGE 4A)
 * WHY: Confirmed money/rate sources; expected return matches investor portal net p.a. helper
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Internal audit for expected return — not Canva-facing. */
export interface ProspectusExpectedReturnAudit {
  status: "resolved_portal_net_annual" | "unresolved";
  helper: "resolveNetExpectedReturnRatePercent";
  portalSurface: "investor_position_expected_return_pa";
  periodFormulaUsed: false;
  closingDateUsedAsStart: false;
  note: string;
}

export const PROSPECTUS_EXPECTED_RETURN_AUDIT: ProspectusExpectedReturnAudit = {
  status: "resolved_portal_net_annual",
  helper: "resolveNetExpectedReturnRatePercent",
  portalSurface: "investor_position_expected_return_pa",
  periodFormulaUsed: false,
  closingDateUsedAsStart: false,
  note:
    "Matches packages/types resolveNetExpectedReturnRatePercent (gross × (1 − service fee)). Marketplace card shows gross; position shows net. Closing Date is not the portal profit-start (activated_at is).",
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
  /**
   * Portal-consistent Expected Return (p.a.) — net after service fee.
   * Field name retained for Stage 5C / At a Glance reuse.
   */
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
  /** notes.service_fee_rate_percent — required for portal-net expected return */
  serviceFeeRatePercent?: number | null | undefined;
}

export interface ProspectusMainFinancialTermsFieldSource {
  label: string;
  canonicalSource: string;
  availability: "stored" | "constant" | "calculated";
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
    label: "Expected Return (p.a.)",
    canonicalSource:
      "resolveNetExpectedReturnRatePercent(profitRatePercent, serviceFeeRatePercent)",
    availability: "calculated",
    surface: "canva",
    possibleAlternatives:
      "marketplace gross card rate; activated_at period $ breakdown; Closing Date start — not used",
    notes:
      "Same helper as investor position Expected return (p.a.). No prospectus-only formula.",
  },
};
