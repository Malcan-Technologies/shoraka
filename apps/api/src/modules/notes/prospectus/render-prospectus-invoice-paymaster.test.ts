import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatProspectusMoneyMyr } from "./prospectus-main-financial-terms";
import { buildProspectusInvoicePaymaster } from "./prospectus-invoice-paymaster";
import { SAMPLE_PROSPECTUS_INVOICE_PAYMASTER_INPUT } from "./prospectus-invoice-paymaster.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_INVOICE_PAYMASTER_FIELD_SOURCES,
  PROSPECTUS_INVOICE_PAYMASTER_SECTION_HEADING,
} from "./prospectus-invoice-paymaster.types";
import { buildProspectusInvoicePaymasterDocument } from "./render-prospectus-invoice-paymaster";

describe("prospectus Page 2 Invoice & Paymaster Information (DATA STAGE 2)", () => {
  it("uses static section heading", () => {
    const data = buildProspectusInvoicePaymaster(SAMPLE_PROSPECTUS_INVOICE_PAYMASTER_INPUT);
    expect(data.sectionHeading).toBe("INVOICE & PAYMASTER INFORMATION");
    expect(data.sectionHeading).toBe(PROSPECTUS_INVOICE_PAYMASTER_SECTION_HEADING);
  });

  it("formats invoice face value from invoice_snapshot.details.value", () => {
    const data = buildProspectusInvoicePaymaster({
      invoiceSnapshot: { details: { value: 625_000 } },
      maturityDate: null,
      paymasterSnapshot: null,
    });
    expect(data.invoiceAmount).toBe("RM 625,000.00");
    expect(formatProspectusMoneyMyr(625_000)).toBe("RM 625,000.00");
  });

  it("does not use target_amount or funded_amount for Invoice Amount", () => {
    const data = buildProspectusInvoicePaymaster({
      invoiceSnapshot: { details: { value: 625_000 } },
      targetAmount: 999_999,
      fundedAmount: 111_111,
      maturityDate: "2025-09-12T00:00:00.000Z",
      paymasterSnapshot: { name: "KKR", entity_type: "Federal Government Agency" },
    });
    expect(data.invoiceAmount).toBe("RM 625,000.00");
    expect(data.invoiceAmount).not.toContain("999");
    expect(data.invoiceAmount).not.toContain("111");
  });

  it("returns — for missing or invalid invoice amount", () => {
    expect(
      buildProspectusInvoicePaymaster({
        invoiceSnapshot: { details: {} },
        maturityDate: null,
      }).invoiceAmount
    ).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);

    expect(
      buildProspectusInvoicePaymaster({
        invoiceSnapshot: { details: { value: "not-a-number" } },
        maturityDate: null,
      }).invoiceAmount
    ).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);

    expect(
      buildProspectusInvoicePaymaster({
        invoiceSnapshot: { details: { invoice_value: 625_000 } },
        maturityDate: null,
      }).invoiceAmount
    ).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("uses full money formatting and rejects compact money", () => {
    const data = buildProspectusInvoicePaymaster(SAMPLE_PROSPECTUS_INVOICE_PAYMASTER_INPUT);
    expect(data.invoiceAmount).toBe("RM 625,000.00");
    expect(data.invoiceAmount).not.toMatch(/mil|million|625k|625K/);

    const moduleSource = readFileSync(
      join(__dirname, "prospectus-invoice-paymaster.ts"),
      "utf8"
    );
    expect(moduleSource).toContain("formatProspectusMoneyMyr");
    expect(moduleSource).not.toMatch(/formatCompact|compactMoney|mil\b/i);
  });

  it("formats Invoice Due Date from frozen invoice_snapshot.details.maturity_date", () => {
    const data = buildProspectusInvoicePaymaster({
      invoiceSnapshot: { details: { value: 1, maturity_date: "2025-09-12T00:00:00.000Z" } },
      maturityDate: "2026-11-18T00:00:00.000Z",
      paymasterSnapshot: null,
    });
    expect(data.invoiceDueDate).toBe("12 September 2025");
  });

  it("returns DNA when snapshot due is missing and does not use note or live maturity", () => {
    const missing = buildProspectusInvoicePaymaster({
      invoiceSnapshot: {
        details: { value: 625_000 },
      },
      maturityDate: "2025-09-12T00:00:00.000Z",
      liveInvoiceMaturityDate: "2025-08-01T00:00:00.000Z",
      paymasterSnapshot: null,
    });
    expect(missing.invoiceDueDate).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("maps paymaster name and full entity type from snapshot", () => {
    const data = buildProspectusInvoicePaymaster({
      invoiceSnapshot: { details: { value: 100 } },
      maturityDate: "2025-09-12T00:00:00.000Z",
      paymasterSnapshot: {
        name: "Kementerian Kerja Raya (KKR)",
        entity_type: "Federal Government Agency",
      },
    });
    expect(data.paymasterName).toBe("Kementerian Kerja Raya (KKR)");
    expect(data.paymasterNature).toBe("Federal Government Agency");
    expect(data.paymasterNature).not.toBe("Government");
  });

  it("returns DNA for missing paymaster name and nature", () => {
    const data = buildProspectusInvoicePaymaster({
      invoiceSnapshot: { details: { value: 100 } },
      maturityDate: "2025-09-12T00:00:00.000Z",
      paymasterSnapshot: {},
    });
    expect(data.paymasterName).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.paymasterNature).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("keeps DOA, Paymaster Rating, and Confidence Grading as DNA without officer content", () => {
    const data = buildProspectusInvoicePaymaster(SAMPLE_PROSPECTUS_INVOICE_PAYMASTER_INPUT);
    expect(data.deedOfAssignment).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.paymasterRating).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.confidenceGrading).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("uses officer-selected DOA, Paymaster Rating, and Confidence Grading", () => {
    const data = buildProspectusInvoicePaymaster({
      ...SAMPLE_PROSPECTUS_INVOICE_PAYMASTER_INPUT,
      officerDeedOfAssignment: "Yes",
      officerPaymasterRating: "PM2",
      officerConfidenceGrading: "Medium",
    });
    expect(data.deedOfAssignment).toBe("Yes");
    expect(data.paymasterRating).toBe("PM2");
    expect(data.confidenceGrading).toBe("Medium");
  });

  it("does not infer DOA Yes from uploaded supporting documents", () => {
    const data = buildProspectusInvoicePaymaster({
      invoiceSnapshot: { details: { value: 625_000 } },
      maturityDate: "2025-09-12T00:00:00.000Z",
      paymasterSnapshot: { name: "KKR", entity_type: "Federal Government Agency" },
      supportingDocuments: {
        legal_docs: [{ name: "Deed of Assignment", s3_key: "doa.pdf" }],
      },
    });
    expect(data.deedOfAssignment).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("documents canonical sources including officer Invoice & Paymaster fields", () => {
    expect(PROSPECTUS_INVOICE_PAYMASTER_FIELD_SOURCES.invoiceAmount.canonicalSource).toBe(
      "notes.invoice_snapshot.details.value"
    );
    expect(PROSPECTUS_INVOICE_PAYMASTER_FIELD_SOURCES.invoiceDueDate.canonicalSource).toBe(
      "notes.invoice_snapshot.details.maturity_date"
    );
    expect(PROSPECTUS_INVOICE_PAYMASTER_FIELD_SOURCES.paymasterName.canonicalSource).toBe(
      "notes.paymaster_snapshot.name"
    );
    expect(PROSPECTUS_INVOICE_PAYMASTER_FIELD_SOURCES.paymasterNature.canonicalSource).toBe(
      "notes.paymaster_snapshot.entity_type"
    );
    expect(PROSPECTUS_INVOICE_PAYMASTER_FIELD_SOURCES.deedOfAssignment.canonicalSource).toBe(
      "prospectus_review.page2.invoicePaymaster.deedOfAssignment"
    );
    expect(PROSPECTUS_INVOICE_PAYMASTER_FIELD_SOURCES.paymasterRating.canonicalSource).toBe(
      "prospectus_review.page2.invoicePaymaster.paymasterRating"
    );
    expect(PROSPECTUS_INVOICE_PAYMASTER_FIELD_SOURCES.confidenceGrading.canonicalSource).toBe(
      "prospectus_review.page2.invoicePaymaster.confidenceGrading"
    );
    expect(PROSPECTUS_INVOICE_PAYMASTER_FIELD_SOURCES.deedOfAssignment.availability).toBe(
      "stored"
    );
    expect(PROSPECTUS_INVOICE_PAYMASTER_FIELD_SOURCES.paymasterRating.availability).toBe(
      "stored"
    );
    expect(PROSPECTUS_INVOICE_PAYMASTER_FIELD_SOURCES.confidenceGrading.availability).toBe(
      "stored"
    );
  });

  it("HTML shows exactly seven labels plus heading and hides audit/extra money fields", () => {
    const data = buildProspectusInvoicePaymaster(SAMPLE_PROSPECTUS_INVOICE_PAYMASTER_INPUT);
    const html = buildProspectusInvoicePaymasterDocument(data);

    expect(data.sectionHeading).toBe("INVOICE & PAYMASTER INFORMATION");
    expect(html).toContain("INVOICE &amp; PAYMASTER INFORMATION");
    expect(html).toContain("Invoice Amount:");
    expect(html).toContain("Invoice Due Date:");
    expect(html).toContain("Paymaster:");
    expect(html).toContain("Nature of Paymaster");
    expect(html).toContain("Deed of Assignment (DOA)");
    expect(html).not.toContain("Nature of Paymaster:");
    expect(html).not.toContain("Deed of Assignment (DOA):");
    expect(html).toContain("Paymaster Rating:");
    expect(html).toContain("Confidence Grading:");

    expect(html).toContain("RM 625,000.00");
    expect(html).toContain("1 August 2025");
    expect(html).toContain("Kementerian Kerja Raya (KKR)");
    expect(html).toContain("Federal Government Agency");
    expect(html).toContain(PROSPECTUS_DATA_NOT_AVAILABLE);

    expect(html).not.toContain("target amount");
    expect(html).not.toContain("funded amount");
    expect(html).not.toContain("financing amount");
    expect(html).not.toContain("INV-SAMPLE-001");
    expect(html).not.toContain("targetAmount");
    expect(html).not.toContain("fundedAmount");

    expect(html).not.toContain("isFrozen");
    expect(html).not.toContain("structuredSourceAvailable");
    expect(html).not.toContain("inferenceAllowed");
    expect(html).not.toContain("liveFallbackAllowed");
    expect(html).not.toContain("notes.invoice_snapshot.details.value");
    expect(html).not.toContain('"audit"');
  });

  it("audit records freeze and officer rules without live fallback", () => {
    const data = buildProspectusInvoicePaymaster(SAMPLE_PROSPECTUS_INVOICE_PAYMASTER_INPUT);
    expect(data.audit.invoiceAmount.meaning).toBe("invoice_face_value");
    expect(data.audit.invoiceAmount.isFrozen).toBe(true);
    expect(data.audit.invoiceDueDate.source).toBe(
      "notes.invoice_snapshot.details.maturity_date"
    );
    expect(data.audit.paymasterNature.fullStoredValuePreserved).toBe(true);
    expect(data.audit.paymasterNature.displayMapping).toBe("none");
    expect(data.audit.deedOfAssignment.isOfficerContent).toBe(true);
    expect(data.audit.deedOfAssignment.requiredForApproval).toBe(true);
    expect(data.audit.deedOfAssignment.inferenceAllowed).toBe(false);
    expect(data.audit.paymasterRating.isOfficerContent).toBe(true);
    expect(data.audit.confidenceGrading.isOfficerContent).toBe(true);
    expect(data.audit.snapshot.liveFallbackAllowed).toBe(false);
  });
});
