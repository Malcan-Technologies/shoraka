/**
 * SECTION: Prospectus Page 1 — Risk Assessment (DATA STAGE 3)
 * WHY: Frozen invoice/Note MARC SME grade + official individual Risk Profile
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Static template text pointing readers to the Page 2 MARC SME scale. */
export const PROSPECTUS_RATING_SCALE_REFERENCE = "See rating scale on page 2";

/** Internal marker: MARC SME-1–10 is the approved Note risk scale. */
export const PROSPECTUS_RATING_SCALE_STATUS = "marc_sme_1_to_10" as const;

export type ProspectusRatingScaleStatus = typeof PROSPECTUS_RATING_SCALE_STATUS;

/** Canva Page 1 risk box only. */
export interface ProspectusRiskAssessmentCanvaFacing {
  riskGrade: string;
  riskLabel: string;
  riskExplanation: string;
  riskGradeColor: string;
  riskGradeTextColor: string;
  ratingScaleReference: string;
  /** Not shown on the Note risk card; Credit Insights keeps org MARC score/PD. */
  marcCreditScoreDisplay: string | null;
  marcProbabilityOfDefaultDisplay: string | null;
}

/** Debug/audit metadata — not rendered in Canva-facing HTML. */
export interface ProspectusRiskAssessmentAudit {
  riskScore: string;
  riskAppliesTo: string;
  assessmentSource: string;
  /** True when a valid MARC SME grade is present from the frozen Note snapshot. */
  isFrozen: boolean;
  scaleStatus: ProspectusRatingScaleStatus;
}

export interface ProspectusRiskAssessment {
  canva: ProspectusRiskAssessmentCanvaFacing;
  audit: ProspectusRiskAssessmentAudit;
}

/** Raw inputs for preview/builder — not Prisma. */
export interface ProspectusRiskAssessmentInput {
  /**
   * notes.invoice_snapshot.offer_details.risk_rating
   * Allowed: SME-1 … SME-10 (isMarcSmeGrade). Letter grades are incomplete.
   */
  soukscoreRiskRating: string | null | undefined;
}

export interface ProspectusRiskAssessmentFieldSource {
  label: string;
  canonicalSource: string;
  availability: "stored" | "static" | "not_stored" | "unresolved";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES = {
  riskGrade: {
    label: "Risk Rating",
    canonicalSource: "notes.invoice_snapshot.offer_details.risk_rating",
    availability: "stored" as const,
    surface: "canva" as const,
    possibleAlternatives: "live invoices.offer_details.risk_rating — not used at publish",
    notes: "MARC SME grades via isMarcSmeGrade. NoteListItem.riskRating.",
  },
  riskLabel: {
    label: "Risk label",
    canonicalSource: "MARC_SME_BANDS grouping label for the SME grade",
    availability: "static" as const,
    surface: "canva" as const,
    possibleAlternatives: "RegTank riskLevel (Low/Medium/High Risk) — different system, not used",
    notes: "CashSouk band label for the frozen Note SME grade; not stored separately.",
  },
  riskExplanation: {
    label: "Risk explanation",
    canonicalSource: "MARC_SCORE_DEFINITIONS[grade].riskProfile",
    availability: "static" as const,
    surface: "canva" as const,
    possibleAlternatives: "NoteListing.risk_disclosure; CashSouk A–F catalogue — not used",
    notes: "Official MARC Risk Profile for the frozen Note SME grade.",
  },
  ratingScaleReference: {
    label: "Rating scale reference",
    canonicalSource: "static prospectus wording",
    availability: "static" as const,
    surface: "canva" as const,
    possibleAlternatives: "none",
    notes: 'Display text only: "See rating scale on page 2".',
  },
  riskScore: {
    label: "Risk score",
    canonicalSource: "none for note prospectus",
    availability: "not_stored" as const,
    surface: "audit" as const,
    possibleAlternatives: "Organization MARC credit score — Credit Insights only",
    notes: "No numerical score on the Note risk card. Audit-only; never Canva-facing.",
  },
  riskAppliesTo: {
    label: "Risk applies to",
    canonicalSource: "invoice offer → frozen on note invoice_snapshot",
    availability: "stored" as const,
    surface: "audit" as const,
    possibleAlternatives: "issuer org MARC assessment — Credit Insights",
    notes: "Audit metadata only. Final Note grade is Invoice.risk_rating.",
  },
  assessmentSource: {
    label: "Assessment source",
    canonicalSource: "Admin send-invoice-offer → offer_details.risk_rating",
    availability: "stored" as const,
    surface: "audit" as const,
    possibleAlternatives: "IssuerOrganization MARC — suggested default only",
    notes: "Audit metadata only. Validated by MARC_SME_GRADES.",
  },
};
