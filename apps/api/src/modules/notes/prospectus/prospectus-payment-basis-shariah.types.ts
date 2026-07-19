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
 * Optional observational inputs prove the builder still returns Data not available.
 * Never used to invent payment-basis or Shariah-principle labels.
 */
export interface ProspectusPaymentBasisShariahInput {
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
  availability: "unresolved";
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
    canonicalSource: "none confirmed",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "Infer from note_payment_schedules; Canva \"Bullet Payment at Maturity\"; product config — not used",
    notes:
      "No payment_basis field. Create path often has one maturity schedule, but shape is not an approved label. inferenceAllowed = false.",
  },
  shariahPrinciple: {
    label: "Shariah Principle",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "Canva Bai' Al-Dayn Bi Al-Sila'; Tawarruq; Murabahah; marketing \"Shariah Compliant\" — not used",
    notes:
      "No Product/Note principle field. Tawarruq is operational only (tawarruqUsedAsEvidence = false). Stage 5D reuses this DNA.",
  },
};
