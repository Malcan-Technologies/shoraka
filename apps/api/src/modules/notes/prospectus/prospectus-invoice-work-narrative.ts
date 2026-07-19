/**
 * SECTION: Build Page 2 About the Invoice / Work Performed view-model
 * WHY: Officer-reviewed statements only via typed placeholders; never infer from documents
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

  const statements = input.invoiceWorkStatements;
  const byKey = new Map((statements ?? []).map((s) => [s.key, s] as const));

  const resolve = (key: string): string => {
    if (!statements) return PROSPECTUS_DATA_NOT_AVAILABLE;
    const hit = byKey.get(key);
    if (!hit || !hit.isVisible) return "";
    const text = hit.text.trim();
    return text.length > 0 ? text : PROSPECTUS_DATA_NOT_AVAILABLE;
  };

  return {
    sectionHeading: PROSPECTUS_INVOICE_WORK_NARRATIVE_SECTION_HEADING,
    workUnderContractStatement: resolve("work_under_contract"),
    certificationAcceptanceStatement: resolve("certification_acceptance"),
    paymasterTrustAccountStatement: resolve("paymaster_trust_account"),
    deedOfAssignmentStatement: resolve("deed_of_assignment"),
    omittedStatements: (statements ?? [])
      .filter((s) => !s.isVisible)
      .map((s) => s.key),
    audit: PROSPECTUS_INVOICE_WORK_NARRATIVE_AUDIT,
  };
}
