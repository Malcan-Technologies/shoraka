import {
  buildFacilityFeeContractReturnTo,
  buildFacilityFeeReturnLocation,
  parseContractIdFromFinancingPath,
  resolveFacilityFeeReturnTo,
  sanitizeFacilityFeePaymentId,
} from "./facility-fee-payment-routes";

describe("facility fee callback sanitization", () => {
  it("keeps a contract return path and drops protocol-relative or off-route values", () => {
    expect(resolveFacilityFeeReturnTo("/financing/contracts/con_1")).toBe(
      "/financing/contracts/con_1"
    );
    expect(resolveFacilityFeeReturnTo("/financing/contracts/con_1?tab=invoices")).toBe(
      "/financing/contracts/con_1?tab=invoices"
    );
    expect(resolveFacilityFeeReturnTo("//evil.example/financing/contracts/con_1")).toBe(
      "/financing"
    );
    expect(resolveFacilityFeeReturnTo("https://evil.example/financing/contracts/con_1")).toBe(
      "/financing"
    );
    expect(resolveFacilityFeeReturnTo("/applications/app_1")).toBe("/financing");
    expect(resolveFacilityFeeReturnTo(null)).toBe("/financing");
  });

  it("accepts only safe payment ids", () => {
    expect(sanitizeFacilityFeePaymentId("pay_abc-123")).toBe("pay_abc-123");
    expect(sanitizeFacilityFeePaymentId("short")).toBeNull();
    expect(sanitizeFacilityFeePaymentId("pay id with spaces")).toBeNull();
    expect(sanitizeFacilityFeePaymentId("../secret")).toBeNull();
    expect(sanitizeFacilityFeePaymentId(null)).toBeNull();
  });

  it("adds the return marker without exposing extra query noise", () => {
    expect(buildFacilityFeeReturnLocation("pay_abc-123", "/financing/contracts/con_1")).toBe(
      "/financing/contracts/con_1?facilityFeeReturn=pay_abc-123"
    );
    expect(buildFacilityFeeReturnLocation(null, "/financing/contracts/con_1")).toBe(
      "/financing/contracts/con_1"
    );
    expect(buildFacilityFeeContractReturnTo("con_1")).toBe("/financing/contracts/con_1");
    expect(parseContractIdFromFinancingPath("/financing/contracts/con_1")).toBe("con_1");
    expect(parseContractIdFromFinancingPath("/financing")).toBeNull();
  });
});
