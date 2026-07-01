import express from "express";
import request from "supertest";
import {
  GatewayOrganizationType,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  InvestorBalanceTransactionSource,
  NameCheckResult,
  NoteLedgerDirection,
  OrganizationType,
  Prisma,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import { computeCurlecWebhookSignature } from "./curlec-signature";
import { processInvestorDepositCapture } from "./webhook-service";
import { curlecWebhookRouter } from "./webhook-controller";

const prisma = new PrismaClient();

const TEST_WEBHOOK_SECRET = "whsec_m5_integration_test";

const mockFetchPayment = jest.fn();
const mockFetchOrderPayments = jest.fn();
const mockRefundPayment = jest.fn();

jest.mock("../../config/curlec", () => ({
  getCurlecConfig: jest.fn(() => ({
    keyId: "rzp_test_key",
    keySecret: "rzp_test_secret",
    webhookSecret: "whsec_m5_integration_test",
    apiBaseUrl: "https://api.razorpay.com",
    environment: "sandbox" as const,
  })),
}));

jest.mock("./curlec-client", () => ({
  createCurlecClient: jest.fn(() => ({
    createOrder: jest.fn(),
    fetchPayment: (...args: unknown[]) => mockFetchPayment(...args),
    fetchOrderPayments: (...args: unknown[]) => mockFetchOrderPayments(...args),
    refundPayment: (...args: unknown[]) => mockRefundPayment(...args),
  })),
}));

function buildTestApp() {
  const app = express();
  app.use("/v1/webhooks", curlecWebhookRouter);
  return app;
}

async function gatewayTablesMigrated(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1 FROM gateway_payments LIMIT 1`;
    await prisma.$queryRaw`SELECT 1 FROM gateway_webhook_events LIMIT 1`;
    return true;
  } catch {
    return false;
  }
}

function signedWebhookRequest(
  app: express.Application,
  params: { rawBody: string; eventId: string }
) {
  const signature = computeCurlecWebhookSignature(params.rawBody, TEST_WEBHOOK_SECRET);
  return request(app)
    .post("/v1/webhooks/curlec")
    .set("Content-Type", "application/json")
    .set("X-Razorpay-Event-Id", params.eventId)
    .set("X-Razorpay-Signature", signature)
    .send(params.rawBody);
}

function buildCapturePayload(orderId: string, paymentId: string) {
  return JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: orderId,
        },
      },
    },
  });
}

const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

describeIntegration("investor deposit webhook processing (M5)", () => {
  let migrated = false;
  let userId = "";
  let orgId = "";
  let orderId = "";
  let paymentId = "";
  let gatewayPaymentId = "";
  const createdEventIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    migrated = await gatewayTablesMigrated();
    if (!migrated) return;

    const suffix = `${Date.now()}`.slice(-4);
    const user = await prisma.user.create({
      data: {
        user_id: `W${suffix}`.slice(0, 5),
        email: `deposit-webhook-${Date.now()}@example.com`,
        cognito_sub: `sub-wh-${Date.now()}`,
        cognito_username: `wh-${Date.now()}`,
        first_name: "Jane",
        last_name: "Doe",
        roles: [UserRole.INVESTOR],
        investor_account: ["PERSONAL"],
      },
    });
    userId = user.user_id;
    createdUserIds.push(userId);

    const org = await prisma.investorOrganization.create({
      data: {
        owner_user_id: userId,
        type: OrganizationType.PERSONAL,
        first_name: "Jane",
        last_name: "Doe",
        deposit_received: false,
      },
    });
    orgId = org.id;
    createdOrgIds.push(orgId);

    orderId = `order_m5_${Date.now()}`;
    paymentId = `pay_m5_${Date.now()}`;

    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        organization_type: GatewayOrganizationType.INVESTOR,
        investor_organization_id: orgId,
        amount: new Prisma.Decimal("250.000000"),
        currency: "MYR",
        status: GatewayPaymentStatus.CREATED,
        curlec_order_id: orderId,
        idempotency_key: `curlec:order:${orderId}`,
      },
    });
    gatewayPaymentId = payment.id;
    createdPaymentIds.push(gatewayPaymentId);
  });

  beforeEach(() => {
    mockFetchPayment.mockReset();
    mockFetchOrderPayments.mockReset();
    mockRefundPayment.mockReset();
    mockRefundPayment.mockResolvedValue({
      id: "rfnd_test_auto",
      amount: 25000,
      payment_id: paymentId,
      status: "processed",
    });
  });

  afterEach(async () => {
    if (!migrated) return;

    await prisma.noteLedgerEntry.deleteMany({
      where: { gateway_payment_id: gatewayPaymentId },
    });
    await prisma.investorBalanceTransaction.deleteMany({
      where: { investor_organization_id: orgId },
    });
    await prisma.investorBalance.deleteMany({
      where: { investor_organization_id: orgId },
    });
    if (createdEventIds.length > 0) {
      await prisma.gatewayWebhookEvent.deleteMany({
        where: { event_id: { in: createdEventIds } },
      });
      createdEventIds.length = 0;
    }

    await prisma.gatewayPayment.update({
      where: { id: gatewayPaymentId },
      data: {
        status: GatewayPaymentStatus.CREATED,
        curlec_payment_id: null,
        method: null,
        bank_code: null,
        payer_name: null,
        name_check_result: null,
        name_check_at: null,
        refund_reference: null,
        refund_initiated_by: null,
        refunded_at: null,
        refund_notes: null,
        metadata: Prisma.DbNull,
      },
    });
    await prisma.investorOrganization.update({
      where: { id: orgId },
      data: { deposit_received: false },
    });
  });

  afterAll(async () => {
    if (createdPaymentIds.length > 0) {
      await prisma.gatewayPayment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdOrgIds.length > 0) {
      await prisma.investorOrganization.deleteMany({ where: { id: { in: createdOrgIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { user_id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  async function postWebhook(eventId: string, payerName: string | null) {
    mockFetchPayment.mockResolvedValue({
      id: paymentId,
      amount: 25000,
      currency: "MYR",
      status: "captured",
      method: "fpx",
      order_id: orderId,
      bank: "MB2U",
      acquirer_data: payerName ? { account_holder_name: payerName } : {},
    });

    createdEventIds.push(eventId);
    const app = buildTestApp();
    return signedWebhookRequest(app, {
      eventId,
      rawBody: buildCapturePayload(orderId, paymentId),
    });
  }

  it("credits exactly once on matching payer name (PASS)", async () => {
    if (!migrated) return;

    const response = await postWebhook(`evt_m5_pass_${Date.now()}`, "Jane Doe");
    expect(response.status).toBe(200);

    const payment = await prisma.gatewayPayment.findUniqueOrThrow({
      where: { id: gatewayPaymentId },
    });
    expect(payment.status).toBe(GatewayPaymentStatus.COMPLETED);
    expect(payment.name_check_result).toBe(NameCheckResult.PASS);

    const org = await prisma.investorOrganization.findUniqueOrThrow({ where: { id: orgId } });
    expect(org.deposit_received).toBe(true);

    const balance = await prisma.investorBalance.findUnique({
      where: { investor_organization_id: orgId },
    });
    expect(balance?.available_amount.toNumber()).toBe(250);

    const balanceTxCount = await prisma.investorBalanceTransaction.count({
      where: {
        investor_organization_id: orgId,
        source: InvestorBalanceTransactionSource.GATEWAY_DEPOSIT,
      },
    });
    expect(balanceTxCount).toBe(1);

    const ledgerEntry = await prisma.noteLedgerEntry.findFirst({
      where: { gateway_payment_id: gatewayPaymentId },
    });
    expect(ledgerEntry?.direction).toBe(NoteLedgerDirection.CREDIT);
    expect(ledgerEntry?.amount.toNumber()).toBe(250);
  });

  it("dedupes duplicate webhook event_id without double credit", async () => {
    if (!migrated) return;

    const eventId = `evt_m5_dup_${Date.now()}`;
    mockFetchPayment.mockResolvedValue({
      id: paymentId,
      amount: 25000,
      currency: "MYR",
      status: "captured",
      method: "fpx",
      order_id: orderId,
      acquirer_data: { account_holder_name: "Jane Doe" },
    });
    createdEventIds.push(eventId);

    const app = buildTestApp();
    const rawBody = buildCapturePayload(orderId, paymentId);

    const first = await signedWebhookRequest(app, { eventId, rawBody });
    const second = await signedWebhookRequest(app, { eventId, rawBody });

    expect(first.status).toBe(200);
    expect(first.body.data.duplicate).toBe(false);
    expect(second.status).toBe(200);
    expect(second.body.data.duplicate).toBe(true);

    const balanceTxCount = await prisma.investorBalanceTransaction.count({
      where: {
        investor_organization_id: orgId,
        source: InvestorBalanceTransactionSource.GATEWAY_DEPOSIT,
      },
    });
    expect(balanceTxCount).toBe(1);
  });

  it("does not double-credit when a second event arrives after COMPLETED", async () => {
    if (!migrated) return;

    await postWebhook(`evt_m5_first_${Date.now()}`, "Jane Doe");

    const secondEventId = `evt_m5_replay_${Date.now()}`;
    const secondResponse = await postWebhook(secondEventId, "Jane Doe");
    expect(secondResponse.status).toBe(200);

    const balanceTxCount = await prisma.investorBalanceTransaction.count({
      where: {
        investor_organization_id: orgId,
        source: InvestorBalanceTransactionSource.GATEWAY_DEPOSIT,
      },
    });
    expect(balanceTxCount).toBe(1);
  });

  it("auto-refunds deposit on payer name mismatch without crediting", async () => {
    if (!migrated) return;

    const response = await postWebhook(`evt_m5_fail_${Date.now()}`, "Wrong Person");
    expect(response.status).toBe(200);

    const payment = await prisma.gatewayPayment.findUniqueOrThrow({
      where: { id: gatewayPaymentId },
    });
    expect(payment.status).toBe(GatewayPaymentStatus.REFUND_INITIATED);
    expect(payment.name_check_result).toBe(NameCheckResult.FAIL);
    expect(payment.refund_reference).toBe("rfnd_test_auto");
    expect(mockRefundPayment).toHaveBeenCalledTimes(1);

    const balanceTxCount = await prisma.investorBalanceTransaction.count({
      where: { investor_organization_id: orgId },
    });
    expect(balanceTxCount).toBe(0);

    const org = await prisma.investorOrganization.findUniqueOrThrow({ where: { id: orgId } });
    expect(org.deposit_received).toBe(false);
  });

  it("auto-refunds deposit on Curlec amount mismatch without crediting", async () => {
    if (!migrated) return;

    const eventId = `evt_m5_amount_mismatch_${Date.now()}`;
    mockFetchPayment.mockResolvedValue({
      id: paymentId,
      amount: 24999,
      currency: "MYR",
      status: "captured",
      method: "fpx",
      order_id: orderId,
      acquirer_data: { account_holder_name: "Jane Doe" },
    });
    createdEventIds.push(eventId);

    const app = buildTestApp();
    const response = await signedWebhookRequest(app, {
      eventId,
      rawBody: buildCapturePayload(orderId, paymentId),
    });
    expect(response.status).toBe(200);

    const payment = await prisma.gatewayPayment.findUniqueOrThrow({
      where: { id: gatewayPaymentId },
    });
    expect(payment.status).toBe(GatewayPaymentStatus.REFUND_INITIATED);
    expect(payment.metadata).toMatchObject({
      amountMismatch: {
        expectedSen: 25000,
        actualSen: 24999,
        curlecPaymentId: paymentId,
      },
    });
    expect(mockRefundPayment).toHaveBeenCalledTimes(1);

    const balanceTxCount = await prisma.investorBalanceTransaction.count({
      where: { investor_organization_id: orgId },
    });
    expect(balanceTxCount).toBe(0);

    const org = await prisma.investorOrganization.findUniqueOrThrow({ where: { id: orgId } });
    expect(org.deposit_received).toBe(false);
  });

  it("routes FPX-without-name deposits to name check review without refunding", async () => {
    if (!migrated) return;

    const response = await postWebhook(`evt_m5_unavail_${Date.now()}`, null);
    expect(response.status).toBe(200);

    const payment = await prisma.gatewayPayment.findUniqueOrThrow({
      where: { id: gatewayPaymentId },
    });
    expect(payment.status).toBe(GatewayPaymentStatus.NAME_CHECK_PENDING);
    expect(payment.name_check_result).toBe(NameCheckResult.NAME_UNAVAILABLE);
    expect(mockRefundPayment).not.toHaveBeenCalled();

    const balanceTxCount = await prisma.investorBalanceTransaction.count({
      where: { investor_organization_id: orgId },
    });
    expect(balanceTxCount).toBe(0);
  });

  it("routes ambiguous payer names to name check review without refunding", async () => {
    if (!migrated) return;

    await prisma.investorOrganization.update({
      where: { id: orgId },
      data: { first_name: "Jane", middle_name: "Marie", last_name: "Doe" },
    });

    const response = await postWebhook(`evt_m5_review_${Date.now()}`, "Jane Doe");
    expect(response.status).toBe(200);

    const payment = await prisma.gatewayPayment.findUniqueOrThrow({
      where: { id: gatewayPaymentId },
    });
    expect(payment.status).toBe(GatewayPaymentStatus.NAME_CHECK_PENDING);
    expect(payment.name_check_result).toBe(NameCheckResult.REVIEW);
    expect(mockRefundPayment).not.toHaveBeenCalled();

    await prisma.investorOrganization.update({
      where: { id: orgId },
      data: { middle_name: null },
    });
  });

  it("falls back to HELD when Curlec refund API fails", async () => {
    if (!migrated) return;

    mockRefundPayment.mockRejectedValueOnce(new Error("Curlec refund unavailable"));

    const response = await postWebhook(`evt_m5_refund_fail_${Date.now()}`, "Wrong Person");
    expect(response.status).toBe(200);

    const payment = await prisma.gatewayPayment.findUniqueOrThrow({
      where: { id: gatewayPaymentId },
    });
    expect(payment.status).toBe(GatewayPaymentStatus.HELD);
    expect(payment.name_check_result).toBe(NameCheckResult.FAIL);
  });

  it("credits only once under concurrent processing", async () => {
    if (!migrated) return;

    mockFetchPayment.mockResolvedValue({
      id: paymentId,
      amount: 25000,
      currency: "MYR",
      status: "captured",
      method: "fpx",
      order_id: orderId,
      acquirer_data: { account_holder_name: "Jane Doe" },
    });

    const eventId = `evt_m5_concurrent_${Date.now()}`;
    createdEventIds.push(eventId);

    await prisma.gatewayWebhookEvent.create({
      data: {
        event_id: eventId,
        event_type: "payment.captured",
        payload: JSON.parse(buildCapturePayload(orderId, paymentId)),
        signature_valid: true,
      },
    });

    await Promise.all([
      processInvestorDepositCapture({ orderId, paymentId, eventId }, prisma),
      processInvestorDepositCapture({ orderId, paymentId, eventId }, prisma),
    ]);

    const balanceTxCount = await prisma.investorBalanceTransaction.count({
      where: {
        investor_organization_id: orgId,
        source: InvestorBalanceTransactionSource.GATEWAY_DEPOSIT,
      },
    });
    expect(balanceTxCount).toBe(1);

    const payment = await prisma.gatewayPayment.findUniqueOrThrow({
      where: { id: gatewayPaymentId },
    });
    expect(payment.status).toBe(GatewayPaymentStatus.COMPLETED);
  });
});
