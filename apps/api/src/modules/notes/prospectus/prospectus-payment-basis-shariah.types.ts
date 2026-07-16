/**
 * SECTION: Prospectus Page 1 — Payment Basis & Shariah Principle (DATA STAGE 4C)
 * WHY: Final Investment Summary rows; both unresolved until a confirmed source exists
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export interface ProspectusPaymentBasisShariah {
  paymentBasis: string;
  shariahPrinciple: string;
}

/**
 * No confirmed raw inputs yet — builder always returns Data not available.
 * Kept for symmetry with other stages and future wiring.
 */
export type ProspectusPaymentBasisShariahInput = Record<string, never>;

export interface ProspectusPaymentBasisShariahFieldSource {
  label: string;
  canonicalSource: string;
  availability: "unresolved";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_PAYMENT_BASIS_SHARIAH_FIELD_SOURCES: Record<
  keyof ProspectusPaymentBasisShariah,
  ProspectusPaymentBasisShariahFieldSource
> = {
  paymentBasis: {
    label: "Payment basis",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives:
      "Infer from note_payment_schedules count/due_date; hardcoded \"Bullet Payment at Maturity\"; product workflow config — not used",
    notes:
      "No payment_basis / repayment_basis field. Schedules are amount rows (sequence, due_date), not a label. Do not infer Bullet from sequence === 1.",
  },
  shariahPrinciple: {
    label: "Shariah principle",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives:
      "Landing \"Shariah Compliant\" marketing; Tawarruq/Shoraka STP workflow; murabaha_amount on STP order; financing_structure (invoice/contract) — not used",
    notes:
      "No shariah_principle field on Product, Note, Application, or snapshots. Tawarruq proves commodity trade ops; it is not the Canva Bai' Al-Dayn Bi Al-Sila' label.",
  },
};
