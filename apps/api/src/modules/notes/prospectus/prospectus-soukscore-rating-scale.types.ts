/**
 * SECTION: Prospectus Page 2 — SoukScore Risk Rating Scale (DATA STAGE 7)
 * WHY: Fixed AAA–B scale from frozen Note grade; no Canva A–E, %, or invented labels
 */

import type { SoukscoreRiskRating } from "@cashsouk/types";
import { SOUKSCORE_RISK_RATING_GRADES } from "@cashsouk/types";

export { SOUKSCORE_RISK_RATING_GRADES };
export type { SoukscoreRiskRating };

/** Static Canva section title — not a database field. */
export const PROSPECTUS_SOUKSCORE_RATING_SCALE_SECTION_HEADING = "RISK RATING SCALE";

/** Canonical grade order — reuse shared constant; do not invent a second order. */
export const PROSPECTUS_SOUKSCORE_GRADE_ORDER = SOUKSCORE_RISK_RATING_GRADES;

/**
 * Stable code version for the fixed AAA–B scale structure.
 * Stored on page_2.config_versions.soukscore_scale at Approve.
 */
export const PROSPECTUS_SOUKSCORE_SCALE_VERSION = "2026.07.21.soukscore-scale.v1";

/** Shown once under the scale when the frozen Note grade is missing or invalid. */
export const PROSPECTUS_SOUKSCORE_RATING_NOT_AVAILABLE = "—";

export interface ProspectusSoukscoreGradeItem {
  grade: SoukscoreRiskRating;
  /** Catalogue risk level label (e.g. Moderately Low Risk). */
  label: string;
  /** Catalogue short explanation for this grade. */
  explanation: string;
  isSelected: boolean;
}

export interface ProspectusSoukscoreRatingScaleAudit {
  scale: {
    canonicalSystem: "soukscore";
    gradeOrder: readonly SoukscoreRiskRating[];
    scaleVersion: typeof PROSPECTUS_SOUKSCORE_SCALE_VERSION;
    canvaAtoEScaleRejected: true;
    numericThresholdsAvailable: false;
    creditInsightsDerived: false;
    externalRatingDefinitionsUsed: false;
  };
  selection: {
    source: "notes.invoice_snapshot.offer_details.risk_rating";
    validator: "isSoukscoreRiskRating";
    prospectusEditable: false;
    invalidSelectionDefaultsToGrade: false;
  };
  display: {
    assessmentNoteRendered: false;
    riskLabelsRendered: true;
    definitionsRendered: true;
    generatedLabelsAllowed: false;
  };
  systems: {
    ctosMixed: false;
    ccrisMixed: false;
    regTankMixed: false;
    amlKycMixed: false;
  };
  snapshot: {
    sourceType: "frozen_note_invoice_snapshot";
    isFrozenPerNote: true;
    scaleVersionRecordedAtApprove: true;
  };
  claims: {
    generatedRiskClaimAllowed: false;
  };
}

export const PROSPECTUS_SOUKSCORE_RATING_SCALE_AUDIT: ProspectusSoukscoreRatingScaleAudit = {
  scale: {
    canonicalSystem: "soukscore",
    gradeOrder: PROSPECTUS_SOUKSCORE_GRADE_ORDER,
    scaleVersion: PROSPECTUS_SOUKSCORE_SCALE_VERSION,
    canvaAtoEScaleRejected: true,
    numericThresholdsAvailable: false,
    creditInsightsDerived: false,
    externalRatingDefinitionsUsed: false,
  },
  selection: {
    source: "notes.invoice_snapshot.offer_details.risk_rating",
    validator: "isSoukscoreRiskRating",
    prospectusEditable: false,
    invalidSelectionDefaultsToGrade: false,
  },
  display: {
    assessmentNoteRendered: false,
    riskLabelsRendered: true,
    definitionsRendered: true,
    generatedLabelsAllowed: false,
  },
  systems: {
    ctosMixed: false,
    ccrisMixed: false,
    regTankMixed: false,
    amlKycMixed: false,
  },
  snapshot: {
    sourceType: "frozen_note_invoice_snapshot",
    isFrozenPerNote: true,
    scaleVersionRecordedAtApprove: true,
  },
  claims: {
    generatedRiskClaimAllowed: false,
  },
};

/** Investor-facing scale fields only. */
export interface ProspectusSoukscoreRatingScale {
  sectionHeading: string;
  grades: ProspectusSoukscoreGradeItem[];
  /** Valid frozen grade, or null when missing/invalid. */
  selectedGrade: SoukscoreRiskRating | null;
  /** Single empty-state line when no grade is selected; otherwise null. */
  missingRatingMessage: string | null;
  scaleVersion: typeof PROSPECTUS_SOUKSCORE_SCALE_VERSION;
  /** Audit/debug only — omitted from investor HTML. */
  audit: ProspectusSoukscoreRatingScaleAudit;
}

/**
 * Minimal input — selected Note grade only.
 * Canonical source: notes.invoice_snapshot.offer_details.risk_rating
 */
export interface ProspectusSoukscoreRatingScaleInput {
  selectedRiskRating?: unknown;
}

export interface ProspectusSoukscoreRatingScaleFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static" | "validated" | "omitted";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_SOUKSCORE_RATING_SCALE_FIELD_SOURCES: Record<
  "sectionHeading" | "grades" | "selectedRiskRating" | "assessmentNote" | "riskLabel" | "definition",
  ProspectusSoukscoreRatingScaleFieldSource
> = {
  sectionHeading: {
    label: "Section heading",
    canonicalSource: "static",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "none",
    notes: "RISK RATING SCALE",
  },
  grades: {
    label: "SoukScore grade cells",
    canonicalSource: "SOUKSCORE_RISK_RATING_GRADES",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "Canva A–E — rejected; no A–E mapping",
    notes:
      "Order AAA, AA, A, BBB, BB, B. Full scale shows grade + catalogue label + explanation; selected grade highlighted.",
  },
  riskLabel: {
    label: "Risk Label",
    canonicalSource: "SOUKSCORE_RISK_RATING_CATALOGUE.label",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "none",
    notes: "Per-grade catalogue label rendered on the full scale.",
  },
  definition: {
    label: "Definition",
    canonicalSource: "SOUKSCORE_RISK_RATING_CATALOGUE.explanation",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "none",
    notes: "Per-grade catalogue explanation rendered on the full scale.",
  },

  selectedRiskRating: {
    label: "Selected grade highlight",
    canonicalSource: "notes.invoice_snapshot.offer_details.risk_rating",
    availability: "validated",
    surface: "canva",
    possibleAlternatives: "A-, C–E, AA+, Low Risk, Credit Insights — rejected",
    notes: "Structural isSelected only. Invalid/missing → no selection. Not Prospectus-editable.",
  },
  assessmentNote: {
    label: "Assessment Note",
    canonicalSource: "none",
    availability: "omitted",
    surface: "audit",
    possibleAlternatives: "Canva CashSouk assessment sentence — not used",
    notes: "Removed from investor HTML; no DNA placeholder.",
  },
};
