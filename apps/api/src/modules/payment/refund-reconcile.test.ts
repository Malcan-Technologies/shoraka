import { GatewayPaymentPurpose, GatewayPaymentStatus } from "@prisma/client";
import { reconcilePendingGatewayRefunds } from "./refund-service";
import { createCurlecClient } from "./curlec-client";

jest.mock("./curlec-client", () => ({
  createCurlecClient: jest.fn(),
}));

jest.mock("../../config/curlec", () => ({
  getCurlecConfig: jest.fn(() => ({
    gatewayAccount: "OPERATING",
    keyId: "key",
    keySecret: "secret",
    webhookSecret: "whsec",
    apiBaseUrl: "https://api.razorpay.com",
    environment: "sandbox",
  })),
}));

describe("reconcilePendingGatewayRefunds", () => {
  const fetchRefund = jest.fn();
  const fetchPaymentRefunds = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (createCurlecClient as jest.Mock).mockReturnValue({
      fetchRefund,
      fetchPaymentRefunds,
    });
  });

  it("keeps REFUND_INITIATED when Curlec still reports pending", async () => {
    const payment = {
      id: "gp_1",
      status: GatewayPaymentStatus.REFUND_INITIATED,
      purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
      gatewayAccount: "INVESTOR_POOL",
      refund_reference: "rfnd_1",
      curlec_payment_id: "pay_1",
      updated_at: new Date(),
    };

    const db = {
      gatewayPayment: {
        findMany: jest.fn().mockResolvedValue([payment]),
        update: jest.fn(),
      },
    };

    fetchRefund.mockResolvedValue({
      id: "rfnd_1",
      payment_id: "pay_1",
      amount: 100,
      status: "pending",
    });

    const result = await reconcilePendingGatewayRefunds(db as never, 10);

    expect(result).toMatchObject({
      scanned: 1,
      refunded: 0,
      held: 0,
      pending: 1,
    });
    expect(fetchRefund).toHaveBeenCalledWith("rfnd_1");
  });

  it("does not invent a time-based failure when refund id is missing", async () => {
    const payment = {
      id: "gp_2",
      status: GatewayPaymentStatus.REFUND_INITIATED,
      purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
      gatewayAccount: "OPERATING",
      refund_reference: null,
      curlec_payment_id: "pay_2",
      updated_at: new Date(),
    };

    const db = {
      gatewayPayment: {
        findMany: jest.fn().mockResolvedValue([payment]),
        update: jest.fn(),
      },
    };

    fetchPaymentRefunds.mockResolvedValue([]);

    const result = await reconcilePendingGatewayRefunds(db as never, 10);

    expect(result.pending).toBe(1);
    expect(result.held).toBe(0);
    expect(result.refunded).toBe(0);
  });
});
