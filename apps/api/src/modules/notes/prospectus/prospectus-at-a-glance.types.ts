/**
 * SECTION: Prospectus Page 1 — At a Glance (DATA STAGE 6)
 * WHY: Compose Stage 4A + Stage 2 only; no duplicate formatters or period-return formula
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export interface ProspectusAtAGlanceAudit {
  financingAmount: {
    reusedFromStage4A: true;
  };
  profitRate: {
    reusedFromStage4A: true;
    meaning: "annual_gross_before_fees";
    labelDecision: "corrected_from_canva";
  };
  expectedReturn: {
    reusedFromStage4A: true;
    status: "unresolved";
    formulaDecision: "pending";
  };
  tenure: {
    reusedFromStage2: true;
  };
  minimumInvestment: {
    reusedFromStage4A: true;
    sourceType: "platform_constant";
  };
}

export const PROSPECTUS_AT_A_GLANCE_AUDIT: ProspectusAtAGlanceAudit = {
  financingAmount: {
    reusedFromStage4A: true,
  },
  profitRate: {
    reusedFromStage4A: true,
    meaning: "annual_gross_before_fees",
    labelDecision: "corrected_from_canva",
  },
  expectedReturn: {
    reusedFromStage4A: true,
    status: "unresolved",
    formulaDecision: "pending",
  },
  tenure: {
    reusedFromStage2: true,
  },
  minimumInvestment: {
    reusedFromStage4A: true,
    sourceType: "platform_constant",
  },
};

/** Canva-facing At a Glance fields only. */
export interface ProspectusAtAGlance {
  financingAmount: string;
  profitRate: string;
  expectedReturn: string;
  tenure: string;
  minimumInvestment: string;
  /** Audit/debug only — omitted from Canva HTML. */
  audit: ProspectusAtAGlanceAudit;
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
  canonicalSource: string;
  availability: "stored" | "calculated" | "constant" | "unresolved";
  surface: "canva" | "audit";
  reusedFrom: string;
  notes: string;
}

export const PROSPECTUS_AT_A_GLANCE_FIELD_SOURCES: Record<
  | "financingAmount"
  | "profitRate"
  | "expectedReturn"
  | "tenure"
  | "minimumInvestment",
  ProspectusAtAGlanceFieldSource
> = {
  financingAmount: {
    label: "Financing Amount",
    canonicalSource: "notes.target_amount",
    availability: "stored",
    surface: "canva",
    reusedFrom: "Stage 4A buildProspectusMainFinancialTerms.financingAmount",
    notes: "Same Stage 4A formatter. Not invoice/funded/offered amount. reusedFromStage4A = true.",
  },
  profitRate: {
    label: "Profit Rate (p.a.)",
    canonicalSource: "notes.profit_rate_percent",
    availability: "stored",
    surface: "canva",
    reusedFrom: "Stage 4A buildProspectusMainFinancialTerms.profitRate",
    notes:
      "Annual GROSS before service fees. Canva \"Profit Rate for Investors\" rejected as misleading. labelDecision = corrected_from_canva. Value is percent only (no second \"p.a.\").",
  },
  expectedReturn: {
    label: "Expected Return",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    surface: "canva",
    reusedFrom: "Stage 4A expectedReturnForInvestmentPeriod",
    notes:
      "Singular label (not Canva \"Expected Returns\"). Value remains Data not available. formulaDecision = pending.",
  },
  tenure: {
    label: "Tenure",
    canonicalSource:
      "buildProspectusTenureAndMaturity → calculateCalendarDayCount(opens_at, maturity_date)",
    availability: "calculated",
    surface: "canva",
    reusedFrom: "Stage 2 buildProspectusTenureAndMaturity.tenure",
    notes: "No tenure calculation inside Stage 6. reusedFromStage2 = true.",
  },
  minimumInvestment: {
    label: "Minimum Investment",
    canonicalSource: "MARKETPLACE_MIN_COMMIT_MYR (@cashsouk/types)",
    availability: "constant",
    surface: "canva",
    reusedFrom: "Stage 4A buildProspectusMainFinancialTerms.minimumInvestment",
    notes:
      "Platform constant via Stage 4A. Not hardcoded RM100. Not capacity-adjusted minCommit. sourceType = platform_constant.",
  },
};
