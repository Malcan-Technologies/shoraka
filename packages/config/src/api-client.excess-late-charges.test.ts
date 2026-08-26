import type { ExcessLateChargePaymentResponse } from "@cashsouk/types";
import { ApiClient } from "./api-client";

describe("excess late charge API client methods", () => {
  it("exposes typed create and get methods on the client", () => {
    expect(typeof ApiClient.prototype.createExcessLateChargePayment).toBe("function");
    expect(typeof ApiClient.prototype.getExcessLateChargePayment).toBe("function");
  });

  it("types the payment response with note totals and Curlec fields", () => {
    const sample: ExcessLateChargePaymentResponse = {
      id: "pay_1",
      status: "CREATED",
      purpose: "EXCESS_LATE_CHARGES",
      gatewayAccount: "OPERATING",
      amount: 1000,
      currency: "MYR",
      curlecOrderId: "order_1",
      curlecKeyId: "key_1",
      issuerOrganizationId: "org_1",
      applicationId: null,
      contractId: null,
      noteId: "note_1",
      settlementId: "set_1",
      nameCheckResult: null,
      payerName: null,
      createdAt: "2026-08-24T00:00:00.000Z",
      updatedAt: "2026-08-24T00:00:00.000Z",
      owedAmount: 4000,
      paidAmount: 0,
      outstanding: 4000,
      perTxnMaxAmount: 30000,
      noteReference: "NOTE-1",
    };

    expect(sample.noteId).toBe("note_1");
    expect(sample.outstanding).toBe(4000);
  });
});
