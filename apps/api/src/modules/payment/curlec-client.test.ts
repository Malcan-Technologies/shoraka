import { resetCurlecConfigCache } from "../../config/curlec";
import { CurlecClient } from "./curlec-client";
import { extractBankCodeFromPayment, extractPayerNameFromPayment } from "./curlec-schemas";

const testConfig = {
  keyId: "rzp_test_key",
  keySecret: "rzp_test_secret",
  webhookSecret: "whsec_test",
  apiBaseUrl: "https://api.razorpay.com",
  environment: "sandbox" as const,
};

describe("CurlecClient", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("creates an order with basic auth and sen amount", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          id: "order_test123",
          amount: 10_000,
          currency: "MYR",
          status: "created",
          receipt: "rcpt-1",
        }),
    });

    const client = new CurlecClient(testConfig);
    const order = await client.createOrder({
      amountSen: 10_000,
      currency: "MYR",
      receipt: "rcpt-1",
      notes: { purpose: "INVESTOR_DEPOSIT" },
    });

    expect(order.id).toBe("order_test123");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.razorpay.com/v1/orders",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /),
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          amount: 10_000,
          currency: "MYR",
          receipt: "rcpt-1",
          notes: { purpose: "INVESTOR_DEPOSIT" },
          partial_payment: false,
        }),
      })
    );
  });

  it("fetches a payment by id", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          id: "pay_test123",
          amount: 10_000,
          currency: "MYR",
          status: "captured",
          method: "fpx",
          order_id: "order_test123",
          bank: "MB2U",
        }),
    });

    const client = new CurlecClient(testConfig);
    const payment = await client.fetchPayment("pay_test123");

    expect(payment.status).toBe("captured");
    expect(payment.bank).toBe("MB2U");
  });

  it("throws AppError when Curlec returns non-2xx", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { description: "Authentication failed" } }),
    });

    const client = new CurlecClient(testConfig);
    await expect(
      client.fetchPayment("pay_bad")
    ).rejects.toMatchObject({ code: "CURLEC_API_ERROR", statusCode: 502 });
  });
});

describe("Curlec payment field extractors", () => {
  it("extracts bank code from payment.bank", () => {
    expect(
      extractBankCodeFromPayment({
        id: "pay_1",
        amount: 100,
        currency: "MYR",
        status: "captured",
        bank: "MB2U",
      })
    ).toBe("MB2U");
  });

  it("extracts payer name from acquirer_data when present", () => {
    expect(
      extractPayerNameFromPayment({
        id: "pay_1",
        amount: 100,
        currency: "MYR",
        status: "captured",
        acquirer_data: { account_holder_name: "John Doe" },
      })
    ).toBe("John Doe");
  });

  it("returns null payer name when FPX payload has no holder name (M0 finding)", () => {
    expect(
      extractPayerNameFromPayment({
        id: "pay_1",
        amount: 100,
        currency: "MYR",
        status: "captured",
        bank: "MB2U",
        acquirer_data: { fpx_data: null },
      })
    ).toBeNull();
  });
});

describe("getCurlecConfig", () => {
  afterEach(() => {
    resetCurlecConfigCache();
    delete process.env.CURLEC_KEY_ID;
    delete process.env.CURLEC_KEY_SECRET;
  });

  it("requires API credentials from environment", () => {
    jest.isolateModules(() => {
      const { getCurlecConfig } = require("../../config/curlec") as typeof import("../../config/curlec");
      expect(() => getCurlecConfig()).toThrow(/CURLEC_KEY_ID/);
    });
  });
});
