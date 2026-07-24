/**
 * SECTION: Prospectus Page 1 — Return Investor Highlight (DATA STAGE 5C)
 * WHY: Factual annual gross/net + tenure only; no period return or marketing claims
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export const PROSPECTUS_RETURN_CLAIMS_REQUIRING_APPROVAL = [
  "attractive",
  "short-term",
  "earn up to",
  "after fees",
  "guaranteed",
  "projected return wording",
  "factual title generated from rate and tenure",
] as const;

export interface ProspectusReturnHighlightAudit {
  annualGrossProfitRate: {
    source: "notes.profit_rate_percent";
    reusedFrom: "Stage 4A buildProspectusMainFinancialTerms.profitRate";
    meaning: "annual_gross_before_investor_service_fee";
  };
  tenure: {
    reusedFrom: "Stage 2 buildProspectusTenureAndMaturity.tenure";
    prospectusTenureBasis: "opens_at_to_maturity_date";
  };
  annualNetExpectedReturnRate: {
    helper: "computeNetExpectedReturnRatePercent";
    meaning: "annual_net_after_service_fee_on_gross_profit";
    feeAppliesTo: "gross_profit_not_principal";
    formatter: "formatInvestorReturnRatePercent";
    displayDecimals: 1;
  };
  expectedReturnForInvestmentPeriod: {
    sourceStatus: "not_stored";
    formulaDecision: "pending";
    periodReturnDecision: "unresolved";
  };
  dateBasis: {
    prospectusTenureBasis: "opens_at → maturity_date";
    settlementAccrualBasis: "activated_at → profit maturity";
    basesEquivalent: false;
  };
  returnClassification: {
    sourceStatus: "not_stored";
    classificationAllowed: false;
  };
  tenureClassification: {
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
    requiredClaims: typeof PROSPECTUS_RETURN_CLAIMS_REQUIRING_APPROVAL;
  };
}

export const PROSPECTUS_RETURN_HIGHLIGHT_AUDIT_BASE = {
  annualGrossProfitRate: {
    source: "notes.profit_rate_percent" as const,
    reusedFrom: "Stage 4A buildProspectusMainFinancialTerms.profitRate" as const,
    meaning: "annual_gross_before_investor_service_fee" as const,
  },
  tenure: {
    reusedFrom: "Stage 2 buildProspectusTenureAndMaturity.tenure" as const,
    prospectusTenureBasis: "opens_at_to_maturity_date" as const,
  },
  annualNetExpectedReturnRate: {
    helper: "computeNetExpectedReturnRatePercent" as const,
    meaning: "annual_net_after_service_fee_on_gross_profit" as const,
    feeAppliesTo: "gross_profit_not_principal" as const,
    formatter: "formatInvestorReturnRatePercent" as const,
    displayDecimals: 1 as const,
  },
  expectedReturnForInvestmentPeriod: {
    sourceStatus: "not_stored" as const,
    formulaDecision: "pending" as const,
    periodReturnDecision: "unresolved" as const,
  },
  dateBasis: {
    prospectusTenureBasis: "opens_at → maturity_date" as const,
    settlementAccrualBasis: "activated_at → profit maturity" as const,
    basesEquivalent: false as const,
  },
  returnClassification: {
    sourceStatus: "not_stored" as const,
    classificationAllowed: false as const,
  },
  tenureClassification: {
    sourceStatus: "not_stored" as const,
    classificationAllowed: false as const,
  },
  highlightTitle: {
    sourceStatus: "not_stored" as const,
    claimApprovalRequired: true as const,
  },
  highlightExplanation: {
    sourceStatus: "not_stored" as const,
    claimApprovalRequired: true as const,
  },
  claimApproval: {
    status: "pending" as const,
    requiredClaims: PROSPECTUS_RETURN_CLAIMS_REQUIRING_APPROVAL,
  },
} satisfies ProspectusReturnHighlightAudit;

/** Canva-facing highlight fields only. */
export interface ProspectusReturnHighlight {
  annualGrossProfitRate: string;
  tenure: string;
  annualNetExpectedReturnRate: string;
  expectedReturnForInvestmentPeriod: string;
  returnClassification: string;
  tenureClassification: string;
  highlightTitle: string;
  highlightExplanation: string;
  /** Audit/debug only — omitted from Canva HTML. */
  audit: ProspectusReturnHighlightAudit;
}

