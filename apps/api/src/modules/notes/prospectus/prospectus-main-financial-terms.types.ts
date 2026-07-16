/**
 * SECTION: Prospectus Page 1 — Main Financial Terms (DATA STAGE 4A)
 * WHY: Financing amount, platform min ticket, gross profit rate, unresolved period return
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export interface ProspectusMainFinancialTerms {
  financingAmount: string;
  minimumInvestment: string;
  profitRate: string;
  expectedReturnForInvestmentPeriod: string;
}

/** Raw numeric inputs for preview/builder — not Prisma. */
export interface ProspectusMainFinancialTermsInput {
  /** notes.target_amount */
  targetAmount: number | null | undefined;
  /** notes.profit_rate_percent (annual gross) */
  profitRatePercent: number | null | undefined;
}

export interface ProspectusMainFinancialTermsFieldSource {
  label: string;
  canonicalSource: string;
  availability: "stored" | "constant" | "unresolved";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_MAIN_FINANCIAL_TERMS_FIELD_SOURCES: Record<
  keyof ProspectusMainFinancialTerms,
  ProspectusMainFinancialTermsFieldSource
> = {
  financingAmount: {
    label: "Financing amount",
    canonicalSource: "notes.target_amount",
    availability: "stored",
    possibleAlternatives:
      "invoice amount; funded_amount; offer_details.offered_amount — not used",
    notes: "Marketplace raise / Goal. API: NoteListItem.targetAmount.",
  },
  minimumInvestment: {
    label: "Minimum investment",
    canonicalSource: "MARKETPLACE_MIN_COMMIT_MYR (@cashsouk/types)",
    availability: "constant",
    possibleAlternatives:
      "computeMarketplaceCommitBounds().minCommit (capacity-adjusted) — not used for prospectus",
    notes: "Platform ticket floor. Commit flow may lower min when remaining capacity < floor.",
  },
  profitRate: {
    label: "Profit rate (p.a.)",
    canonicalSource: "notes.profit_rate_percent",
    availability: "stored",
    possibleAlternatives: "live invoice offer_details.offered_profit_rate_percent — not used",
    notes:
      "Annual GROSS contractual rate before service fee. Marketplace tooltip confirms before-fee meaning.",
  },
  expectedReturnForInvestmentPeriod: {
    label: "Expected return for investment period",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives:
      "annual net expectedReturnRatePercent; period MYR via computeIllustrativeInvestorReturnBreakdown / waterfall (days/365); Canva-like gross period % — not used without business decision",
    notes:
      "No existing period-return % field. Do not reuse annual rates or invent 12×days/365 here.",
  },
};
