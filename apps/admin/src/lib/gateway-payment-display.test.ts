import { PURPOSE_LABEL, STATUS_LABEL, statusToken, statusVariant } from "./gateway-payment-display";

describe("gateway-payment-display", () => {
  it("uses detail-aligned status labels", () => {
    expect(STATUS_LABEL.CREATED).toBe("Awaiting payment");
    expect(STATUS_LABEL.COMPLETED).toBe("Completed");
    expect(STATUS_LABEL.FAILED).toBe("Payment failed");
    expect(STATUS_LABEL.REFUND_INITIATED).toBe("Refund pending");
    expect(STATUS_LABEL.REFUNDED).toBe("Refunded");
    expect(STATUS_LABEL.HELD).toBe("Needs attention");
    expect(STATUS_LABEL.NAME_CHECK_PENDING).toBe("Name check pending");
    expect(STATUS_LABEL.PAID).toBe("Paid");
    expect(STATUS_LABEL.EXPIRED).toBe("Expired");
  });

  it("maps status tokens for StatusBadge", () => {
    expect(statusToken("COMPLETED")).toBe("success");
    expect(statusToken("CREATED")).toBe("submitted");
    expect(statusToken("PAID")).toBe("action");
    expect(statusToken("NAME_CHECK_PENDING")).toBe("action");
    expect(statusToken("REFUND_INITIATED")).toBe("submitted");
    expect(statusToken("HELD")).toBe("rejected");
    expect(statusToken("FAILED")).toBe("rejected");
    expect(statusToken("REFUNDED")).toBe("neutral");
    expect(statusToken("EXPIRED")).toBe("rejected");
  });

  it("maps status badge variants for list and detail", () => {
    expect(statusVariant("COMPLETED")).toBe("success");
    expect(statusVariant("CREATED")).toBe("info");
    expect(statusVariant("PAID")).toBe("warning");
    expect(statusVariant("NAME_CHECK_PENDING")).toBe("warning");
    expect(statusVariant("REFUND_INITIATED")).toBe("warning");
    expect(statusVariant("HELD")).toBe("destructive");
    expect(statusVariant("FAILED")).toBe("destructive");
    expect(statusVariant("REFUNDED")).toBe("muted");
    expect(statusVariant("EXPIRED")).toBe("destructive");
  });

  it("keeps purpose labels stable", () => {
    expect(PURPOSE_LABEL.INVESTOR_DEPOSIT).toBe("Investor Deposit");
    expect(PURPOSE_LABEL.ISSUER_ONBOARDING_FEE).toBe("Issuer Registration Fee");
    expect(PURPOSE_LABEL.APPLICATION_PROCESSING_FEE).toBe("Application Processing Fee");
  });
});
