/**
 * SECTION: Prospectus Page 1 — At a Glance (DATA STAGE 6)
 * WHY: Compose Stage 4A + Stage 2 values; no alternate sources or calculations
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export interface ProspectusAtAGlance {
  financingAmount: string;
  profitRate: string;
  expectedReturn: string;
  tenure: string;
  minimumInvestment: string;
}

/** Raw inputs — same as Stage 4A + Stage 2 tenure inputs. */
export interface ProspectusAtAGlanceInput {
  /** notes.target_amount */
  targetAmount: number | null | undefined;
  /** notes.profit_rate_percent (annual gross) */
  profitRatePercent: number | null | undefined;
  /** note_listings.opens_at */
  listingOpensAt: Date | string | null | undefined;
  /** notes.maturity_date */
  maturityDate: Date | string | null | undefined;
}

export interface ProspectusAtAGlanceFieldSource {
  label: string;
  displayLabel: string;
  canonicalSource: string;
  availability: "stored" | "calculated" | "constant" | "unresolved";
  reusedFrom: string;
  notes: string;
}

/**
 * Display labels: avoid Canva "Profit Rate for Investors" (implies net/after fees)
 * and prefer singular "Expected return" for the unresolved period metric.
 */
export const PROSPECTUS_AT_A_GLANCE_FIELD_SOURCES: Record<
  keyof ProspectusAtAGlance,
  ProspectusAtAGlanceFieldSource
> = {
  financingAmount: {
    label: "Financing amount",
    displayLabel: "Financing amount",
    canonicalSource: "notes.target_amount",
    availability: "stored",
    reusedFrom: "Stage 4A buildProspectusMainFinancialTerms.financingAmount",
    notes: "Same formatter as Stage 4A. Not invoice/funded/offered amount.",
  },
  profitRate: {
    label: "Profit rate (p.a.)",
    displayLabel: "Profit rate (p.a.)",
    canonicalSource: "notes.profit_rate_percent",
    availability: "stored",
    reusedFrom: "Stage 4A buildProspectusMainFinancialTerms.profitRate",
    notes:
      "Annual GROSS before service fee. Not \"Profit Rate for Investors\" (misleading vs after-fee). Marketplace: \"Profit rate\".",
  },
  expectedReturn: {
    label: "Expected return",
    displayLabel: "Expected return",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    reusedFrom: "Stage 4A expectedReturnForInvestmentPeriod",
    notes:
      "Canva \"Expected Returns\" (plural) and period %. Singular matches Stage 4A / platform \"Expected return\". Value remains Data not available.",
  },
  tenure: {
    label: "Tenure",
    displayLabel: "Tenure",
    canonicalSource:
      "buildProspectusTenureAndMaturity → calculateCalendarDayCount(opens_at, maturity_date)",
    availability: "calculated",
    reusedFrom: "Stage 2 buildProspectusTenureAndMaturity.tenure",
    notes: "Same helper as Stages 2/4B/5C. Not days remaining.",
  },
  minimumInvestment: {
    label: "Minimum investment",
    displayLabel: "Minimum investment",
    canonicalSource: "MARKETPLACE_MIN_COMMIT_MYR (@cashsouk/types)",
    availability: "constant",
    reusedFrom: "Stage 4A buildProspectusMainFinancialTerms.minimumInvestment",
    notes: "Not hardcoded RM100 here. Not capacity-adjusted minCommit.",
  },
};
