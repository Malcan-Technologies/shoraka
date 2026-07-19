/**
 * SECTION: Sample Page 2 invoice/work narrative inputs for Stage 6 preview
 * WHY: Supply possible-but-insufficient evidence; builder must still return DNA
 */

import { buildProspectusInvoiceWorkNarrative } from "./prospectus-invoice-work-narrative";
import type {
  ProspectusInvoiceWorkNarrative,
  ProspectusInvoiceWorkNarrativeInput,
} from "./prospectus-invoice-work-narrative.types";

/**
 * Deliberately includes contract/invoice/DOA/trustee/Application observations.
 * None become Canva-facing narrative statements.
 */
export const SAMPLE_PROSPECTUS_INVOICE_WORK_NARRATIVE_INPUT: ProspectusInvoiceWorkNarrativeInput =
  {
    contractSnapshot: {
      title: "Civil Engineering Works Contract",
      description: "Infrastructure works under paymaster award",
      customer: "Sample Paymaster Sdn Bhd",
      contractNumber: "CTR-2024-001",
    },
    invoiceSnapshot: {
      invoiceNumber: "INV-8891",
      faceValue: 3450000,
      maturityDate: "2026-12-31",
    },
    paymasterSnapshot: {
      name: "Sample Paymaster Sdn Bhd",
      entityType: "GOVERNMENT_LINKED",
    },
    supportingDocuments: [{ type: "invoice", filename: "invoice-8891.pdf" }],
    trusteeContext: { workflowStatus: "ready_for_disbursement", trusteeName: "Sample Trustee" },
    applicationWorkDescription:
      "The issuer completed civil engineering and infrastructure work under a contract awarded by the paymaster.",
    invoiceDocument: { filename: "invoice-8891.pdf", uploaded: true },
    invoiceStatus: "APPROVED",
    noteStatus: "PUBLISHED",
    adminApprovalStatus: "APPROVED",
    maturityDate: "2026-12-31",
    productConfigurationText:
      "Payment will be distributed directly by the paymaster to the CashSouk trust account on the invoice due date.",
    doaUploadSlot: { slot: "deed_of_assignment", required: true },
    doaDocument: { filename: "doa-executed.pdf", uploaded: true },
    financingType: "Accounts Receivable Financing-i",
  };

export const SAMPLE_PROSPECTUS_INVOICE_WORK_NARRATIVE: ProspectusInvoiceWorkNarrative =
  buildProspectusInvoiceWorkNarrative(SAMPLE_PROSPECTUS_INVOICE_WORK_NARRATIVE_INPUT);
