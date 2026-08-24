import type { FacilityFeePaymentResponse } from "@cashsouk/types";
import { ApiClient } from "./api-client";

describe("facility fee API client methods", () => {
  it("exposes typed create and get methods on the client", () => {
    expect(typeof ApiClient.prototype.createFacilityFeePayment).toBe("function");
    expect(typeof ApiClient.prototype.getFacilityFeePayment).toBe("function");
  });

  it("types the payment response with contract totals and Curlec fields", () => {
    const sample: FacilityFeePaymentResponse = {
      id: "pay_1",
      status: "CREATED",
      purpose: "FACILITY_FEE",
      gatewayAccount: "OPERATING",
      amount: 1000,
      currency: "MYR",
      curlecOrderId: "order_1",
      curlecKeyId: "key_1",
      issuerOrganizationId: "org_1",
      applicationId: null,
      contractId: "con_1",
      nameCheckResult: null,
      payerName: null,
      createdAt: "2026-08-24T00:00:00.000Z",
      updatedAt: "2026-08-24T00:00:00.000Z",
      upfrontAmount: 5000,
      paidAmount: 0,
      outstanding: 5000,
      perTxnMaxAmount: 30000,
    };

    expect(sample.contractId).toBe("con_1");
    expect(sample.curlecKeyId).toBe("key_1");
    expect(sample.curlecOrderId).toBe("order_1");
    expect(sample.upfrontAmount + sample.paidAmount + sample.outstanding).toBe(10000);
  });
});
