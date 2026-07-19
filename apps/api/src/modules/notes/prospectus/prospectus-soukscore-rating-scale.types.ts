/**
 * SECTION: Prospectus Page 2 — SoukScore Risk Rating Scale (DATA STAGE 7)
 * WHY: Structural AAA–B scale; reject Canva A–E; labels/definitions/note DNA until approved copy
 */

import type { SoukscoreRiskRating } from "@cashsouk/types";
import { SOUKSCORE_RISK_RATING_GRADES } from "@cashsouk/types";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE, SOUKSCORE_RISK_RATING_GRADES };
export type { SoukscoreRiskRating };

/** Static Canva section title — not a database field. */
export const PROSPECTUS_SOUKSCORE_RATING_SCALE_SECTION_HEADING = "RISK RATING SCALE";

/** Canonical grade order — reuse shared constant; do not invent a second order. */
export const PROSPECTUS_SOUKSCORE_GRADE_ORDER = SOUKSCORE_RISK_RATING_GRADES;

export interface ProspectusSoukscoreGradeItem {
  grade: SoukscoreRiskRating;
  riskLabel: string;
  definition: string;
  isSelected: boolean;
}

export interface ProspectusSoukscoreRatingScaleAudit {
  scale: {
    canonicalSystem: "soukscore";
    gradeOrder: readonly SoukscoreRiskRating[];
    canvaAtoEScaleRejected: true;
    numericThresholdsAvailable: false;
    externalRatingDefinitionsUsed: false;
  };
  selection: {
    source: "notes.invoice_snapshot.offer_details.risk_rating";
    validator: "isSoukscoreRiskRating";
    invalidSelectionDefaultsToGrade: false;
  };
  labels: {
    status: "unresolved";
    approvedMappingAvailable: false;
    generatedLabelsAllowed: false;
  };
  definitions: {
    status: "unresolved";
    approvedStaticCopyAvailable: false;
    generatedDefinitionsAllowed: false;
  };
  assessmentNote: {
    status: "unresolved";
    approvedStaticCopyAvailable: false;
  };
  systems: {
    ctosMixed: false;
    ccrisMixed: false;
    regTankMixed: false;
    amlKycMixed: false;
  };
  snapshot: {
    sourceType: "static_future_approved_configuration";
    isFrozenPerNote: false;
    snapshotDecision: "static_versioned_copy_or_config_pending";
  };
  claims: {
    generatedRiskClaimAllowed: false;
  };
}

export const PROSPECTUS_SOUKSCORE_RATING_SCALE_AUDIT: ProspectusSoukscoreRatingScaleAudit = {
  scale: {
    canonicalSystem: "soukscore",
    gradeOrder: PROSPECTUS_SOUKSCORE_GRADE_ORDER,
    canvaAtoEScaleRejected: true,
    numericThresholdsAvailable: false,
    externalRatingDefinitionsUsed: false,
  },
  selection: {
    source: "notes.invoice_snapshot.offer_details.risk_rating",
    validator: "isSoukscoreRiskRating",
    invalidSelectionDefaultsToGrade: false,
  },
  labels: {
    status: "unresolved",
    approvedMappingAvailable: false,
    generatedLabelsAllowed: false,
  },
  definitions: {
    status: "unresolved",
    approvedStaticCopyAvailable: false,
    generatedDefinitionsAllowed: false,
  },
  assessmentNote: {
    status: "unresolved",
    approvedStaticCopyAvailable: false,
  },
  systems: {
    ctosMixed: false,
    ccrisMixed: false,
    regTankMixed: false,
    amlKycMixed: false,
  },
  snapshot: {
    sourceType: "static_future_approved_configuration",
    isFrozenPerNote: false,
    snapshotDecision: "static_versioned_copy_or_config_pending",
  },
  claims: {
    generatedRiskClaimAllowed: false,
  },
};

/** Canva-facing fields only. */
export interface ProspectusSoukscoreRatingScale {
  sectionHeading: string;
  assessmentNote: string;
  grades: ProspectusSoukscoreGradeItem[];
  /** Audit/debug only — omitted from Canva HTML. */
  audit: ProspectusSoukscoreRatingScaleAudit;
}

/**
 * Minimal input — selected Note grade only.
 * Canonical source later: notes.invoice_snapshot.offer_details.risk_rating
 */
export interface ProspectusSoukscoreRatingScaleInput {
  selectedRiskRating?: unknown;
}

export interface ProspectusSoukscoreRatingScaleFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static" | "unresolved" | "validated";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_SOUKSCORE_RATING_SCALE_FIELD_SOURCES: Record<
  "sectionHeading" | "assessmentNote" | "grades" | "selectedRiskRating",
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
  assessmentNote: {
    label: "Assessment Note",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "Canva CashSouk assessment sentence — not used",
    notes: "No approved static copy. Page 1 scaleStatus remains pending_scale_decision.",
  },
  grades: {
    label: "SoukScore grade items",
    canonicalSource: "SOUKSCORE_RISK_RATING_GRADES",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "Canva A–E — rejected; no A–E mapping",
    notes: "Order AAA, AA, A, BBB, BB, B. Labels/definitions DNA until approved config.",
  },
  selectedRiskRating: {
    label: "Selected grade highlight",
    canonicalSource: "notes.invoice_snapshot.offer_details.risk_rating",
    availability: "validated",
    surface: "canva",
    possibleAlternatives: "A-, C–E, AA+, Low Risk — rejected by isSoukscoreRiskRating",
    notes: "Structural isSelected only. Invalid/missing → no selection. No default grade.",
  },
};