/** Raw inputs for preview/builder — not Prisma. */
export interface ProspectusReturnHighlightInput {
  /** notes.profit_rate_percent — annual GROSS before service fee */
  profitRatePercent: number | null | undefined;
  /** note_listings.opens_at — for Stage 2 tenure helper */
  listingOpensAt: Date | string | null | undefined;
  /** notes.maturity_date — for Stage 2 tenure helper */
  maturityDate: Date | string | null | undefined;
  /** notes.service_fee_rate_percent — % of gross profit (required for annual net) */
  serviceFeeRatePercent: number | null | undefined;
}

export interface ProspectusReturnHighlightFieldSource {
  label: string;
  canonicalSource: string;
  availability: "stored" | "calculated" | "unresolved";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_RETURN_HIGHLIGHT_FIELD_SOURCES: Record<
  | "annualGrossProfitRate"
  | "tenure"
  | "annualNetExpectedReturnRate"
  | "expectedReturnForInvestmentPeriod"
  | "returnClassification"
  | "tenureClassification"
  | "highlightTitle"
  | "highlightExplanation",
  ProspectusReturnHighlightFieldSource
> = {
  annualGrossProfitRate: {
    label: "Annual Gross Profit Rate",
    canonicalSource:
      "notes.profit_rate_percent via Stage 4A buildProspectusMainFinancialTerms.profitRate",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "live offer rate — not used",
    notes: "Annual GROSS before investor service fees. Same Stage 4A formatter (no duplicated logic).",
  },
  tenure: {
    label: "Tenure",
    canonicalSource: "buildProspectusTenureAndMaturity (Stage 2)",
    availability: "calculated",
    surface: "canva",
    possibleAlternatives: "days remaining; activated_at→maturity — not used",
    notes: "opens_at → maturity_date only.",
  },
  annualNetExpectedReturnRate: {
    label: "Annual Net Expected Return Rate (p.a.)",
    canonicalSource:
      "computeNetExpectedReturnRatePercent(profit_rate_percent, service_fee_rate_percent)",
    availability: "calculated",
    surface: "canva",
    possibleAlternatives:
      "Label gross as after fees (Canva) — incorrect; period return % — not used",
    notes:
      "Annual net after fee on profit. Requires finite gross + fee. Zero fee → net equals gross. Missing fee → DNA (do not silently treat as 0).",
  },
  expectedReturnForInvestmentPeriod: {
    label: "Expected Return (p.a.)",
    canonicalSource:
      "resolveNetExpectedReturnRatePercent(profit_rate_percent, service_fee_rate_percent)",
    availability: "calculated",
    surface: "canva",
    possibleAlternatives: "gross×days/365; settlement RM; Canva 3.95% — not used",
    notes:
      "Same annualised portal net rate as Stage 4A / Admin. Property name is legacy; display label is Expected Return (p.a.).",
  },
  returnClassification: {
    label: "Return Classification",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "Attractive / Competitive thresholds — not used",
    notes: "classificationAllowed = false.",
  },
  tenureClassification: {
    label: "Tenure Classification",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "Short-term / medium / long bands — not used",
    notes: "classificationAllowed = false.",
  },
  highlightTitle: {
    label: "Highlight Title",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "Canva Attractive short-term returns — not used",
    notes: "claimApprovalRequired = true.",
  },
  highlightExplanation: {
    label: "Highlight Explanation",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "Canva earn-up-to after-fees copy — not used",
    notes: "Must not claim after fees using the gross rate, earn up to, attractive, or period return.",
  },
};
