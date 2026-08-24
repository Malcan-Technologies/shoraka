import {
  facilityFeePaymentReference,
  resolveFacilityFeeHistoryState,
} from "./contract-facility-fee-history";
import type { GatewayPaymentListItemDto } from "@cashsouk/types";

function item(
  overrides: Partial<GatewayPaymentListItemDto> = {}
): GatewayPaymentListItemDto {
  return {
    id: "gp_1",
    gatewayAccount: "OPERATING",
    purpose: "FACILITY_FEE",
    organizationType: "ISSUER",
    status: "COMPLETED",
    amount: 400,
    currency: "MYR",
    payerName: "Issuer",
    nameCheckResult: null,
    investorOrganizationId: null,
    investorOrganizationName: null,
    issuerOrganizationId: "org",
    issuerOrganizationName: "Issuer Co",
    contractId: "con-1",
    curlecOrderId: "order_1",
    curlecPaymentId: "pay_1",
    settlementId: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("facility fee payment history", () => {
  it("maps loading, error, empty, and ready states", () => {
    expect(
      resolveFacilityFeeHistoryState({ isLoading: true, isError: false, items: [] })
    ).toBe("loading");
    expect(
      resolveFacilityFeeHistoryState({ isLoading: false, isError: true, items: [] })
    ).toBe("error");
    expect(
      resolveFacilityFeeHistoryState({ isLoading: false, isError: false, items: [] })
    ).toBe("empty");
    expect(
      resolveFacilityFeeHistoryState({
        isLoading: false,
        isError: false,
        items: [item()],
      })
    ).toBe("ready");
  });

  it("prefers the Curlec payment reference, then the order reference", () => {
    expect(facilityFeePaymentReference(item())).toBe("pay_1");
    expect(facilityFeePaymentReference(item({ curlecPaymentId: null }))).toBe("order_1");
    expect(
      facilityFeePaymentReference(item({ curlecPaymentId: "  ", curlecOrderId: "  " }))
    ).toBeNull();
  });
});
