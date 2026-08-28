import {
  canResendSettlementTrusteeEmail,
  canResendWithdrawalTrusteeEmail,
  getTrusteeResendCopy,
  TRUSTEE_RESEND_BUTTON,
  TRUSTEE_RESEND_SUCCESS,
} from "./trustee-letter-resend";

describe("getTrusteeResendCopy", () => {
  it("explains latest recipients and current PDF without completing the workflow", () => {
    expect(getTrusteeResendCopy()).toEqual({
      button: TRUSTEE_RESEND_BUTTON,
      confirmLabel: TRUSTEE_RESEND_BUTTON,
      confirmTitle: "Resend email to Trustee?",
      description:
        "The current signed PDF will be emailed again to the latest configured trustee recipients. This does not mark the instruction disbursed or completed.",
      success: TRUSTEE_RESEND_SUCCESS,
    });
  });
});

describe("canResendWithdrawalTrusteeEmail", () => {
  it("shows after a send on submitted and letter-generated fallback", () => {
    expect(canResendWithdrawalTrusteeEmail("2026-08-24T10:00:00.000Z", "SUBMITTED_TO_TRUSTEE")).toBe(
      true
    );
    expect(canResendWithdrawalTrusteeEmail("2026-08-24T10:00:00.000Z", "LETTER_GENERATED")).toBe(
      true
    );
  });

  it("hides before the first send and after completed or cancelled", () => {
    expect(canResendWithdrawalTrusteeEmail(null, "SUBMITTED_TO_TRUSTEE")).toBe(false);
    expect(canResendWithdrawalTrusteeEmail("2026-08-24T10:00:00.000Z", "COMPLETED")).toBe(false);
    expect(canResendWithdrawalTrusteeEmail("2026-08-24T10:00:00.000Z", "CANCELLED")).toBe(false);
  });

  it("hides on draft and unknown statuses even when sent-at exists", () => {
    expect(canResendWithdrawalTrusteeEmail("2026-08-24T10:00:00.000Z", "DRAFT")).toBe(false);
    expect(canResendWithdrawalTrusteeEmail("2026-08-24T10:00:00.000Z", "UNKNOWN")).toBe(false);
    expect(canResendWithdrawalTrusteeEmail("2026-08-24T10:00:00.000Z", null)).toBe(false);
    expect(canResendWithdrawalTrusteeEmail("2026-08-24T10:00:00.000Z", undefined)).toBe(false);
  });
});

describe("canResendSettlementTrusteeEmail", () => {
  it("shows after a send while generated or submitted", () => {
    expect(canResendSettlementTrusteeEmail("2026-08-24T10:00:00.000Z", "LETTER_GENERATED")).toBe(
      true
    );
    expect(canResendSettlementTrusteeEmail("2026-08-24T10:00:00.000Z", "SUBMITTED_TO_TRUSTEE")).toBe(
      true
    );
  });

  it("hides before the first send and after completed", () => {
    expect(canResendSettlementTrusteeEmail(null, "SUBMITTED_TO_TRUSTEE")).toBe(false);
    expect(canResendSettlementTrusteeEmail("2026-08-24T10:00:00.000Z", "PENDING_LETTER")).toBe(
      false
    );
    expect(canResendSettlementTrusteeEmail("2026-08-24T10:00:00.000Z", null)).toBe(false);
    expect(canResendSettlementTrusteeEmail("2026-08-24T10:00:00.000Z", "COMPLETED")).toBe(false);
  });
});
