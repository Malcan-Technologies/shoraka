/**
 * SECTION: Prospectus Page 1 — Risk Assessment (DATA STAGE 3)
 * WHY: SoukScore grade + shared catalogue label/explanation; Page 2 scale reference
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Static template text pointing readers to the Page 2 Cashsouk Risk Rating scale. */
export const PROSPECTUS_RATING_SCALE_REFERENCE = "See rating scale on page 2";

/** Internal marker: A–F catalogue is the approved Cashsouk scale. */
export const PROSPECTUS_RATING_SCALE_STATUS = "cashsouk_a_to_f" as const;

export type ProspectusRatingScaleStatus = typeof PROSPECTUS_RATING_SCALE_STATUS;

/** Canva Page 1 risk box only. */
export interface ProspectusRiskAssessmentCanvaFacing {
  riskGrade: string;
  riskLabel: string;
  riskExplanation: string;
  riskGradeColor: string;
  riskGradeTextColor: string;
  ratingScaleReference: string;
}

/** Debug/audit metadata — not rendered in Canva-facing HTML. */
export interface ProspectusRiskAssessmentAudit {
  /** Always — — no numerical SoukScore on Note. */
  riskScore: string;
  riskAppliesTo: string;
  assessmentSource: string;
  /** True when a valid grade is present from the frozen Note snapshot. */
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
   * Allowed: A | B | C | D | E | F (isCashsoukRiskGrade)
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
    possibleAlternatives:
      "live invoices.offer_details.risk_rating; Canva A– / A–E — not used",
    notes:
      "Cashsouk grades A–F via isCashsoukRiskGrade. NoteListItem.riskRating.",
  },
  riskLabel: {
    label: "Risk label",
    canonicalSource: "CASHSCOUK_RISK_RATING_CATALOGUE[grade].label",
    availability: "static" as const,
    surface: "canva" as const,
    possibleAlternatives:
      "RegTank riskLevel (Low/Medium/High Risk) — different system, not used",
    notes:
      "Resolved from grade via shared catalogue; not stored separately on Note.",
  },
  riskExplanation: {
    label: "Risk explanation",
    canonicalSource: "SOUKSCORE_RISK_RATING_CATALOGUE[grade].explanation",
    availability: "static" as const,
    surface: "canva" as const,
    possibleAlternatives: "NoteListing.risk_disclosure; Canva sample narrative — not used",
    notes:
      "Resolved from grade via shared catalogue; not stored separately on Note.",
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
    possibleAlternatives: "RegTank/CTOS numerical scores — not used",
    notes: "No numerical SoukScore on Note. Audit-only; never Canva-facing.",
  },
  riskAppliesTo: {
    label: "Risk applies to",
    canonicalSource: "invoice offer → frozen on note invoice_snapshot",
    availability: "stored" as const,
    surface: "audit" as const,
    possibleAlternatives: "issuer org AML; paymaster CTOS — different assessments",
    notes: "Audit metadata only.",
  },
  assessmentSource: {
    label: "Assessment source",
    canonicalSource: "Admin send-invoice-offer → offer_details.risk_rating",
    availability: "stored" as const,
    surface: "audit" as const,
    possibleAlternatives: "CTOS; RegTank AML — not SoukScore",
    notes: "Audit metadata only. Validated by SOUKSCORE_RISK_RATING_GRADES.",
  },
};
