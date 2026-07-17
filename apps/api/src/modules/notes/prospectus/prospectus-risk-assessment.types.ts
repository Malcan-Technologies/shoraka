/**
 * SECTION: Prospectus Page 1 — Risk Assessment (DATA STAGE 3)
 * WHY: SoukScore grade only for Canva; no A-/Low Risk/RegTank/CTOS; Page 2 scale pending
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Static template link — Page 2 scale not yet approved for SoukScore AAA–B. */
export const PROSPECTUS_RATING_SCALE_REFERENCE = "See rating scale on page 2";

/** Internal marker: do not ship as final until Page 2 uses an approved scale. */
export const PROSPECTUS_RATING_SCALE_STATUS = "pending_scale_decision" as const;

export type ProspectusRatingScaleStatus = typeof PROSPECTUS_RATING_SCALE_STATUS;

/** Canva Page 1 risk box only. */
export interface ProspectusRiskAssessmentCanvaFacing {
  riskGrade: string;
  riskLabel: string;
  riskExplanation: string;
  ratingScaleReference: string;
}

/** Debug/audit metadata — not rendered in Canva-facing HTML. */
export interface ProspectusRiskAssessmentAudit {
  /** Always Data not available — no numerical SoukScore on Note. */
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
   * Allowed: AAA | AA | A | BBB | BB | B (isSoukscoreRiskRating)
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
      "SoukScore: AAA, AA, A, BBB, BB, B via isSoukscoreRiskRating. NoteListItem.riskRating.",
  },
  riskLabel: {
    label: "Risk label",
    canonicalSource: "none",
    availability: "not_stored" as const,
    surface: "canva" as const,
    possibleAlternatives:
      "RegTank riskLevel (Low/Medium/High Risk) — different system, not used",
    notes: "No approved SoukScore-to-label mapping. Do not derive Low Risk.",
  },
  riskExplanation: {
    label: "Risk explanation",
    canonicalSource: "none",
    availability: "not_stored" as const,
    surface: "canva" as const,
    possibleAlternatives: "NoteListing.risk_disclosure; Canva sample narrative — not used",
    notes: "No stored Note-level explanation. Do not generate from FS/paymaster/CTOS.",
  },
  ratingScaleReference: {
    label: "Rating scale reference",
    canonicalSource: "static prospectus wording",
    availability: "static" as const,
    surface: "canva" as const,
    possibleAlternatives: "Page 2 Canva A–E scale — incompatible with SoukScore until corrected",
    notes:
      "Display text only. audit.scaleStatus = pending_scale_decision until Page 2 is approved.",
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
