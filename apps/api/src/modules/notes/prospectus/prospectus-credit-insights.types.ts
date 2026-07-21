/**
 * SECTION: Prospectus Page 2 — Credit Insights (DATA STAGE 5)
 * WHY: Officer-selected provisional labels only; never infer from CTOS/CCRIS/litigation
 *
 * Footer / Credit Score Explanation: not shipped — requires legal/compliance approval.
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Static Canva section title — not a database field. */
export const PROSPECTUS_CREDIT_INSIGHTS_SECTION_HEADING = "CREDIT INSIGHTS";

/**
 * Product note: Canva footer about SSM / predictive credit worthiness is not rendered.
 * Footer wording requires legal/compliance approval before shipping.
 */
export const PROSPECTUS_CREDIT_INSIGHTS_FOOTER_REQUIRES_LEGAL_APPROVAL = true;

export interface ProspectusCreditInsightsAudit {
  creditScore: {
    status: "officer_selected";
    candidateSystem: "CTOS";
    rawScoreDisplayAllowed: false;
    autoSelectFromCtosAllowed: false;
    soukScoreReused: false;
  };
  paymentBehaviour: {
    status: "officer_selected";
    candidateSystems: readonly ["CTOS", "CCRIS", "repayment_history"];
    autoSelectAllowed: false;
    issuerOnTimeMetricReused: false;
  };
  creditUtilisation: {
    status: "officer_selected";
    candidateSystem: "CCRIS";
    autoSelectAllowed: false;
    facilityUtilisationSubstitutionAllowed: false;
  };
  litigationCheck: {
    status: "officer_selected";
    candidateSystem: "CTOS_or_legal_report";
    emptyResultMeansClear: false;
    autoSelectAllowed: false;
  };
  ccrisStatus: {
    status: "officer_selected";
    candidateSystem: "CCRIS";
    rawDisclosureAllowed: false;
    autoSelectAllowed: false;
  };
  footer: {
    rendered: false;
    canvaSsmFooterAllowed: false;
    requiresLegalComplianceApproval: true;
  };
  systems: {
    soukScoreMixedWithCreditInsights: false;
    regTankMixedWithCreditInsights: false;
    amlKycMixedWithCreditInsights: false;
  };
  snapshot: {
    sourceType: "officer_selected_credit_insights";
    isFrozen: true;
    snapshotDecision: "freeze_officer_keys_on_approve";
  };
  claims: {
    generatedCreditworthinessClaimAllowed: false;
  };
}

export const PROSPECTUS_CREDIT_INSIGHTS_AUDIT: ProspectusCreditInsightsAudit = {
  creditScore: {
    status: "officer_selected",
    candidateSystem: "CTOS",
    rawScoreDisplayAllowed: false,
    autoSelectFromCtosAllowed: false,
    soukScoreReused: false,
  },
  paymentBehaviour: {
    status: "officer_selected",
    candidateSystems: ["CTOS", "CCRIS", "repayment_history"],
    autoSelectAllowed: false,
    issuerOnTimeMetricReused: false,
  },
  creditUtilisation: {
    status: "officer_selected",
    candidateSystem: "CCRIS",
    autoSelectAllowed: false,
    facilityUtilisationSubstitutionAllowed: false,
  },
  litigationCheck: {
    status: "officer_selected",
    candidateSystem: "CTOS_or_legal_report",
    emptyResultMeansClear: false,
    autoSelectAllowed: false,
  },
  ccrisStatus: {
    status: "officer_selected",
    candidateSystem: "CCRIS",
    rawDisclosureAllowed: false,
    autoSelectAllowed: false,
  },
  footer: {
    rendered: false,
    canvaSsmFooterAllowed: false,
    requiresLegalComplianceApproval: true,
  },
  systems: {
    soukScoreMixedWithCreditInsights: false,
    regTankMixedWithCreditInsights: false,
    amlKycMixedWithCreditInsights: false,
  },
  snapshot: {
    sourceType: "officer_selected_credit_insights",
    isFrozen: true,
    snapshotDecision: "freeze_officer_keys_on_approve",
  },
  claims: {
    generatedCreditworthinessClaimAllowed: false,
  },
};

/** Canva-facing fields only — no Credit Score Explanation, no footer. */
export interface ProspectusCreditInsights {
  sectionHeading: string;
  creditScore: string;
  paymentBehaviour: string;
  creditUtilisation: string;
  litigationCheck: string;
  ccrisStatus: string;
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
   * Officer-selected provisional catalogue keys per row.
   * Production Prisma path leaves this undefined → DNA for unselected Draft rows.
   */
  creditInsightSelections?: Partial<
    Record<
      | "creditScore"
      | "paymentBehaviour"
      | "creditUtilisation"
      | "litigationCheck"
      | "ccrisStatus",
      string
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
  /** Observational Canva SSM sentence — must not become a footer. */
  ssmCreditworthinessSentence?: string | null;
}

export interface ProspectusCreditInsightsFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static" | "stored" | "unresolved";
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
  | "ccrisStatus",
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
    canonicalSource: "page2.creditInsights.creditScoreOptionKey",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "CTOS/FICO; SoukScore — not auto-selected",
    notes: "Officer-selected provisional catalogue. Labels require compliance confirmation.",
  },
  paymentBehaviour: {
    label: "Payment Behaviour",
    canonicalSource: "page2.creditInsights.paymentBehaviourOptionKey",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "CTOS; CCRIS; Page 1 issuer on-time — not auto-selected",
    notes: "Officer-selected provisional catalogue.",
  },
  creditUtilisation: {
    label: "Credit Utilisation",
    canonicalSource: "page2.creditInsights.creditUtilisationOptionKey",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "CCRIS; facility utilisation — not auto-selected",
    notes: "Officer-selected provisional catalogue.",
  },
  litigationCheck: {
    label: "Litigation Check",
    canonicalSource: "page2.creditInsights.litigationCheckOptionKey",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "CTOS legal; empty/zero → Clear — not auto-selected",
    notes: "Officer-selected provisional catalogue. Missing records do not prove Clear.",
  },
  ccrisStatus: {
    label: "CCRIS Status",
    canonicalSource: "page2.creditInsights.ccrisStatusOptionKey",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "raw CCRIS — not auto-selected or disclosed",
    notes: "Officer-selected provisional catalogue.",
  },
};
