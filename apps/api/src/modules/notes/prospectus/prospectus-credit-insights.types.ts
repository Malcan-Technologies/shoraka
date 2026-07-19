/**
 * SECTION: Prospectus Page 2 — Credit Insights (DATA STAGE 5)
 * WHY: DNA-first — no approved investor classifiers; do not mix credit/risk systems
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Static Canva section title — not a database field. */
export const PROSPECTUS_CREDIT_INSIGHTS_SECTION_HEADING = "CREDIT INSIGHTS";

export interface ProspectusCreditInsightsAudit {
  creditScore: {
    status: "unresolved";
    candidateSystem: "CTOS";
    rawScoreDisplayAllowed: false;
    classifierDecision: "pending";
    soukScoreReused: false;
  };
  paymentBehaviour: {
    status: "unresolved";
    candidateSystems: readonly ["CTOS", "CCRIS", "repayment_history"];
    classifierDecision: "pending";
    issuerOnTimeMetricReused: false;
  };
  creditUtilisation: {
    status: "unresolved";
    candidateSystem: "CCRIS";
    formulaDecision: "pending";
    facilityUtilisationSubstitutionAllowed: false;
  };
  litigationCheck: {
    status: "unresolved";
    candidateSystem: "CTOS_or_legal_report";
    emptyResultMeansClear: false;
    classifierDecision: "pending";
  };
  ccrisStatus: {
    status: "unresolved";
    candidateSystem: "CCRIS";
    rawDisclosureAllowed: false;
    summaryDecision: "pending";
  };
  creditScoreExplanation: {
    status: "unresolved";
    approvedStaticCopyAvailable: false;
    ssmStatementAllowed: false;
  };
  systems: {
    soukScoreMixedWithCreditInsights: false;
    regTankMixedWithCreditInsights: false;
    amlKycMixedWithCreditInsights: false;
  };
  snapshot: {
    sourceType: "unavailable_investor_credit_classification";
    isFrozen: false;
    snapshotDecision: "pending_legal_and_product_approval";
  };
  claims: {
    generatedCreditworthinessClaimAllowed: false;
  };
}

export const PROSPECTUS_CREDIT_INSIGHTS_AUDIT: ProspectusCreditInsightsAudit = {
  creditScore: {
    status: "unresolved",
    candidateSystem: "CTOS",
    rawScoreDisplayAllowed: false,
    classifierDecision: "pending",
    soukScoreReused: false,
  },
  paymentBehaviour: {
    status: "unresolved",
    candidateSystems: ["CTOS", "CCRIS", "repayment_history"],
    classifierDecision: "pending",
    issuerOnTimeMetricReused: false,
  },
  creditUtilisation: {
    status: "unresolved",
    candidateSystem: "CCRIS",
    formulaDecision: "pending",
    facilityUtilisationSubstitutionAllowed: false,
  },
  litigationCheck: {
    status: "unresolved",
    candidateSystem: "CTOS_or_legal_report",
    emptyResultMeansClear: false,
    classifierDecision: "pending",
  },
  ccrisStatus: {
    status: "unresolved",
    candidateSystem: "CCRIS",
    rawDisclosureAllowed: false,
    summaryDecision: "pending",
  },
  creditScoreExplanation: {
    status: "unresolved",
    approvedStaticCopyAvailable: false,
    ssmStatementAllowed: false,
  },
  systems: {
    soukScoreMixedWithCreditInsights: false,
    regTankMixedWithCreditInsights: false,
    amlKycMixedWithCreditInsights: false,
  },
  snapshot: {
    sourceType: "unavailable_investor_credit_classification",
    isFrozen: false,
    snapshotDecision: "pending_legal_and_product_approval",
  },
  claims: {
    generatedCreditworthinessClaimAllowed: false,
  },
};

