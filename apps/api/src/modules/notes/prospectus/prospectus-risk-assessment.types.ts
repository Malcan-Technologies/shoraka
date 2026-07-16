/**
 * SECTION: Prospectus Page 1 — Risk Assessment (DATA STAGE 3)
 * WHY: Isolate SoukScore grade vs unrelated RegTank/CTOS scores and Canva A–E marketing scale
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Static prospectus link copy (Page 2 scale content is not implemented in product). */
export const PROSPECTUS_RATING_SCALE_REFERENCE = "See rating scale on page 2";

export interface ProspectusRiskAssessment {
  riskGrade: string;
  riskLabel: string;
  riskScore: string;
  riskExplanation: string;
  ratingScaleReference: string;
  riskAppliesTo: string;
  assessmentSource: string;
}

/** Raw inputs for preview/builder — not Prisma. */
export interface ProspectusRiskAssessmentInput {
  /**
   * notes.invoice_snapshot.offer_details.risk_rating
   * Allowed platform grades: AAA | AA | A | BBB | BB | B
   */
  soukscoreRiskRating: string | null | undefined;
}

export interface ProspectusRiskAssessmentFieldSource {
  label: string;
  canonicalSource: string;
  availability: "stored" | "static" | "not_stored" | "unresolved";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES: Record<
  keyof ProspectusRiskAssessment,
  ProspectusRiskAssessmentFieldSource
> = {
  riskGrade: {
    label: "Risk grade",
    canonicalSource: "notes.invoice_snapshot.offer_details.risk_rating",
    availability: "stored",
    possibleAlternatives:
      "live invoices.offer_details.risk_rating; Canva A–E / A- — not used",
    notes:
      "SoukScore grades: AAA, AA, A, BBB, BB, B. Set by admin on invoice offer. Exposed as NoteListItem.riskRating.",
  },
  riskLabel: {
    label: "Risk label",
    canonicalSource: "none",
    availability: "not_stored",
    possibleAlternatives:
      "RegTank riskLevel (Low/Medium/High Risk) on org/person AML — different system, not used",
    notes: "No Low Risk / Very Low mapping from SoukScore grades exists in code.",
  },
  riskScore: {
    label: "Risk score",
    canonicalSource: "none for note prospectus",
    availability: "not_stored",
    possibleAlternatives:
      "RegTank KYC/KYB riskScore; CTOS party riskScore; investor UI prop named riskScore (actually letter grade) — not used",
    notes: "No numerical SoukScore on Note. Do not treat letter grade as a numeric score.",
  },
  riskExplanation: {
    label: "Risk explanation",
    canonicalSource: "none",
    availability: "not_stored",
    possibleAlternatives: "NoteListing.risk_disclosure JSON (unused for this paragraph); Canva copy — not used",
    notes: "No stored prospectus explanation paragraph.",
  },
  ratingScaleReference: {
    label: "Rating scale reference",
    canonicalSource: "static prospectus wording",
    availability: "static",
    possibleAlternatives: "Page 2 Canva A–E scale content — not implemented in product",
    notes: "Link text only. Product filter/badge scale is AAA–B, not A–E.",
  },
  riskAppliesTo: {
    label: "Risk applies to",
    canonicalSource: "invoice offer → frozen on note invoice_snapshot",
    availability: "stored",
    possibleAlternatives: "issuer org AML; paymaster CTOS — different assessments",
    notes: "SoukScore is assigned per invoice offer, then frozen into the Note snapshot.",
  },
  assessmentSource: {
    label: "Assessment source",
    canonicalSource: "Admin send-invoice-offer → offer_details.risk_rating",
    availability: "stored",
    possibleAlternatives: "CTOS; RegTank AML — not SoukScore",
    notes: "Manual admin selection at offer send. Validated by SOUKSCORE_RISK_RATING_GRADES.",
  },
};
