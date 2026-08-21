import { ADMIN_ACTION_SURFACE_CLASS, ADMIN_WAITING_SURFACE_CLASS } from "@/lib/admin-status-token";
import {
  disbursementLifecycleStripTone,
  paymentReceiptStatusLabel,
  paymentReceiptTone,
  settlementLifecycleStripTone,
  tawarruqWorkflowTone,
  trusteeWorkflowTone,
  withdrawalWorkflowTone,
  WORKFLOW_CARD,
  WORKFLOW_SUCCESS_COPY,
} from "./workflow-status-tokens";

describe("workflow wash intensity", () => {
  it("uses the same 45% yellow wash for admin-action cards and steps", () => {
    expect(WORKFLOW_CARD.activeSection).toBe(WORKFLOW_CARD.activeStep);
    expect(WORKFLOW_CARD.activeSection).toBe(ADMIN_ACTION_SURFACE_CLASS);
  });

  it("uses the same 45% blue wash while waiting on someone else", () => {
    expect(WORKFLOW_CARD.warningSection).toBe(ADMIN_WAITING_SURFACE_CLASS);
  });

  it("styles complete section titles as titles, not uppercase captions", () => {
    expect(WORKFLOW_SUCCESS_COPY.sectionHeader).toContain("text-sm");
    expect(WORKFLOW_SUCCESS_COPY.sectionHeader).not.toContain("uppercase");
  });
});

describe("withdrawal and tawarruq tones", () => {
  it("marks incomplete disbursement tasks yellow until waiting on trustee", () => {
    expect(withdrawalWorkflowTone("DRAFT")).toBe("active");
    expect(withdrawalWorkflowTone("LETTER_GENERATED")).toBe("active");
    expect(withdrawalWorkflowTone("SUBMITTED_TO_TRUSTEE")).toBe("warning");
    expect(withdrawalWorkflowTone("COMPLETED")).toBe("success");
  });

  it("marks tawarruq yellow until the certificate is ready", () => {
    expect(tawarruqWorkflowTone("not-submitted")).toBe("active");
    expect(tawarruqWorkflowTone("in-progress")).toBe("active");
    expect(tawarruqWorkflowTone("certificate-ready")).toBe("success");
  });
});

describe("settlement and receipt tones", () => {
  it("treats pending receipts as admin work, not waiting-on-others", () => {
    expect(paymentReceiptTone("PENDING")).toBe("active");
    expect(paymentReceiptTone("PARTIAL")).toBe("active");
    expect(paymentReceiptTone("RECEIVED")).toBe("success");
    expect(paymentReceiptStatusLabel("SETTLED")).toBe("Settled");
    expect(paymentReceiptStatusLabel("RECEIVED")).toBe("Received");
    expect(paymentReceiptStatusLabel("PENDING")).toBe("Pending");
  });

  it("keeps generating a trustee letter yellow, and submitted-to-trustee blue", () => {
    expect(trusteeWorkflowTone(null, { needsGeneration: true })).toBe("active");
    expect(trusteeWorkflowTone("LETTER_GENERATED")).toBe("active");
    expect(trusteeWorkflowTone("SUBMITTED_TO_TRUSTEE")).toBe("warning");
    expect(trusteeWorkflowTone("COMPLETED")).toBe("success");
  });

  it("colours the settlement strip yellow when admin still has work", () => {
    expect(
      settlementLifecycleStripTone({
        settledComplete: false,
        receiptsComplete: false,
        postedComplete: false,
        trusteeComplete: false,
        trusteeSubmittedToTrustee: false,
      })
    ).toBe("active");
    expect(
      settlementLifecycleStripTone({
        settledComplete: false,
        receiptsComplete: true,
        postedComplete: false,
        trusteeComplete: false,
        trusteeSubmittedToTrustee: false,
      })
    ).toBe("active");
    expect(
      settlementLifecycleStripTone({
        settledComplete: false,
        receiptsComplete: true,
        postedComplete: true,
        trusteeComplete: false,
        trusteeSubmittedToTrustee: false,
      })
    ).toBe("active");
    expect(
      settlementLifecycleStripTone({
        settledComplete: false,
        receiptsComplete: true,
        postedComplete: true,
        trusteeComplete: false,
        trusteeSubmittedToTrustee: true,
      })
    ).toBe("warning");
    expect(
      settlementLifecycleStripTone({
        settledComplete: true,
        receiptsComplete: true,
        postedComplete: true,
        trusteeComplete: true,
        trusteeSubmittedToTrustee: true,
      })
    ).toBe("success");
  });

  it("colours the disbursement strip yellow until waiting on trustee", () => {
    expect(disbursementLifecycleStripTone(null)).toBe("active");
    expect(disbursementLifecycleStripTone("DRAFT")).toBe("active");
    expect(disbursementLifecycleStripTone("SUBMITTED_TO_TRUSTEE")).toBe("warning");
    expect(disbursementLifecycleStripTone("COMPLETED")).toBe("success");
  });
});
