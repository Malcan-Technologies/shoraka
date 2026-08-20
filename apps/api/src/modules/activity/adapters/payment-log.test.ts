import { PaymentLogAdapter } from "./payment-log";

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    paymentAuditLog: { findMany: jest.fn() },
  },
}));

const { prisma } = jest.requireMock("../../../lib/prisma") as {
  prisma: {
    paymentAuditLog: { findMany: jest.Mock };
  };
};

function createRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "pay_1",
    event_type: "PAYMENT_FAILED",
    actor_user_id: "user_1",
    organization_id: "investor-org-1",
    organization_kind: "INVESTOR",
    metadata: {},
    ip_address: null,
    user_agent: null,
    occurred_at: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("PaymentLogAdapter", () => {
  const adapter = new PaymentLogAdapter();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses investor-safe payment copy", () => {
    expect(adapter.buildPresentation("PAYMENT_NAME_CHECK_REJECTED")).toEqual({
      title: "Payment Verification Failed",
      description:
        "We could not verify the account details for this payment. Please review the details and try again.",
    });
    expect(adapter.buildPresentation("PAYMENT_REFUND_INITIATED").title).toBe("Refund Processing");
    expect(adapter.buildPresentation("PAYMENT_REFUNDED").title).toBe("Refund Completed");
    expect(adapter.buildPresentation("INVESTOR_WITHDRAWAL_SUBMITTED_TO_TRUSTEE")).toEqual({
      title: "Withdrawal Processing",
      description: "Your withdrawal request is being processed.",
    });
    expect(
      adapter.buildPresentation("INVESTOR_WITHDRAWAL_SUBMITTED_TO_TRUSTEE").description.toLowerCase()
    ).not.toContain("trustee");
    expect(
      adapter.buildPresentation("INVESTOR_DEPOSIT_RECEIVED", { amount: 100, currency: "MYR" })
        .description
    ).toContain("MYR 100.00");
  });

  it("exposes only curated investor payment events", () => {
    expect(adapter.getEventTypes()).toEqual(
      expect.arrayContaining([
        "PAYMENT_FAILED",
        "PAYMENT_EXPIRED",
        "PAYMENT_NAME_CHECK_REJECTED",
        "INVESTOR_DEPOSIT_RECEIVED",
        "INVESTOR_WITHDRAWAL_REQUESTED",
        "INVESTOR_WITHDRAWAL_SUBMITTED_TO_TRUSTEE",
        "INVESTOR_WITHDRAWAL_COMPLETED",
        "PAYMENT_REFUND_INITIATED",
        "PAYMENT_REFUNDED",
      ])
    );
    expect(adapter.getEventTypes()).not.toContain("PAYMENT_INITIATED");
    expect(adapter.getEventTypes()).not.toContain("PAYMENT_CAPTURED");
    expect(adapter.getEventTypes()).not.toContain("PAYMENT_NAME_CHECK_PENDING");
    expect(adapter.getEventTypes()).not.toContain("INVESTOR_WITHDRAWAL_LETTER_GENERATED");
    expect(adapter.getEventTypes()).not.toContain("PAYMENT_RECONCILIATION_EXCEPTION_DETECTED");
  });

  it("returns selected payment events for the owning investor only", async () => {
    prisma.paymentAuditLog.findMany.mockResolvedValue([
      createRecord({ id: "failed", event_type: "PAYMENT_FAILED" }),
      createRecord({
        id: "other",
        event_type: "PAYMENT_FAILED",
        organization_id: "investor-org-2",
      }),
      createRecord({ id: "initiated", event_type: "PAYMENT_INITIATED" }),
      createRecord({ id: "refund", event_type: "PAYMENT_REFUNDED" }),
    ]);

    const records = await adapter.query("user_1", {
      organizationId: "investor-org-1",
      portalType: "investor",
      limit: 10,
      offset: 0,
    });

    expect(records.map((record) => record.id)).toEqual(["failed", "refund"]);
  });

  it("does not query payment activity without a validated investor organization", async () => {
    const records = await adapter.query("user_1", {
      portalType: "investor",
      limit: 10,
      offset: 0,
    });

    expect(records).toEqual([]);
    expect(prisma.paymentAuditLog.findMany).not.toHaveBeenCalled();
  });

  it("returns no issuer payment activity", async () => {
    const records = await adapter.query("user_1", {
      organizationId: "issuer-org-1",
      portalType: "issuer",
    });
    expect(records).toEqual([]);
    expect(prisma.paymentAuditLog.findMany).not.toHaveBeenCalled();
  });
});
