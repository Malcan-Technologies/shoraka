/**
 * SECTION: Prospectus Page 1 — Payment Basis & Shariah Principle (DATA STAGE 4C)
 * WHY: Both unresolved; schedule shape and Tawarruq ops must not invent Canva labels
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export type ProspectusScheduleShapeObserved =
  | "none"
  | "single_maturity_schedule"
  | "multiple_schedules"
  | "other_schedule_shape"
  | "not_provided";

export interface ProspectusPaymentBasisAudit {
  sourceStatus: "not_stored";
  inferenceAllowed: false;
  scheduleShapeObserved: ProspectusScheduleShapeObserved;
  businessDecision: "pending";
  snapshotStatus: "not_available";
}

export interface ProspectusShariahPrincipleAudit {
  sourceStatus: "not_stored";
  inferenceAllowed: false;
  tawarruqUsedAsEvidence: false;
  legalDecision: "pending";
  adviserApprovalReference: "unavailable";
  snapshotStatus: "not_available";
}

/**
 * Flat Canva-facing fields kept at root so Stage 5D can reuse shariahPrinciple.
 */
export interface ProspectusPaymentBasisShariah {
  paymentBasis: string;
  shariahPrinciple: string;
  /** Audit/debug only — omitted from Canva HTML. */
  audit: {
    paymentBasis: ProspectusPaymentBasisAudit;
    shariahPrinciple: ProspectusShariahPrincipleAudit;
  };
}

/**
 * Observational inputs must not invent alternate payment/Shariah labels.
 * Canva values come from shared fixed constants, or frozen historical template wording.
 */
export interface ProspectusPaymentBasisShariahInput {
  /**
   * Optional override (historical frozen publication wording).
   * When omitted, builder uses PROSPECTUS_FIXED_PAYMENT_BASIS / PROSPECTUS_FIXED_SHARIAH_PRINCIPLE.
   */
  paymentBasisTemplate?: {
    paymentBasis: string;
    shariahPrinciple: string;
    sourceType: "fixed_template";
    approvedProductionCopy: boolean;
  };
  paymentSchedules?: Array<{
    sequence?: number | null;
    dueDate?: Date | string | null;
  }>;
  maturityDate?: Date | string | null;
  tawarruqStatus?: string | null;
  commodityType?: string | null;
  murabahaAmount?: number | null;
  financingStructure?: string | null;
  /** Landing/marketing badge — must not become the principle. */
  marketingShariahCompliantLabel?: string | null;
}

export interface ProspectusPaymentBasisShariahFieldSource {
  label: string;
  canonicalSource: string;
  availability: "fixed_template" | "unresolved";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_PAYMENT_BASIS_SHARIAH_FIELD_SOURCES: Record<
  "paymentBasis" | "shariahPrinciple",
  ProspectusPaymentBasisShariahFieldSource
> = {
  paymentBasis: {
    label: "Payment Basis",
    canonicalSource: "PROSPECTUS_FIXED_PAYMENT_BASIS (@cashsouk/types)",
    availability: "fixed_template",
    surface: "canva",
    possibleAlternatives:
      "Infer from note_payment_schedules; product config; officer catalogue — not used",
    notes:
      "Fixed for all Notes. Historical frozen paymentBasisTemplate may override. inferenceAllowed = false.",
  },
  shariahPrinciple: {
    label: "Shariah Principle",
    canonicalSource: "PROSPECTUS_FIXED_SHARIAH_PRINCIPLE (@cashsouk/types)",
    availability: "fixed_template",
    surface: "canva",
    possibleAlternatives:
      "Tawarruq; Murabahah; marketing \"Shariah Compliant\"; officer catalogue — not used",
    notes:
      "Fixed for all Notes. Stage 5D reuses this value. Historical frozen template may override. tawarruqUsedAsEvidence = false.",
  },
};
