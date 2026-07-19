/**
 * SECTION: Build Page 2 About the Invoice / Work Performed view-model
 * WHY: Always Data not available — no automatic legal/factual inference from evidence presence
 */

import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_INVOICE_WORK_NARRATIVE_AUDIT,
  PROSPECTUS_INVOICE_WORK_NARRATIVE_SECTION_HEADING,
  type ProspectusInvoiceWorkNarrative,
  type ProspectusInvoiceWorkNarrativeInput,
} from "./prospectus-invoice-work-narrative.types";

export function buildProspectusInvoiceWorkNarrative(
  input: ProspectusInvoiceWorkNarrativeInput = {}
): ProspectusInvoiceWorkNarrative {
  // Observational only — prove insufficient evidence never becomes Canva narrative.
  void input.contractSnapshot;
  void input.invoiceSnapshot;
  void input.paymasterSnapshot;
  void input.supportingDocuments;
  void input.trusteeContext;
  void input.applicationWorkDescription;
  void input.invoiceDocument;
  void input.invoiceStatus;
  void input.noteStatus;
  void input.adminApprovalStatus;
  void input.maturityDate;
  void input.productConfigurationText;
  void input.doaUploadSlot;
  void input.doaDocument;
  void input.financingType;

  return {
    sectionHeading: PROSPECTUS_INVOICE_WORK_NARRATIVE_SECTION_HEADING,
    workUnderContractStatement: PROSPECTUS_DATA_NOT_AVAILABLE,
    certificationAcceptanceStatement: PROSPECTUS_DATA_NOT_AVAILABLE,
    paymasterTrustAccountStatement: PROSPECTUS_DATA_NOT_AVAILABLE,
    deedOfAssignmentStatement: PROSPECTUS_DATA_NOT_AVAILABLE,
    audit: PROSPECTUS_INVOICE_WORK_NARRATIVE_AUDIT,
  };
}
