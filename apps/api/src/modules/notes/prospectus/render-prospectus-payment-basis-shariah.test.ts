import { buildProspectusPaymentBasisShariah } from "./prospectus-payment-basis-shariah";
import { SAMPLE_PROSPECTUS_PAYMENT_BASIS_SHARIAH_INPUT } from "./prospectus-payment-basis-shariah.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAYMENT_BASIS_SHARIAH_FIELD_SOURCES,
} from "./prospectus-payment-basis-shariah.types";
import { buildProspectusPaymentBasisShariahDocument } from "./render-prospectus-payment-basis-shariah";
import { buildProspectusShariahHighlight } from "./prospectus-shariah-highlight";

describe("prospectus Payment Basis and Shariah Principle (Page 1 DATA STAGE 4C)", () => {
  it("documents both fields as unresolved with no confirmed source", () => {
    expect(PROSPECTUS_PAYMENT_BASIS_SHARIAH_FIELD_SOURCES.paymentBasis.canonicalSource).toBe(
      "none confirmed"
    );
    expect(PROSPECTUS_PAYMENT_BASIS_SHARIAH_FIELD_SOURCES.shariahPrinciple.canonicalSource).toBe(
      "none confirmed"
    );
    expect(PROSPECTUS_PAYMENT_BASIS_SHARIAH_FIELD_SOURCES.paymentBasis.availability).toBe(
      "unresolved"
    );
    expect(PROSPECTUS_PAYMENT_BASIS_SHARIAH_FIELD_SOURCES.shariahPrinciple.availability).toBe(
      "unresolved"
    );
  });

  it("returns Data not available for payment basis with no schedules", () => {
    const data = buildProspectusPaymentBasisShariah({});
    expect(data.paymentBasis).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit.paymentBasis.inferenceAllowed).toBe(false);
    expect(data.audit.paymentBasis.scheduleShapeObserved).toBe("not_provided");
  });

  it("does not infer bullet payment from one maturity schedule", () => {
    const data = buildProspectusPaymentBasisShariah({
      maturityDate: "2025-09-12T00:00:00.000Z",
      paymentSchedules: [{ sequence: 1, dueDate: "2025-09-12T00:00:00.000Z" }],
    });
    expect(data.paymentBasis).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit.paymentBasis.scheduleShapeObserved).toBe("single_maturity_schedule");
    expect(data.paymentBasis).not.toMatch(/Bullet|Instalment|Balloon/i);
  });

  it("does not infer instalments from multiple schedules", () => {
    const data = buildProspectusPaymentBasisShariah({
      maturityDate: "2025-09-12T00:00:00.000Z",
      paymentSchedules: [
        { sequence: 1, dueDate: "2025-07-12T00:00:00.000Z" },
        { sequence: 2, dueDate: "2025-09-12T00:00:00.000Z" },
      ],
    });
    expect(data.paymentBasis).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit.paymentBasis.scheduleShapeObserved).toBe("multiple_schedules");
  });

  it("returns Data not available for Shariah principle", () => {
    const data = buildProspectusPaymentBasisShariah({});
    expect(data.shariahPrinciple).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("does not use Tawarruq or murabaha ops as the principle", () => {
    const data = buildProspectusPaymentBasisShariah({
      tawarruqStatus: "COMPLETED",
      commodityType: "PALM_OIL",
      murabahaAmount: 500_000,
      financingStructure: "invoice",
    });
    expect(data.shariahPrinciple).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit.shariahPrinciple.tawarruqUsedAsEvidence).toBe(false);
    expect(data.shariahPrinciple).not.toMatch(/Tawarruq|Murabahah|Wakalah|Bai/i);
  });

  it("does not use marketing Shariah Compliant text as the principle", () => {
    const data = buildProspectusPaymentBasisShariah({
      marketingShariahCompliantLabel: "Shariah Compliant",
    });
    expect(data.shariahPrinciple).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.shariahPrinciple).not.toBe("Shariah Compliant");
  });

  it("renders Canva-facing HTML without Canva samples or audit keys", () => {
    const html = buildProspectusPaymentBasisShariahDocument(
      buildProspectusPaymentBasisShariah(SAMPLE_PROSPECTUS_PAYMENT_BASIS_SHARIAH_INPUT)
    );
    expect(html).toContain("Payment Basis: Data not available");
    expect(html).toContain("Shariah Principle: Data not available");
    expect(html).not.toContain("Bullet Payment at Maturity");
    expect(html).not.toContain("Bai' Al-Dayn Bi Al-Sila'");
    expect(html).not.toContain("Bai");
    expect(html).not.toContain("Tawarruq");
    expect(html).not.toContain("Shariah Compliant");
    expect(html).not.toContain("sourceStatus");
    expect(html).not.toContain("inferenceAllowed");
    expect(html).not.toContain("scheduleShapeObserved");
    expect(html).not.toContain("tawarruqUsedAsEvidence");
    expect(html).not.toContain("legalDecision");
    expect(html).not.toContain("snapshotStatus");
    expect(html).not.toContain("adviserApprovalReference");
  });

  it("keeps Stage 5D reusing unresolved Stage 4C principle", () => {
    const stage4c = buildProspectusPaymentBasisShariah(
      SAMPLE_PROSPECTUS_PAYMENT_BASIS_SHARIAH_INPUT
    );
    const stage5d = buildProspectusShariahHighlight({});
    expect(stage5d.specificShariahPrinciple).toBe(stage4c.shariahPrinciple);
    expect(stage5d.specificShariahPrinciple).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });
});
