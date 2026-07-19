import { buildProspectusInvoiceWorkNarrative } from "./prospectus-invoice-work-narrative";
import { SAMPLE_PROSPECTUS_INVOICE_WORK_NARRATIVE_INPUT } from "./prospectus-invoice-work-narrative.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_INVOICE_WORK_NARRATIVE_FIELD_SOURCES,
  PROSPECTUS_INVOICE_WORK_NARRATIVE_SECTION_HEADING,
} from "./prospectus-invoice-work-narrative.types";
import { buildProspectusInvoiceWorkNarrativeDocument } from "./render-prospectus-invoice-work-narrative";

function narrativeStatements(data: ReturnType<typeof buildProspectusInvoiceWorkNarrative>) {
  return [
    data.workUnderContractStatement,
    data.certificationAcceptanceStatement,
    data.paymasterTrustAccountStatement,
    data.deedOfAssignmentStatement,
  ].join("\n");
}

describe("prospectus Page 2 About the Invoice / Work Performed (DATA STAGE 6)", () => {
  it("uses static section heading", () => {
    const data = buildProspectusInvoiceWorkNarrative(
      SAMPLE_PROSPECTUS_INVOICE_WORK_NARRATIVE_INPUT
    );
    expect(data.sectionHeading).toBe("ABOUT THE INVOICE / WORK PERFORMED");
    expect(data.sectionHeading).toBe(PROSPECTUS_INVOICE_WORK_NARRATIVE_SECTION_HEADING);
  });

  it("returns DNA for all four statements even when insufficient evidence is supplied", () => {
    const data = buildProspectusInvoiceWorkNarrative(
      SAMPLE_PROSPECTUS_INVOICE_WORK_NARRATIVE_INPUT
    );
    expect(data.workUnderContractStatement).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.certificationAcceptanceStatement).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.paymasterTrustAccountStatement).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.deedOfAssignmentStatement).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("does not create work-under-contract claim from contract snapshot or Application text", () => {
    const data = buildProspectusInvoiceWorkNarrative({
      contractSnapshot: {
        title: "Civil Engineering Works Contract",
        description: "Infrastructure works",
        customer: "Sample Paymaster Sdn Bhd",
      },
      applicationWorkDescription:
        "The issuer completed civil engineering and infrastructure work under a contract awarded by the paymaster.",
    });
    expect(data.workUnderContractStatement).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit.workUnderContract.inferenceAllowed).toBe(false);
    expect(data.audit.workUnderContract.workCompletionEvidenceRequired).toBe(true);
  });

  it("does not prove certification from invoice document or approved statuses", () => {
    const data = buildProspectusInvoiceWorkNarrative({
      invoiceDocument: { filename: "invoice-8891.pdf", uploaded: true },
      invoiceStatus: "APPROVED",
      noteStatus: "PUBLISHED",
      adminApprovalStatus: "APPROVED",
      paymasterSnapshot: { name: "Sample Paymaster Sdn Bhd" },
    });
    expect(data.certificationAcceptanceStatement).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit.certificationAcceptance.inferenceAllowed).toBe(false);
    expect(data.audit.certificationAcceptance.certificationEvidenceRequired).toBe(true);
    expect(data.audit.certificationAcceptance.paymasterAcceptanceEvidenceRequired).toBe(true);
  });

  it("does not create trust-account claim from trustee workflow, maturity, or product config", () => {
    const data = buildProspectusInvoiceWorkNarrative({
      trusteeContext: { workflowStatus: "ready_for_disbursement" },
      maturityDate: "2026-12-31",
      productConfigurationText:
        "Payment will be distributed directly by the paymaster to the CashSouk trust account on the invoice due date.",
    });
    expect(data.paymasterTrustAccountStatement).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit.paymasterTrustAccount.inferenceAllowed).toBe(false);
    expect(data.audit.paymasterTrustAccount.dueDatePromiseAllowed).toBe(false);
    expect(data.audit.paymasterTrustAccount.legalPaymentInstructionRequired).toBe(true);
  });

  it("does not prove DOA from upload slot, file, or financing type", () => {
    const data = buildProspectusInvoiceWorkNarrative({
      doaUploadSlot: { slot: "deed_of_assignment", required: true },
      doaDocument: { filename: "doa-executed.pdf", uploaded: true },
      financingType: "Accounts Receivable Financing-i",
    });
    expect(data.deedOfAssignmentStatement).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit.deedOfAssignment.uploadSlotOrDocumentIsProof).toBe(false);
    expect(data.audit.deedOfAssignment.executedStatusRequired).toBe(true);
    expect(data.audit.deedOfAssignment.verificationRequired).toBe(true);
  });

  it("does not generate Canva claim wording in narrative statement values", () => {
    const data = buildProspectusInvoiceWorkNarrative(
      SAMPLE_PROSPECTUS_INVOICE_WORK_NARRATIVE_INPUT
    );
    const statements = narrativeStatements(data);

    expect(statements).not.toMatch(/completed civil engineering and infrastructure work/i);
    expect(statements).not.toMatch(/certified and accepted/i);
    expect(statements).not.toMatch(/distributed directly by paymaster/i);
    expect(statements).not.toMatch(/CashSouk trust account on the invoice due date/i);
    expect(statements).not.toMatch(/assigned to CashSouk as security/i);
    expect(statements).not.toMatch(/Deed of Assignment/);
    expect(statements).toBe(
      [
        PROSPECTUS_DATA_NOT_AVAILABLE,
        PROSPECTUS_DATA_NOT_AVAILABLE,
        PROSPECTUS_DATA_NOT_AVAILABLE,
        PROSPECTUS_DATA_NOT_AVAILABLE,
      ].join("\n")
    );
  });

  it("does not generate negative inference wording", () => {
    const data = buildProspectusInvoiceWorkNarrative(
      SAMPLE_PROSPECTUS_INVOICE_WORK_NARRATIVE_INPUT
    );
    const statements = narrativeStatements(data);
    const html = buildProspectusInvoiceWorkNarrativeDocument(data);

    for (const text of [statements, html]) {
      expect(text).not.toMatch(/No DOA/i);
      expect(text).not.toMatch(/Not certified/i);
      expect(text).not.toMatch(/Not accepted/i);
      expect(text).not.toMatch(/No assignment/i);
      expect(text).not.toMatch(/Payment not guaranteed/i);
    }
  });

  it("does not generate positive legal or factual claims", () => {
    const data = buildProspectusInvoiceWorkNarrative(
      SAMPLE_PROSPECTUS_INVOICE_WORK_NARRATIVE_INPUT
    );
    const statements = narrativeStatements(data);
    const html = buildProspectusInvoiceWorkNarrativeDocument(data);

    for (const text of [statements, html]) {
      expect(text).not.toMatch(/legally assigned/i);
      expect(text).not.toMatch(/verified work/i);
      expect(text).not.toMatch(/confirmed payment/i);
      expect(text).not.toMatch(/guaranteed payment/i);
      expect(text).not.toMatch(/accepted invoice/i);
    }

    expect(data.audit.claims.generatedLegalClaimAllowed).toBe(false);
    expect(data.audit.claims.generatedFactualClaimAllowed).toBe(false);
    expect(data.audit.claims.adminApprovedFrozenTextPreferred).toBe(true);
  });

  it("HTML shows exactly approved labels and hides audit/evidence fields", () => {
    const data = buildProspectusInvoiceWorkNarrative(
      SAMPLE_PROSPECTUS_INVOICE_WORK_NARRATIVE_INPUT
    );
    const html = buildProspectusInvoiceWorkNarrativeDocument(data);

    expect(html).toContain("ABOUT THE INVOICE / WORK PERFORMED");
    expect(html).toContain("Work Under Contract Statement:");
    expect(html).toContain("Certification and Acceptance Statement:");
    expect(html).toContain("Paymaster-to-Trust-Account Statement:");
    expect(html).toContain("Deed of Assignment Statement:");

    expect(html).not.toContain("CTR-2024-001");
    expect(html).not.toContain("INV-8891");
    expect(html).not.toContain("invoice-8891.pdf");
    expect(html).not.toContain("doa-executed.pdf");
    expect(html).not.toContain("ready_for_disbursement");
    expect(html).not.toContain("Sample Trustee");

    expect(html).not.toContain("workCompletionEvidenceRequired");
    expect(html).not.toContain("certificationEvidenceRequired");
    expect(html).not.toContain("legalPaymentInstructionRequired");
    expect(html).not.toContain("executedStatusRequired");
    expect(html).not.toContain("inferenceAllowed");
    expect(html).not.toContain("snapshotDecision");
    expect(html).not.toContain('"audit"');

    expect(html).toContain(`Work Under Contract Statement: ${PROSPECTUS_DATA_NOT_AVAILABLE}`);
    expect(html).toContain(
      `Certification and Acceptance Statement: ${PROSPECTUS_DATA_NOT_AVAILABLE}`
    );
    expect(html).toContain(
      `Paymaster-to-Trust-Account Statement: ${PROSPECTUS_DATA_NOT_AVAILABLE}`
    );
    expect(html).toContain(`Deed of Assignment Statement: ${PROSPECTUS_DATA_NOT_AVAILABLE}`);
  });

  it("documents unresolved field sources", () => {
    expect(
      PROSPECTUS_INVOICE_WORK_NARRATIVE_FIELD_SOURCES.workUnderContractStatement.availability
    ).toBe("unresolved");
    expect(
      PROSPECTUS_INVOICE_WORK_NARRATIVE_FIELD_SOURCES.certificationAcceptanceStatement
        .availability
    ).toBe("unresolved");
    expect(
      PROSPECTUS_INVOICE_WORK_NARRATIVE_FIELD_SOURCES.paymasterTrustAccountStatement.availability
    ).toBe("unresolved");
    expect(
      PROSPECTUS_INVOICE_WORK_NARRATIVE_FIELD_SOURCES.deedOfAssignmentStatement.availability
    ).toBe("unresolved");
  });
});