/** Canva-facing fields only. */
export interface ProspectusCreditInsights {
  sectionHeading: string;
  creditScore: string;
  paymentBehaviour: string;
  creditUtilisation: string;
  litigationCheck: string;
  ccrisStatus: string;
  creditScoreExplanation: string;
  /** Fields with officer selection `do_not_display` — not rendered. */
  omittedFields: Array<
    | "creditScore"
    | "paymentBehaviour"
    | "creditUtilisation"
    | "litigationCheck"
    | "ccrisStatus"
  >;
  /** Audit/debug only — omitted from Canva HTML. */
  audit: ProspectusCreditInsightsAudit;
}

/**
 * Minimal optional context — observational only.
 * Canva-facing values must not depend on these inputs.
 */
export interface ProspectusCreditInsightsInput {
  /**
   * Optional typed officer/placeholder selections.
   * Production Prisma path leaves this undefined → DNA.
   */
  creditInsightSelections?: Partial<
    Record<
      | "creditScore"
      | "paymentBehaviour"
      | "creditUtilisation"
      | "litigationCheck"
      | "ccrisStatus",
      "positive" | "neutral" | "negative" | "do_not_display"
    >
  >;
  creditContext?: unknown;
  /** Observational CTOS/FICO-like score — must not become Credit Score. */
  ctosScore?: number | null;
  ficoScore?: number | null;
  /** Observational SoukScore — must not become Credit Score. */
  soukScore?: string | null;
  /** Observational Canva-like labels — must not pass through. */
  creditScoreLabel?: string | null;
  paymentBehaviourLabel?: string | null;
  creditUtilisationLabel?: string | null;
  litigationLabel?: string | null;
  ccrisStatusLabel?: string | null;
  /** Observational Page 1 issuer on-time — must not become Payment Behaviour. */
  issuerOnTimePaymentPercent?: number | null;
  /** Observational CCRIS / litigation / facility / onboarding signals. */
  ccrisPaymentData?: unknown;
  facilityUtilisationPercent?: number | null;
  litigationCount?: number | null;
  legalRecords?: unknown;
  ccrisAccountCount?: number | null;
  regTankStatus?: string | null;
  amlStatus?: string | null;
  kycStatus?: string | null;
  /** Observational Canva SSM sentence — must not become explanation. */
  ssmCreditworthinessSentence?: string | null;
}

export interface ProspectusCreditInsightsFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static" | "unresolved";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_CREDIT_INSIGHTS_FIELD_SOURCES: Record<
  | "sectionHeading"
  | "creditScore"
  | "paymentBehaviour"
  | "creditUtilisation"
  | "litigationCheck"
  | "ccrisStatus"
  | "creditScoreExplanation",
  ProspectusCreditInsightsFieldSource
> = {
  sectionHeading: {
    label: "Section heading",
    canonicalSource: "static",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "none",
    notes: "CREDIT INSIGHTS",
  },
  creditScore: {
    label: "Credit Score",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "CTOS/FICO; SoukScore; SSM score — not used",
    notes: "No approved investor classifier. Raw scores not displayed.",
  },
  paymentBehaviour: {
    label: "Payment Behaviour",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "CTOS; CCRIS; Page 1 issuer on-time — not used",
    notes: "No approved investor-facing classifier.",
  },
  creditUtilisation: {
    label: "Credit Utilisation",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "CCRIS; Note/contract facility utilisation — not used",
    notes: "Not interchangeable with facility usage.",
  },
  litigationCheck: {
    label: "Litigation Check",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "CTOS legal; empty/zero → Clear — not used",
    notes: "Missing or zero records do not prove Clear.",
  },
  ccrisStatus: {
    label: "CCRIS Status",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "raw CCRIS counts/balances; No record from zero — not used",
    notes: "No approved summary rule. Raw disclosure forbidden.",
  },
  creditScoreExplanation: {
    label: "Credit Score Explanation",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "Canva SSM creditworthiness sentence — not used",
    notes: "No approved static copy.",
  },
};
