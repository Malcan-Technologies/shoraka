import { getGatewayPaymentDetailVisibility, gatewayAuditEventView, readRefundRequestedAt } from "./gateway-payment-detail-model";
import type { GatewayPaymentDetailDto } from "@cashsouk/types";

function base(overrides: Partial<GatewayPaymentDetailDto> = {}): GatewayPaymentDetailDto {
  return {
    id: "gp_test",
    gatewayAccount: "INVESTOR_POOL",
    purpose: "INVESTOR_DEPOSIT",
    organizationType: "INVESTOR",
    status: "COMPLETED",
    amount: 100,
    currency: "MYR",
    payerName: "Test",
    nameCheckResult: null,
    investorOrganizationId: "org",
    investorOrganizationName: "Test",
    issuerOrganizationId: null,
    issuerOrganizationName: null,
    curlecOrderId: "order",
    curlecPaymentId: "pay",
    settlementId: null,
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
    method: "fpx",
    bankCode: "MB2U",
    expectedPayerName: "Test",
    nameCheckAt: null,
    nameCheckedByUserId: null,
    refundReference: null,
    refundInitiatedBy: null,
    refundedAt: null,
    refundNotes: null,
    openOverrideProposedBy: null,
    openOverrideReason: null,
    metadata: null,
    events: [],
    receipt: null,
    ...overrides,
  };
}

describe("readRefundRequestedAt", () => {
  it("prefers PAYMENT_REFUND_INITIATED occurredAt over legacy REFUND_INITIATED", () => {
    expect(
      readRefundRequestedAt({
        metadata: null,
        events: [
          {
            eventType: "PAYMENT_REFUND_INITIATED",
            occurredAt: "2026-08-14T01:00:00.000Z",
          },
        ],
      })
    ).toBe("2026-08-14T01:00:00.000Z");
  });
});

describe("gatewayAuditEventView", () => {
  it("reads typed metadata for status and mismatch reason", () => {
    const view = gatewayAuditEventView({
      id: "evt_1",
      eventType: "PAYMENT_CAPTURE_MISMATCH_DETECTED",
      occurredAt: "2026-08-14T02:00:00.000Z",
      metadata: {
        mismatchType: "AMOUNT_MISMATCH",
        previousStatus: "CREATED",
        newStatus: "PAID",
      },
    });
    expect(view.reason).toBe("AMOUNT_MISMATCH");
    expect(view.fromStatus).toBe("CREATED");
    expect(view.toStatus).toBe("PAID");
  });
});

describe("getGatewayPaymentDetailVisibility", () => {
  it("shows initiate refund only for completed investor deposits", () => {
    expect(getGatewayPaymentDetailVisibility(base()).showInitiateRefund).toBe(true);
    expect(
      getGatewayPaymentDetailVisibility(
        base({ purpose: "ISSUER_ONBOARDING_FEE", organizationType: "ISSUER" })
      ).showInitiateRefund
    ).toBe(false);
  });

  it("hides retry refund on currency mismatch HELD", () => {
    const visibility = getGatewayPaymentDetailVisibility(
      base({
        status: "HELD",
        metadata: {
          captureMismatch: {
            mismatchType: "CURRENCY_MISMATCH",
            expectedCurrency: "MYR",
            actualCurrency: "SGD",
            reason: "Currency mismatch",
          },
        },
      })
    );
    expect(visibility.showCurrencyMismatchCard).toBe(true);
    expect(visibility.showRetryRefund).toBe(false);
  });
});
