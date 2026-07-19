/**
 * SECTION: Sample Payment Basis & Shariah for Stage 4C preview
 * WHY: Include schedule + Tawarruq-like observations; builder must still return DNA
 */

import { buildProspectusPaymentBasisShariah } from "./prospectus-payment-basis-shariah";
import type {
  ProspectusPaymentBasisShariah,
  ProspectusPaymentBasisShariahInput,
} from "./prospectus-payment-basis-shariah.types";

/**
 * Mirrors common create-from-invoice shape (one maturity schedule) plus operational
 * Tawarruq fields. None of these become Canva-facing labels.
 */
export const SAMPLE_PROSPECTUS_PAYMENT_BASIS_SHARIAH_INPUT: ProspectusPaymentBasisShariahInput =
  {
    maturityDate: "2025-09-12T00:00:00.000Z",
    paymentSchedules: [
      { sequence: 1, dueDate: "2025-09-12T00:00:00.000Z" },
    ],
    tawarruqStatus: "COMPLETED",
    commodityType: "PALM_OIL",
    murabahaAmount: 500_000,
    financingStructure: "invoice",
    marketingShariahCompliantLabel: "Shariah Compliant",
  };

export const SAMPLE_PROSPECTUS_PAYMENT_BASIS_SHARIAH: ProspectusPaymentBasisShariah =
  buildProspectusPaymentBasisShariah(SAMPLE_PROSPECTUS_PAYMENT_BASIS_SHARIAH_INPUT);
