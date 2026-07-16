/**
 * SECTION: Build Payment Basis & Shariah Principle view-model
 * WHY: Both fields unresolved — never invent Canva or Tawarruq wording
 */

import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  type ProspectusPaymentBasisShariah,
  type ProspectusPaymentBasisShariahInput,
} from "./prospectus-payment-basis-shariah.types";

export function buildProspectusPaymentBasisShariah(
  _input: ProspectusPaymentBasisShariahInput = {}
): ProspectusPaymentBasisShariah {
  return {
    paymentBasis: PROSPECTUS_DATA_NOT_AVAILABLE,
    shariahPrinciple: PROSPECTUS_DATA_NOT_AVAILABLE,
  };
}
