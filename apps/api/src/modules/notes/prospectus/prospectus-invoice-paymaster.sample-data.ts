/**
 * SECTION: Sample Page 2 Invoice & Paymaster inputs for Stage 2 preview
 * WHY: Face value 625000; ignore different target/funded; full entity type; DNA unresolved
 */

import { buildProspectusInvoicePaymaster } from "./prospectus-invoice-paymaster";
import type {
  ProspectusInvoicePaymaster,
  ProspectusInvoicePaymasterInput,
} from "./prospectus-invoice-paymaster.types";

/**
 * Deterministic sample: face value differs from target/funded; DOA upload present
 * but must not become Yes; live invoice maturity differs from Note maturity.
 */
export const SAMPLE_PROSPECTUS_INVOICE_PAYMASTER_INPUT: ProspectusInvoicePaymasterInput = {
  invoiceSnapshot: {
    id: "inv-sample",
    details: {
      value: 625_000,
      number: "INV-SAMPLE-001",
      maturity_date: "2025-08-01T00:00:00.000Z",
    },
    offer_details: {
      risk_rating: "A",
    },
  },
  maturityDate: "2025-09-12T00:00:00.000Z",
  paymasterSnapshot: {
    name: "Kementerian Kerja Raya (KKR)",
    entity_type: "Federal Government Agency",
    ssm_number: "1234567890",
  },
  targetAmount: 500_000,
  fundedAmount: 400_000,
  liveInvoiceMaturityDate: "2025-08-01T00:00:00.000Z",
  supportingDocuments: {
    legal_docs: [
      {
        name: "Deed of Assignment",
        s3_key: "applications/sample/doa.pdf",
      },
    ],
  },
};

export const SAMPLE_PROSPECTUS_INVOICE_PAYMASTER: ProspectusInvoicePaymaster =
  buildProspectusInvoicePaymaster(SAMPLE_PROSPECTUS_INVOICE_PAYMASTER_INPUT);
