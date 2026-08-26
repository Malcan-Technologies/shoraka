import { getGatewayPaymentDetailVisibility } from "./gateway-payment-detail-model";
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
    contractId: null,
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

describe("getGatewayPaymentDetailVisibility", () => {
  it("shows initiate refund only for completed investor deposits", () => {
    expect(getGatewayPaymentDetailVisibility(base()).showInitiateRefund).toBe(true);
    expect(
      getGatewayPaymentDetailVisibility(
        base({ purpose: "ISSUER_ONBOARDING_FEE", organizationType: "ISSUER" })
      ).showInitiateRefund
    ).toBe(false);
    expect(
      getGatewayPaymentDetailVisibility(
        base({
          purpose: "FACILITY_FEE",
          organizationType: "ISSUER",
          gatewayAccount: "OPERATING",
          contractId: "con-1",
        })
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
