/**
 * SECTION: Sample Payment Basis & Shariah for Stage 4C preview
 * WHY: Both unresolved — sample proves Data not available, not Canva copy
 */

import { buildProspectusPaymentBasisShariah } from "./prospectus-payment-basis-shariah";
import type {
  ProspectusPaymentBasisShariah,
  ProspectusPaymentBasisShariahInput,
} from "./prospectus-payment-basis-shariah.types";

export const SAMPLE_PROSPECTUS_PAYMENT_BASIS_SHARIAH_INPUT: ProspectusPaymentBasisShariahInput =
  {};

export const SAMPLE_PROSPECTUS_PAYMENT_BASIS_SHARIAH: ProspectusPaymentBasisShariah =
  buildProspectusPaymentBasisShariah(SAMPLE_PROSPECTUS_PAYMENT_BASIS_SHARIAH_INPUT);
