import { resetCurlecConfigCache } from "../../config/curlec";
import { CurlecClient, createCurlecClient } from "./curlec-client";
import { extractBankCodeFromPayment, extractPayerNameFromPayment } from "./curlec-schemas";

const testConfig = {
  gatewayAccount: "LEGACY_DEFAULT" as const,
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
    resetCurlecConfigCache();
    delete process.env.CURLEC_KEY_ID;
    delete process.env.CURLEC_KEY_SECRET;
    delete process.env.CURLEC_WEBHOOK_SECRET;
    delete process.env.CURLEC_OPERATING_KEY_ID;
    delete process.env.CURLEC_OPERATING_KEY_SECRET;
    delete process.env.CURLEC_OPERATING_WEBHOOK_SECRET;
    delete process.env.CURLEC_INVESTOR_POOL_KEY_ID;
    delete process.env.CURLEC_INVESTOR_POOL_KEY_SECRET;
    delete process.env.CURLEC_INVESTOR_POOL_WEBHOOK_SECRET;
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

  it("refunds a payment with idempotency header", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          id: "rfnd_test123",
          amount: 10_000,
          payment_id: "pay_test123",
          status: "processed",
        }),
    });

    const client = new CurlecClient(testConfig);
    const refund = await client.refundPayment("pay_test123", {
      amountSen: 10_000,
      idempotencyKey: "gp_123",
      notes: "Name mismatch",
    });

    expect(refund.id).toBe("rfnd_test123");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.razorpay.com/v1/payments/pay_test123/refund",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /),
          "Content-Type": "application/json",
          "X-Refund-Idempotency": "gp_123",
        }),
        body: JSON.stringify({
          amount: 10_000,
          speed: "normal",
          notes: { reason: "Name mismatch" },
        }),
      })
    );
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

  it("fetches settlement recon combined report", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          count: 1,
          items: [
            {
              entity_type: "payment",
              amount: 10_000,
              fee: 50,
              tax: 0,
              settled: true,
              settlement_id: "setl_1",
              payment_id: "pay_1",
            },
          ],
        }),
    });

    const client = new CurlecClient(testConfig);
    const report = await client.fetchSettlementRecon({ year: 2026, month: 6, day: 28 });
    expect(report.items).toHaveLength(1);
    expect(report.items[0]?.payment_id).toBe("pay_1");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.razorpay.com/v1/settlements/recon/combined?year=2026&month=6&day=28",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("uses different key IDs for different gateway-account clients", async () => {
    process.env.CURLEC_OPERATING_KEY_ID = "rzp_operating_key";
    process.env.CURLEC_OPERATING_KEY_SECRET = "operating_secret";
    process.env.CURLEC_OPERATING_WEBHOOK_SECRET = "operating_webhook";
    process.env.CURLEC_INVESTOR_POOL_KEY_ID = "rzp_pool_key";
    process.env.CURLEC_INVESTOR_POOL_KEY_SECRET = "pool_secret";
    process.env.CURLEC_INVESTOR_POOL_WEBHOOK_SECRET = "pool_webhook";

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            id: "pay_operating",
            amount: 1000,
            currency: "MYR",
            status: "captured",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            id: "pay_pool",
            amount: 1000,
            currency: "MYR",
            status: "captured",
          }),
      });

    const operatingClient = createCurlecClient({ gatewayAccount: "OPERATING" });
    const poolClient = createCurlecClient({ gatewayAccount: "INVESTOR_POOL" });

    await operatingClient.fetchPayment("pay_operating");
    await poolClient.fetchPayment("pay_pool");

    const firstAuth = (global.fetch as jest.Mock).mock.calls[0]?.[1]?.headers?.Authorization;
    const secondAuth = (global.fetch as jest.Mock).mock.calls[1]?.[1]?.headers?.Authorization;

    expect(firstAuth).toContain(
      Buffer.from("rzp_operating_key:operating_secret").toString("base64")
    );
    expect(secondAuth).toContain(Buffer.from("rzp_pool_key:pool_secret").toString("base64"));
    expect(firstAuth).not.toBe(secondAuth);
  });

  it("keeps account-specific config isolated across client instances", async () => {
    process.env.CURLEC_OPERATING_KEY_ID = "rzp_operating_key";
    process.env.CURLEC_OPERATING_KEY_SECRET = "operating_secret";
    process.env.CURLEC_OPERATING_WEBHOOK_SECRET = "operating_webhook";
    process.env.CURLEC_INVESTOR_POOL_KEY_ID = "rzp_pool_key";
    process.env.CURLEC_INVESTOR_POOL_KEY_SECRET = "pool_secret";
    process.env.CURLEC_INVESTOR_POOL_WEBHOOK_SECRET = "pool_webhook";

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          id: "pay_any",
          amount: 1000,
          currency: "MYR",
          status: "captured",
        }),
    });

    const operatingClient = createCurlecClient({ gatewayAccount: "OPERATING" });
    const poolClient = createCurlecClient({ gatewayAccount: "INVESTOR_POOL" });

    await operatingClient.fetchPayment("pay_1");
    await poolClient.fetchPayment("pay_2");
    await operatingClient.fetchPayment("pay_3");

    const authHeaders = (global.fetch as jest.Mock).mock.calls.map(
      (call) => call?.[1]?.headers?.Authorization ?? ""
    );

    expect(authHeaders[0]).toContain(
      Buffer.from("rzp_operating_key:operating_secret").toString("base64")
    );
    expect(authHeaders[1]).toContain(Buffer.from("rzp_pool_key:pool_secret").toString("base64"));
    expect(authHeaders[2]).toContain(
      Buffer.from("rzp_operating_key:operating_secret").toString("base64")
    );
  });

  it("keeps existing createCurlecClient() callers on LEGACY_DEFAULT", async () => {
    process.env.CURLEC_KEY_ID = "rzp_legacy_key";
    process.env.CURLEC_KEY_SECRET = "legacy_secret";
    process.env.CURLEC_WEBHOOK_SECRET = "legacy_webhook";

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          id: "pay_legacy",
          amount: 1000,
          currency: "MYR",
          status: "captured",
        }),
    });

    const client = createCurlecClient();
    await client.fetchPayment("pay_legacy");

    const authHeader = (global.fetch as jest.Mock).mock.calls[0]?.[1]?.headers?.Authorization;
    expect(authHeader).toContain(Buffer.from("rzp_legacy_key:legacy_secret").toString("base64"));
    expect(client.getGatewayAccount()).toBe("LEGACY_DEFAULT");
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

  it("extracts payer name from FPX fpx_buyerName (Razorpay fetch-payment)", () => {
    expect(
      extractPayerNameFromPayment({
        id: "pay_1",
        amount: 100,
        currency: "MYR",
        status: "captured",
        bank: "HSBC",
        acquirer_data: {
          fpx_data: {
            fpx_buyerName: "Test name",
            fpx_debitAuthCode: "00",
            fpx_type: "N",
          },
        },
      })
    ).toBe("Test name");
  });

  it("returns null when FPX payload has no buyer name", () => {
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
