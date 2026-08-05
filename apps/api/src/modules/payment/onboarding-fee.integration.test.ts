import {
  GatewayOrganizationType,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  NoteLedgerDirection,
  OrganizationType,
  Prisma,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import { RegTankService } from "../regtank/service";
import {
  createIssuerOnboardingFee,
  getIssuerOnboardingFeeStatus,
  getIssuerOnboardingFee,
} from "./onboarding-fee-service";
import { createCurlecClient } from "./curlec-client";
import { getCurlecConfig } from "../../config/curlec";
import { processOnboardingFeeCapture, processStoredCurlecWebhook } from "./webhook-service";

jest.mock("./curlec-client", () => {
  let orderCounter = 0;
  return {
    createCurlecClient: jest.fn(() => ({
      createOrder: jest.fn(async () => {
        orderCounter += 1;
        return {
          id: `order_test_m8_${orderCounter}`,
          amount: 15000,
          currency: "MYR",
          status: "created",
        };
      }),
      fetchPayment: jest.fn(async (paymentId: string) => ({
        id: paymentId,
        amount: 15000,
        currency: "MYR",
        status: "captured",
        method: "fpx",
        order_id: null,
      })),
      fetchOrderPayments: jest.fn(async () => []),
      refundPayment: jest.fn(async () => ({
        id: `rfnd_test_${Date.now()}`,
        amount: 15000,
        currency: "MYR",
        status: "processed",
      })),
    })),
  };
});

jest.mock("../../config/curlec", () => {
  const keyByAccount: Record<string, string> = {
    OPERATING: "rzp_test_operating_key",
    INVESTOR_POOL: "rzp_test_pool_key",
  };
  return {
    getCurlecConfig: jest.fn((gatewayAccount: string = "OPERATING") => ({
      gatewayAccount,
      keyId: keyByAccount[gatewayAccount] ?? "rzp_test_unknown_key",
      keySecret: "secret",
      webhookSecret: "whsec",
      apiBaseUrl: "https://api.razorpay.com",
      environment: "sandbox" as const,
    })),
  };
});

const prisma = new PrismaClient();
const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

describeIntegration("issuer onboarding fee (M8)", () => {
  let curlecOrderCounter = 0;
  let migrated = false;
  let userId = "";
  let orgId = "";
  const createdPaymentIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdRegTankIds: string[] = [];
  const createdEventIds: string[] = [];

  async function seedCaptureWebhookEvent(eventId: string, orderId: string, paymentId: string) {
    createdEventIds.push(eventId);
    await prisma.gatewayWebhookEvent.create({
      data: {
        event_id: eventId,
        event_type: "payment.captured",
        gatewayAccount: "OPERATING",
        payload: {
          event: "payment.captured",
          payload: { payment: { entity: { id: paymentId, order_id: orderId } } },
        },
        signature_valid: true,
      },
    });
  }

  async function seedOrderPaidWebhookEvent(eventId: string, orderId: string) {
    createdEventIds.push(eventId);
    await prisma.gatewayWebhookEvent.create({
      data: {
        event_id: eventId,
        event_type: "order.paid",
        gatewayAccount: "OPERATING",
        payload: {
          event: "order.paid",
          payload: { order: { entity: { id: orderId } } },
        },
        signature_valid: true,
      },
    });
  }

  function buildDefaultCurlecClient() {
    return {
      createOrder: jest.fn(async () => {
        curlecOrderCounter += 1;
        return {
          id: `order_test_m8_${curlecOrderCounter}`,
          amount: 15000,
          currency: "MYR",
          status: "created",
        };
      }),
      fetchPayment: jest.fn(async (paymentId: string) => ({
        id: paymentId,
        amount: 15000,
        currency: "MYR",
        status: "captured",
        method: "fpx",
        order_id: null,
      })),
      fetchOrderPayments: jest.fn(async () => []),
      // Amount-mismatch auto-refund and wallet-reversal recovery create a second client.
      refundPayment: jest.fn(async () => ({
        id: `rfnd_default_${Date.now()}`,
        amount: 15000,
        currency: "MYR",
        status: "processed",
      })),
      fetchRefund: jest.fn(async (refundId: string) => ({
        id: refundId,
        amount: 15000,
        currency: "MYR",
        status: "processed",
      })),
      fetchPaymentRefunds: jest.fn(async () => []),
    };
  }

  beforeEach(() => {
    const mockedCreateCurlecClient = createCurlecClient as jest.Mock;
    mockedCreateCurlecClient.mockReset();
    mockedCreateCurlecClient.mockImplementation(() => buildDefaultCurlecClient());
  });

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1 FROM gateway_payments LIMIT 1`;
      migrated = true;
    } catch {
      migrated = false;
    }

    if (!migrated) return;

    const suffix = `${Date.now()}`.slice(-4);
    const user = await prisma.user.create({
      data: {
        user_id: `F${suffix}`.slice(0, 5),
        email: `onboarding-fee-${Date.now()}@example.com`,
        cognito_sub: `sub-fee-${Date.now()}`,
        cognito_username: `fee-${Date.now()}`,
        first_name: "Acme",
        last_name: "Issuer",
        roles: [UserRole.ISSUER],
        issuer_account: ["COMPANY"],
      },
    });
    userId = user.user_id;
    createdUserIds.push(userId);

    const org = await prisma.issuerOrganization.create({
      data: {
        owner_user_id: userId,
        type: OrganizationType.COMPANY,
        name: "Acme Corp",
        tnc_accepted: true,
      },
    });
    orgId = org.id;
    createdOrgIds.push(orgId);

    await prisma.platformFinanceSetting.upsert({
      where: { key: "DEFAULT" },
      update: {
        issuer_onboarding_fee_amount: new Prisma.Decimal("150.000000"),
      },
      create: {
        key: "DEFAULT",
        issuer_onboarding_fee_amount: new Prisma.Decimal("150.000000"),
      },
    });
  });

  afterAll(async () => {
    if (createdEventIds.length > 0) {
      await prisma.gatewayWebhookEvent.deleteMany({ where: { event_id: { in: createdEventIds } } });
    }
    if (createdRegTankIds.length > 0) {
      await prisma.regTankOnboarding.deleteMany({ where: { id: { in: createdRegTankIds } } });
    }
    if (createdPaymentIds.length > 0) {
      await prisma.noteLedgerEntry.deleteMany({
        where: { gateway_payment_id: { in: createdPaymentIds } },
      });
      await prisma.gatewayPayment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdOrgIds.length > 0) {
      await prisma.issuerOrganization.deleteMany({ where: { id: { in: createdOrgIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { user_id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  it("creates a CREATED gateway payment with server-derived amount", async () => {
    if (!migrated) return;

    const result = await createIssuerOnboardingFee(
      { userId },
      { issuerOrganizationId: orgId },
      prisma
    );
    createdPaymentIds.push(result.id);

    expect(result.status).toBe(GatewayPaymentStatus.CREATED);
    expect(result.amount).toBe(150);
    expect(result.curlecOrderId).toBe("order_test_m8_1");
    expect(result.gatewayAccount).toBe("OPERATING");
    expect(result.curlecKeyId).toBe("rzp_test_operating_key");

    const stored = await prisma.gatewayPayment.findUnique({ where: { id: result.id } });
    expect(stored?.purpose).toBe(GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE);
    expect(stored?.organization_type).toBe(GatewayOrganizationType.ISSUER);
    expect(stored?.gatewayAccount).toBe("OPERATING");
    expect((createCurlecClient as jest.Mock).mock.calls.at(-1)?.[0]).toEqual({
      gatewayAccount: "OPERATING",
    });
  });

  it("reuses existing OPERATING issuer fee payment without replacing account", async () => {
    if (!migrated) return;

    const legacy = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        organization_type: GatewayOrganizationType.ISSUER,
        gatewayAccount: "OPERATING",
        issuer_organization_id: orgId,
        amount: new Prisma.Decimal("150.000000"),
        status: GatewayPaymentStatus.CREATED,
        curlec_order_id: `order_legacy_fee_${Date.now()}`,
        idempotency_key: `legacy-fee:${Date.now()}`,
      },
    });
    createdPaymentIds.push(legacy.id);
    const createCallsBefore = (createCurlecClient as jest.Mock).mock.calls.length;

    const result = await createIssuerOnboardingFee({ userId }, { issuerOrganizationId: orgId }, prisma);

    expect(result.id).toBe(legacy.id);
    expect(result.gatewayAccount).toBe("OPERATING");
    expect(result.curlecOrderId).toBe(legacy.curlec_order_id);
    expect((createCurlecClient as jest.Mock).mock.calls.length).toBe(createCallsBefore);
  });

  it("reuses existing OPERATING issuer fee payment without changing account", async () => {
    if (!migrated) return;

    await prisma.gatewayPayment.updateMany({
      where: {
        issuer_organization_id: orgId,
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
      },
      data: { status: GatewayPaymentStatus.FAILED },
    });

    const operating = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        organization_type: GatewayOrganizationType.ISSUER,
        gatewayAccount: "OPERATING",
        issuer_organization_id: orgId,
        amount: new Prisma.Decimal("150.000000"),
        status: GatewayPaymentStatus.CREATED,
        curlec_order_id: `order_operating_fee_${Date.now()}`,
        idempotency_key: `operating-fee:${Date.now()}`,
      },
    });
    createdPaymentIds.push(operating.id);
    const createCallsBefore = (createCurlecClient as jest.Mock).mock.calls.length;

    const result = await createIssuerOnboardingFee({ userId }, { issuerOrganizationId: orgId }, prisma);

    expect(result.id).toBe(operating.id);
    expect(result.gatewayAccount).toBe("OPERATING");
    expect((createCurlecClient as jest.Mock).mock.calls.length).toBe(createCallsBefore);
  });

  it("fails clearly when OPERATING credentials are missing and does not create payment", async () => {
    if (!migrated) return;

    await prisma.gatewayPayment.updateMany({
      where: {
        issuer_organization_id: orgId,
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
      },
      data: { status: GatewayPaymentStatus.FAILED },
    });

    const beforeCount = await prisma.gatewayPayment.count({
      where: {
        issuer_organization_id: orgId,
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
      },
    });

    const configMock = getCurlecConfig as jest.Mock;
    const originalImpl = configMock.getMockImplementation();
    configMock.mockImplementation((gatewayAccount: string = "OPERATING") => {
      if (gatewayAccount === "OPERATING") {
        throw new Error(
          "Curlec OPERATING credentials are required. Missing: CURLEC_OPERATING_KEY_ID."
        );
      }
      return {
        gatewayAccount,
        keyId: "rzp_test_legacy_key",
        keySecret: "secret",
        webhookSecret: "whsec",
        apiBaseUrl: "https://api.razorpay.com",
        environment: "sandbox" as const,
      };
    });

    await expect(
      createIssuerOnboardingFee({ userId }, { issuerOrganizationId: orgId }, prisma)
    ).rejects.toMatchObject({
      code: "CURLEC_ACCOUNT_CONFIG_ERROR",
    });

    if (originalImpl) {
      configMock.mockImplementation(originalImpl);
    }

    const afterCount = await prisma.gatewayPayment.count({
      where: {
        issuer_organization_id: orgId,
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
      },
    });
    expect(afterCount).toBe(beforeCount);
  });

  it("returns existing payment on duplicate create (no second order)", async () => {
    if (!migrated) return;

    const first = await createIssuerOnboardingFee(
      { userId },
      { issuerOrganizationId: orgId },
      prisma
    );
    const second = await createIssuerOnboardingFee(
      { userId },
      { issuerOrganizationId: orgId },
      prisma
    );

    expect(second.id).toBe(first.id);

    const count = await prisma.gatewayPayment.count({
      where: {
        curlec_order_id: first.curlecOrderId,
      },
    });
    expect(count).toBe(1);
  });

  it("OPERATING webhook account processes OPERATING onboarding payment", async () => {
    if (!migrated) return;

    const created = await createIssuerOnboardingFee({ userId }, { issuerOrganizationId: orgId }, prisma);
    createdPaymentIds.push(created.id);
    const payment = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: created.id } });

    const eventId = `evt_m8_operating_${Date.now()}`;
    createdEventIds.push(eventId);
    await prisma.gatewayWebhookEvent.create({
      data: {
        event_id: eventId,
        event_type: "payment.captured",
        gatewayAccount: "OPERATING",
        payload: {
          event: "payment.captured",
          payload: { payment: { entity: { id: `pay_m8_op_${Date.now()}`, order_id: payment.curlec_order_id } } },
        },
        signature_valid: true,
      },
    });

    await processStoredCurlecWebhook(eventId, prisma, "OPERATING");

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: created.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.COMPLETED);
    expect(updated.gatewayAccount).toBe("OPERATING");
  });

  it("status read does not create payment rows on page-load style calls", async () => {
    if (!migrated) return;

    await prisma.gatewayPayment.updateMany({
      where: {
        issuer_organization_id: orgId,
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
      },
      data: { status: GatewayPaymentStatus.EXPIRED },
    });

    const beforeCount = await prisma.gatewayPayment.count({
      where: {
        issuer_organization_id: orgId,
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
      },
    });

    const statusA = await getIssuerOnboardingFeeStatus({ userId }, orgId, prisma);
    const statusB = await getIssuerOnboardingFeeStatus({ userId }, orgId, prisma);

    const afterCount = await prisma.gatewayPayment.count({
      where: {
        issuer_organization_id: orgId,
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
      },
    });

    expect(statusA.amount).toBe(150);
    expect(statusB.amount).toBe(150);
    expect(afterCount).toBe(beforeCount);
  });

  it("dedupes concurrent create calls to one active onboarding fee payment", async () => {
    if (!migrated) return;

    await prisma.gatewayPayment.updateMany({
      where: {
        issuer_organization_id: orgId,
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        status: { in: [GatewayPaymentStatus.CREATED, GatewayPaymentStatus.PAID] },
      },
      data: { status: GatewayPaymentStatus.FAILED },
    });

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        createIssuerOnboardingFee({ userId }, { issuerOrganizationId: orgId }, prisma)
      )
    );

    const uniquePaymentIds = new Set(results.map((entry) => entry.id));
    expect(uniquePaymentIds.size).toBe(1);

    const activeCount = await prisma.gatewayPayment.count({
      where: {
        issuer_organization_id: orgId,
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        status: { in: [GatewayPaymentStatus.CREATED, GatewayPaymentStatus.PAID] },
      },
    });
    expect(activeCount).toBe(1);
  });

  it("does not reuse EXPIRED onboarding fee payments and creates a fresh order", async () => {
    if (!migrated) return;

    const first = await createIssuerOnboardingFee({ userId }, { issuerOrganizationId: orgId }, prisma);
    await prisma.gatewayPayment.update({
      where: { id: first.id },
      data: { status: GatewayPaymentStatus.EXPIRED },
    });

    const second = await createIssuerOnboardingFee({ userId }, { issuerOrganizationId: orgId }, prisma);
    createdPaymentIds.push(first.id, second.id);

    expect(second.id).not.toBe(first.id);
    expect(second.curlecOrderId).not.toBe(first.curlecOrderId);
    expect(second.status).toBe(GatewayPaymentStatus.CREATED);
  });

  it("does not reuse FAILED onboarding fee payments and creates a fresh order", async () => {
    if (!migrated) return;

    const first = await createIssuerOnboardingFee({ userId }, { issuerOrganizationId: orgId }, prisma);
    await prisma.gatewayPayment.update({
      where: { id: first.id },
      data: { status: GatewayPaymentStatus.FAILED },
    });

    const second = await createIssuerOnboardingFee({ userId }, { issuerOrganizationId: orgId }, prisma);
    createdPaymentIds.push(first.id, second.id);

    expect(second.id).not.toBe(first.id);
    expect(second.curlecOrderId).not.toBe(first.curlecOrderId);
  });

  it("reuses COMPLETED onboarding fee as proof of payment", async () => {
    if (!migrated) return;

    const created = await createIssuerOnboardingFee(
      { userId },
      { issuerOrganizationId: orgId },
      prisma
    );
    await prisma.gatewayPayment.update({
      where: { id: created.id },
      data: { status: GatewayPaymentStatus.COMPLETED },
    });
    await prisma.issuerOrganization.update({
      where: { id: orgId },
      data: { onboarding_fee_paid_at: new Date() },
    });

    const result = await createIssuerOnboardingFee({ userId }, { issuerOrganizationId: orgId }, prisma);
    createdPaymentIds.push(created.id);

    expect(result.id).toBe(created.id);
    expect(result.status).toBe(GatewayPaymentStatus.COMPLETED);
  });

  it("blocks fee create when TNC not accepted", async () => {
    if (!migrated) return;

    const suffix = `${Date.now()}`.slice(-4);
    const tncUser = await prisma.user.create({
      data: {
        user_id: `T${suffix}`.slice(0, 5),
        email: `tnc-fee-${Date.now()}@example.com`,
        cognito_sub: `sub-tnc-${Date.now()}`,
        cognito_username: `tnc-${Date.now()}`,
        first_name: "Tnc",
        last_name: "Gate",
        roles: [UserRole.ISSUER],
        issuer_account: ["COMPANY"],
      },
    });
    createdUserIds.push(tncUser.user_id);

    const tncOrg = await prisma.issuerOrganization.create({
      data: {
        owner_user_id: tncUser.user_id,
        type: OrganizationType.COMPANY,
        name: "TNC Gate Corp",
        tnc_accepted: false,
      },
    });
    createdOrgIds.push(tncOrg.id);

    await expect(
      createIssuerOnboardingFee({ userId: tncUser.user_id }, { issuerOrganizationId: tncOrg.id }, prisma)
    ).rejects.toMatchObject({ code: "TNC_REQUIRED" });
  });

  it("blocks IDOR on fee lookup", async () => {
    if (!migrated) return;

    const created = await createIssuerOnboardingFee(
      { userId },
      { issuerOrganizationId: orgId },
      prisma
    );

    await expect(
      getIssuerOnboardingFee({ userId: "other-user" }, created.id, prisma)
    ).rejects.toMatchObject({ code: "ONBOARDING_FEE_NOT_FOUND" });
  });

  it("completes fee on webhook capture and posts operating ledger exactly once", async () => {
    if (!migrated) return;

    await prisma.issuerOrganization.update({
      where: { id: orgId },
      data: { onboarding_fee_paid_at: null },
    });
    await prisma.gatewayPayment.updateMany({
      where: {
        issuer_organization_id: orgId,
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        status: GatewayPaymentStatus.COMPLETED,
      },
      data: { status: GatewayPaymentStatus.FAILED },
    });

    const created = await createIssuerOnboardingFee(
      { userId },
      { issuerOrganizationId: orgId },
      prisma
    );
    createdPaymentIds.push(created.id);
    const payment = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: created.id } });

    const orderId = payment.curlec_order_id;
    const paymentId = `pay_m8_${Date.now()}`;
    const eventId = `evt_m8_${Date.now()}`;

    await seedCaptureWebhookEvent(eventId, orderId, paymentId);
    await processOnboardingFeeCapture(
      { orderId, paymentId, eventId, routeGatewayAccount: "OPERATING" },
      prisma
    );

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.COMPLETED);

    const org = await prisma.issuerOrganization.findUniqueOrThrow({ where: { id: orgId } });
    expect(org.onboarding_fee_paid_at).not.toBeNull();

    const ledgerEntry = await prisma.noteLedgerEntry.findFirst({
      where: { gateway_payment_id: payment.id },
    });
    expect(ledgerEntry?.direction).toBe(NoteLedgerDirection.CREDIT);
    expect(ledgerEntry?.amount.toNumber()).toBe(150);

    const ledgerCount = await prisma.noteLedgerEntry.count({
      where: { idempotency_key: `gateway-onboarding-fee:ledger:${payment.id}` },
    });
    expect(ledgerCount).toBe(1);

    const replayEventId = `evt_m8_replay_${Date.now()}`;
    await seedCaptureWebhookEvent(replayEventId, orderId, `pay_m8_replay_${Date.now()}`);
    await processOnboardingFeeCapture(
      {
        orderId,
        paymentId: `pay_m8_replay_${Date.now()}`,
        eventId: replayEventId,
        routeGatewayAccount: "OPERATING",
      },
      prisma
    );

    const ledgerCountAfterReplay = await prisma.noteLedgerEntry.count({
      where: { gateway_payment_id: payment.id },
    });
    expect(ledgerCountAfterReplay).toBe(1);
  });

  it("recovers a valid late capture after local EXPIRED exactly once", async () => {
    if (!migrated) return;

    const created = await createIssuerOnboardingFee(
      { userId },
      { issuerOrganizationId: orgId },
      prisma
    );
    createdPaymentIds.push(created.id);

    await prisma.gatewayPayment.update({
      where: { id: created.id },
      data: { status: GatewayPaymentStatus.EXPIRED },
    });

    const eventId = `evt_m8_expired_capture_${Date.now()}`;
    await seedCaptureWebhookEvent(eventId, created.curlecOrderId, `pay_m8_expired_${Date.now()}`);
    await processOnboardingFeeCapture(
      {
        orderId: created.curlecOrderId,
        paymentId: `pay_m8_expired_${Date.now()}`,
        eventId,
        routeGatewayAccount: "OPERATING",
      },
      prisma
    );

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: created.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.COMPLETED);

    const replayEventId = `evt_m8_expired_capture_replay_${Date.now()}`;
    await seedCaptureWebhookEvent(
      replayEventId,
      created.curlecOrderId,
      `pay_m8_expired_replay_${Date.now()}`
    );
    await processOnboardingFeeCapture(
      {
        orderId: created.curlecOrderId,
        paymentId: `pay_m8_expired_replay_${Date.now()}`,
        eventId: replayEventId,
        routeGatewayAccount: "OPERATING",
      },
      prisma
    );

    const ledgerCount = await prisma.noteLedgerEntry.count({
      where: { idempotency_key: `gateway-onboarding-fee:ledger:${created.id}` },
    });
    expect(ledgerCount).toBe(1);
  });

  it("rejects late capture when captured currency does not match", async () => {
    if (!migrated) return;

    const created = await createIssuerOnboardingFee(
      { userId },
      { issuerOrganizationId: orgId },
      prisma
    );
    createdPaymentIds.push(created.id);

    await prisma.gatewayPayment.update({
      where: { id: created.id },
      data: { status: GatewayPaymentStatus.EXPIRED },
    });

    const mockedCreateCurlecClient = createCurlecClient as jest.Mock;
    mockedCreateCurlecClient.mockReturnValueOnce({
      createOrder: jest.fn(),
      fetchPayment: jest.fn(async (paymentId: string) => ({
        id: paymentId,
        amount: 15000,
        currency: "USD",
        status: "captured",
        method: "fpx",
        order_id: created.curlecOrderId,
      })),
      fetchOrderPayments: jest.fn(async () => []),
    });

    const eventId = `evt_m8_currency_mismatch_${Date.now()}`;
    await seedCaptureWebhookEvent(eventId, created.curlecOrderId, `pay_m8_currency_${Date.now()}`);
    await processOnboardingFeeCapture(
      {
        orderId: created.curlecOrderId,
        paymentId: `pay_m8_currency_${Date.now()}`,
        eventId,
        routeGatewayAccount: "OPERATING",
      },
      prisma
    );

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: created.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.HELD);
    expect((updated.metadata as Record<string, unknown>).captureMismatch).toMatchObject({
      mismatchType: "CURRENCY_MISMATCH",
    });
    // Clear held mismatch so later shared-org tests can create new orders.
    await prisma.gatewayPayment.update({
      where: { id: created.id },
      data: { status: GatewayPaymentStatus.FAILED },
    });
  });

  it("rejects late capture when Curlec payment belongs to another order", async () => {
    if (!migrated) return;

    const created = await createIssuerOnboardingFee(
      { userId },
      { issuerOrganizationId: orgId },
      prisma
    );
    createdPaymentIds.push(created.id);

    await prisma.gatewayPayment.update({
      where: { id: created.id },
      data: { status: GatewayPaymentStatus.EXPIRED },
    });

    const mockedCreateCurlecClient = createCurlecClient as jest.Mock;
    mockedCreateCurlecClient.mockReturnValueOnce({
      createOrder: jest.fn(),
      fetchPayment: jest.fn(async (paymentId: string) => ({
        id: paymentId,
        amount: 15000,
        currency: "MYR",
        status: "captured",
        method: "fpx",
        order_id: `order_mismatch_${Date.now()}`,
      })),
      fetchOrderPayments: jest.fn(async () => []),
    });

    const eventId = `evt_m8_order_mismatch_${Date.now()}`;
    await seedCaptureWebhookEvent(eventId, created.curlecOrderId, `pay_m8_order_${Date.now()}`);
    await processOnboardingFeeCapture(
      {
        orderId: created.curlecOrderId,
        paymentId: `pay_m8_order_${Date.now()}`,
        eventId,
        routeGatewayAccount: "OPERATING",
      },
      prisma
    );

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: created.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.HELD);
    expect((updated.metadata as Record<string, unknown>).captureMismatch).toMatchObject({
      mismatchType: "ORDER_MISMATCH",
    });
    await prisma.gatewayPayment.update({
      where: { id: created.id },
      data: { status: GatewayPaymentStatus.FAILED },
    });
  });

  it("normal order.paid completes an active CREATED onboarding fee payment", async () => {
    if (!migrated) return;

    await prisma.issuerOrganization.update({
      where: { id: orgId },
      data: { onboarding_fee_paid_at: null },
    });
    await prisma.gatewayPayment.updateMany({
      where: {
        issuer_organization_id: orgId,
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        status: { in: [GatewayPaymentStatus.COMPLETED, GatewayPaymentStatus.HELD] },
      },
      data: { status: GatewayPaymentStatus.FAILED },
    });

    const created = await createIssuerOnboardingFee(
      { userId },
      { issuerOrganizationId: orgId },
      prisma
    );
    createdPaymentIds.push(created.id);

    const paymentId = `pay_m8_order_paid_${Date.now()}`;
    const eventId = `evt_m8_order_paid_${Date.now()}`;
    const mockedCreateCurlecClient = createCurlecClient as jest.Mock;
    mockedCreateCurlecClient
      .mockReturnValueOnce({
        createOrder: jest.fn(),
        fetchOrderPayments: jest.fn(async () => [
          {
            id: paymentId,
            amount: 15000,
            currency: "MYR",
            status: "captured",
            method: "fpx",
            order_id: created.curlecOrderId,
          },
        ]),
        fetchPayment: jest.fn(),
      })
      .mockReturnValueOnce({
        createOrder: jest.fn(),
        fetchOrderPayments: jest.fn(async () => []),
        fetchPayment: jest.fn(async () => ({
          id: paymentId,
          amount: 15000,
          currency: "MYR",
          status: "captured",
          method: "fpx",
          order_id: created.curlecOrderId,
        })),
      });

    await seedOrderPaidWebhookEvent(eventId, created.curlecOrderId);
    await processStoredCurlecWebhook(eventId, prisma, "OPERATING");

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: created.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.COMPLETED);
  });

  it("order.paid after local EXPIRED recovers once when amount/currency/order/payment match", async () => {
    if (!migrated) return;

    const created = await createIssuerOnboardingFee(
      { userId },
      { issuerOrganizationId: orgId },
      prisma
    );
    createdPaymentIds.push(created.id);
    await prisma.gatewayPayment.update({
      where: { id: created.id },
      data: { status: GatewayPaymentStatus.EXPIRED },
    });

    const paymentId = `pay_m8_order_paid_expired_${Date.now()}`;
    const eventId = `evt_m8_order_paid_expired_${Date.now()}`;
    const replayEventId = `evt_m8_order_paid_expired_replay_${Date.now()}`;
    const mockedCreateCurlecClient = createCurlecClient as jest.Mock;
    mockedCreateCurlecClient
      .mockReturnValueOnce({
        createOrder: jest.fn(),
        fetchOrderPayments: jest.fn(async () => [
          {
            id: paymentId,
            amount: 15000,
            currency: "MYR",
            status: "captured",
            method: "fpx",
            order_id: created.curlecOrderId,
          },
        ]),
        fetchPayment: jest.fn(),
      })
      .mockReturnValueOnce({
        createOrder: jest.fn(),
        fetchOrderPayments: jest.fn(async () => []),
        fetchPayment: jest.fn(async () => ({
          id: paymentId,
          amount: 15000,
          currency: "MYR",
          status: "captured",
          method: "fpx",
          order_id: created.curlecOrderId,
        })),
      });

    await seedOrderPaidWebhookEvent(eventId, created.curlecOrderId);
    await processStoredCurlecWebhook(eventId, prisma, "OPERATING");

    const afterFirst = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: created.id } });
    expect(afterFirst.status).toBe(GatewayPaymentStatus.COMPLETED);

    await seedOrderPaidWebhookEvent(replayEventId, created.curlecOrderId);
    await processStoredCurlecWebhook(replayEventId, prisma, "OPERATING");

    const ledgerCount = await prisma.noteLedgerEntry.count({
      where: { idempotency_key: `gateway-onboarding-fee:ledger:${created.id}` },
    });
    expect(ledgerCount).toBe(1);
  });

  it("payment.captured followed by order.paid for the same curlec_payment_id does not process twice", async () => {
    if (!migrated) return;

    const created = await createIssuerOnboardingFee(
      { userId },
      { issuerOrganizationId: orgId },
      prisma
    );
    createdPaymentIds.push(created.id);

    const paymentId = `pay_m8_sequence_1_${Date.now()}`;
    const captureEventId = `evt_m8_sequence_capture_${Date.now()}`;
    const orderPaidEventId = `evt_m8_sequence_order_paid_${Date.now()}`;
    await seedCaptureWebhookEvent(captureEventId, created.curlecOrderId, paymentId);
    await processStoredCurlecWebhook(captureEventId, prisma, "OPERATING");

    const mockedCreateCurlecClient = createCurlecClient as jest.Mock;
    mockedCreateCurlecClient.mockReturnValueOnce({
      createOrder: jest.fn(),
      fetchOrderPayments: jest.fn(async () => [
        {
          id: paymentId,
          amount: 15000,
          currency: "MYR",
          status: "captured",
          method: "fpx",
          order_id: created.curlecOrderId,
        },
      ]),
      fetchPayment: jest.fn(),
    });
    await seedOrderPaidWebhookEvent(orderPaidEventId, created.curlecOrderId);
    await processStoredCurlecWebhook(orderPaidEventId, prisma, "OPERATING");

    const ledgerCount = await prisma.noteLedgerEntry.count({
      where: { idempotency_key: `gateway-onboarding-fee:ledger:${created.id}` },
    });
    expect(ledgerCount).toBe(1);
  });

  it("order.paid followed by payment.captured for the same curlec_payment_id does not process twice", async () => {
    if (!migrated) return;

    const created = await createIssuerOnboardingFee(
      { userId },
      { issuerOrganizationId: orgId },
      prisma
    );
    createdPaymentIds.push(created.id);

    const paymentId = `pay_m8_sequence_2_${Date.now()}`;
    const orderPaidEventId = `evt_m8_sequence_order_paid_first_${Date.now()}`;
    const captureEventId = `evt_m8_sequence_capture_second_${Date.now()}`;
    const mockedCreateCurlecClient = createCurlecClient as jest.Mock;
    mockedCreateCurlecClient
      .mockReturnValueOnce({
        createOrder: jest.fn(),
        fetchOrderPayments: jest.fn(async () => [
          {
            id: paymentId,
            amount: 15000,
            currency: "MYR",
            status: "captured",
            method: "fpx",
            order_id: created.curlecOrderId,
          },
        ]),
        fetchPayment: jest.fn(),
      })
      .mockReturnValueOnce({
        createOrder: jest.fn(),
        fetchOrderPayments: jest.fn(async () => []),
        fetchPayment: jest.fn(async () => ({
          id: paymentId,
          amount: 15000,
          currency: "MYR",
          status: "captured",
          method: "fpx",
          order_id: created.curlecOrderId,
        })),
      });

    await seedOrderPaidWebhookEvent(orderPaidEventId, created.curlecOrderId);
    await processStoredCurlecWebhook(orderPaidEventId, prisma, "OPERATING");
    await seedCaptureWebhookEvent(captureEventId, created.curlecOrderId, paymentId);
    await processStoredCurlecWebhook(captureEventId, prisma, "OPERATING");

    const ledgerCount = await prisma.noteLedgerEntry.count({
      where: { idempotency_key: `gateway-onboarding-fee:ledger:${created.id}` },
    });
    expect(ledgerCount).toBe(1);
  });

  it("order.paid with wrong amount/currency/order is rejected or held safely", async () => {
    if (!migrated) return;

    await prisma.issuerOrganization.update({
      where: { id: orgId },
      data: { onboarding_fee_paid_at: null },
    });
    await prisma.gatewayPayment.updateMany({
      where: {
        issuer_organization_id: orgId,
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        status: {
          in: [
            GatewayPaymentStatus.COMPLETED,
            GatewayPaymentStatus.HELD,
          ],
        },
      },
      data: { status: GatewayPaymentStatus.FAILED },
    });

    const created = await createIssuerOnboardingFee(
      { userId },
      { issuerOrganizationId: orgId },
      prisma
    );
    createdPaymentIds.push(created.id);

    const paymentId = `pay_m8_order_paid_bad_${Date.now()}`;
    const eventId = `evt_m8_order_paid_bad_${Date.now()}`;
    const mockedCreateCurlecClient = createCurlecClient as jest.Mock;
    mockedCreateCurlecClient
      .mockReturnValueOnce({
        createOrder: jest.fn(),
        fetchOrderPayments: jest.fn(async () => [
          {
            id: paymentId,
            amount: 14999,
            currency: "USD",
            status: "captured",
            method: "fpx",
            order_id: `wrong_${created.curlecOrderId}`,
          },
        ]),
        fetchPayment: jest.fn(),
      })
      .mockReturnValueOnce({
        createOrder: jest.fn(),
        fetchOrderPayments: jest.fn(async () => []),
        fetchPayment: jest.fn(async () => ({
          id: paymentId,
          amount: 14999,
          currency: "USD",
          status: "captured",
          method: "fpx",
          order_id: `wrong_${created.curlecOrderId}`,
        })),
      });

    await seedOrderPaidWebhookEvent(eventId, created.curlecOrderId);
    await processStoredCurlecWebhook(eventId, prisma, "OPERATING");

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: created.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.HELD);
    expect(updated.status).not.toBe(GatewayPaymentStatus.COMPLETED);
  });

  it("blocks startCorporateOnboarding when onboarding fee is unpaid (new path)", async () => {
    if (!migrated) return;

    const suffix = `${Date.now()}`.slice(-4);
    const unpaidUser = await prisma.user.create({
      data: {
        user_id: `U${suffix}`.slice(0, 5),
        email: `unpaid-fee-${Date.now()}@example.com`,
        cognito_sub: `sub-unpaid-${Date.now()}`,
        cognito_username: `unpaid-${Date.now()}`,
        first_name: "Unpaid",
        last_name: "Issuer",
        roles: [UserRole.ISSUER],
        issuer_account: ["COMPANY"],
      },
    });
    createdUserIds.push(unpaidUser.user_id);

    const unpaidOrg = await prisma.issuerOrganization.create({
      data: {
        owner_user_id: unpaidUser.user_id,
        type: OrganizationType.COMPANY,
        name: "Unpaid Corp",
      },
    });
    createdOrgIds.push(unpaidOrg.id);

    const service = new RegTankService();
    await expect(
      service.startCorporateOnboarding(
        {} as import("express").Request,
        unpaidUser.user_id,
        unpaidOrg.id,
        "issuer",
        "Unpaid Corp"
      )
    ).rejects.toMatchObject({ statusCode: 402, code: "ONBOARDING_FEE_REQUIRED" });
  });

  it("blocks startCorporateOnboarding resume when onboarding fee is unpaid", async () => {
    if (!migrated) return;

    const suffix = `${Date.now()}`.slice(-4);
    const resumeUser = await prisma.user.create({
      data: {
        user_id: `R${suffix}`.slice(0, 5),
        email: `resume-fee-${Date.now()}@example.com`,
        cognito_sub: `sub-resume-${Date.now()}`,
        cognito_username: `resume-${Date.now()}`,
        first_name: "Resume",
        last_name: "Issuer",
        roles: [UserRole.ISSUER],
        issuer_account: ["COMPANY"],
      },
    });
    createdUserIds.push(resumeUser.user_id);

    const resumeOrg = await prisma.issuerOrganization.create({
      data: {
        owner_user_id: resumeUser.user_id,
        type: OrganizationType.COMPANY,
        name: "Resume Corp",
      },
    });
    createdOrgIds.push(resumeOrg.id);

    const onboarding = await prisma.regTankOnboarding.create({
      data: {
        user_id: resumeUser.user_id,
        issuer_organization_id: resumeOrg.id,
        organization_type: OrganizationType.COMPANY,
        portal_type: "issuer",
        request_id: `req_m8_${Date.now()}`,
        reference_id: `ref_m8_${Date.now()}`,
        onboarding_type: "CORPORATE",
        verify_link: "https://regtank.example/verify",
        status: "IN_PROGRESS",
      },
    });
    createdRegTankIds.push(onboarding.id);

    const service = new RegTankService();
    await expect(
      service.startCorporateOnboarding(
        {} as import("express").Request,
        resumeUser.user_id,
        resumeOrg.id,
        "issuer",
        "Resume Corp"
      )
    ).rejects.toMatchObject({ statusCode: 402, code: "ONBOARDING_FEE_REQUIRED" });
  });

  it("CREATED amount mismatch auto-refunds and blocks a second order while pending", async () => {
    if (!migrated) return;

    const suffix = `${Date.now()}`.slice(-4);
    const mismatchUser = await prisma.user.create({
      data: {
        user_id: `M${suffix}`.slice(0, 5),
        email: `mismatch-fee-${Date.now()}@example.com`,
        cognito_sub: `sub-mismatch-${Date.now()}`,
        cognito_username: `mismatch-${Date.now()}`,
        first_name: "Mismatch",
        last_name: "Issuer",
        roles: [UserRole.ISSUER],
        issuer_account: ["COMPANY"],
      },
    });
    createdUserIds.push(mismatchUser.user_id);

    const mismatchOrg = await prisma.issuerOrganization.create({
      data: {
        owner_user_id: mismatchUser.user_id,
        type: OrganizationType.COMPANY,
        name: "Mismatch Corp",
        tnc_accepted: true,
      },
    });
    createdOrgIds.push(mismatchOrg.id);

    const created = await createIssuerOnboardingFee(
      { userId: mismatchUser.user_id },
      { issuerOrganizationId: mismatchOrg.id },
      prisma
    );
    createdPaymentIds.push(created.id);

    const refundPayment = jest.fn(async () => ({
      id: `rfnd_mismatch_${Date.now()}`,
      amount: 99999,
      currency: "MYR",
      status: "processed",
    }));

    // Capture path + refund initiation each create their own Curlec client.
    const mismatchClient = {
      createOrder: jest.fn(),
      fetchPayment: jest.fn(async (paymentId: string) => ({
        id: paymentId,
        amount: 99999,
        currency: "MYR",
        status: "captured",
        method: "fpx",
        order_id: created.curlecOrderId,
      })),
      fetchOrderPayments: jest.fn(async () => []),
      refundPayment,
    };
    (createCurlecClient as jest.Mock)
      .mockReturnValueOnce(mismatchClient)
      .mockReturnValueOnce(mismatchClient);

    await processOnboardingFeeCapture(
      {
        orderId: created.curlecOrderId,
        paymentId: `pay_mismatch_${Date.now()}`,
        eventId: `evt_mismatch_${Date.now()}`,
        routeGatewayAccount: "OPERATING",
      },
      prisma
    );

    const refunding = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: created.id } });
    expect(refunding.status).toBe(GatewayPaymentStatus.REFUND_INITIATED);
    expect(refunding.gatewayAccount).toBe("OPERATING");
    const metadata = refunding.metadata as Record<string, unknown>;
    expect(metadata.captureMismatch).toMatchObject({ mismatchType: "AMOUNT_MISMATCH" });
    expect(metadata.amountMismatch).toMatchObject({
      expectedSen: expect.any(Number),
      actualSen: 99999,
    });
    expect((metadata.amountMismatch as { expectedSen: number }).expectedSen).not.toBe(99999);
    expect(refundPayment).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ amountSen: 99999, idempotencyKey: created.id })
    );

    const status = await getIssuerOnboardingFeeStatus(
      { userId: mismatchUser.user_id },
      mismatchOrg.id,
      prisma
    );
    expect(status.isPaid).toBe(false);
    expect(status.isUnderReview).toBe(true);

    await expect(
      createIssuerOnboardingFee(
        { userId: mismatchUser.user_id },
        { issuerOrganizationId: mismatchOrg.id },
        prisma
      )
    ).rejects.toMatchObject({ code: "ONBOARDING_FEE_CAPTURE_MISMATCH_HELD" });
  });

  it("EXPIRED late-capture amount mismatch auto-refunds", async () => {
    if (!migrated) return;

    const suffix = `${Date.now()}`.slice(-4);
    const mismatchUser = await prisma.user.create({
      data: {
        user_id: `E${suffix}`.slice(0, 5),
        email: `expired-mismatch-${Date.now()}@example.com`,
        cognito_sub: `sub-expired-mismatch-${Date.now()}`,
        cognito_username: `expired-mismatch-${Date.now()}`,
        first_name: "Expired",
        last_name: "Issuer",
        roles: [UserRole.ISSUER],
        issuer_account: ["COMPANY"],
      },
    });
    createdUserIds.push(mismatchUser.user_id);

    const mismatchOrg = await prisma.issuerOrganization.create({
      data: {
        owner_user_id: mismatchUser.user_id,
        type: OrganizationType.COMPANY,
        name: "Expired Mismatch Corp",
        tnc_accepted: true,
      },
    });
    createdOrgIds.push(mismatchOrg.id);

    const created = await createIssuerOnboardingFee(
      { userId: mismatchUser.user_id },
      { issuerOrganizationId: mismatchOrg.id },
      prisma
    );
    createdPaymentIds.push(created.id);

    await prisma.gatewayPayment.update({
      where: { id: created.id },
      data: { status: GatewayPaymentStatus.EXPIRED },
    });

    const refundPayment = jest.fn(async () => ({
      id: `rfnd_expired_mismatch_${Date.now()}`,
      amount: 11111,
      currency: "MYR",
      status: "processed",
    }));

    const mismatchClient = {
      createOrder: jest.fn(),
      fetchPayment: jest.fn(async (paymentId: string) => ({
        id: paymentId,
        amount: 11111,
        currency: "MYR",
        status: "captured",
        method: "fpx",
        order_id: created.curlecOrderId,
      })),
      fetchOrderPayments: jest.fn(async () => []),
      refundPayment,
    };
    (createCurlecClient as jest.Mock)
      .mockReturnValueOnce(mismatchClient)
      .mockReturnValueOnce(mismatchClient);

    await processOnboardingFeeCapture(
      {
        orderId: created.curlecOrderId,
        paymentId: `pay_expired_mismatch_${Date.now()}`,
        eventId: `evt_expired_mismatch_${Date.now()}`,
        routeGatewayAccount: "OPERATING",
      },
      prisma
    );

    const refunding = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: created.id } });
    expect(refunding.status).toBe(GatewayPaymentStatus.REFUND_INITIATED);
    expect((refunding.metadata as Record<string, unknown>).captureMismatch).toBeTruthy();
    expect(refundPayment).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ amountSen: 11111 })
    );
  });

  it("REFUNDED amount-mismatch payment allows a new onboarding fee order", async () => {
    if (!migrated) return;

    const suffix = `${Date.now()}`.slice(-4);
    const user = await prisma.user.create({
      data: {
        user_id: `R${suffix}`.slice(0, 5),
        email: `refunded-mismatch-${Date.now()}@example.com`,
        cognito_sub: `sub-refunded-mismatch-${Date.now()}`,
        cognito_username: `refunded-mismatch-${Date.now()}`,
        first_name: "Refunded",
        last_name: "Issuer",
        roles: [UserRole.ISSUER],
        issuer_account: ["COMPANY"],
      },
    });
    createdUserIds.push(user.user_id);

    const org = await prisma.issuerOrganization.create({
      data: {
        owner_user_id: user.user_id,
        type: OrganizationType.COMPANY,
        name: "Refunded Mismatch Corp",
        tnc_accepted: true,
      },
    });
    createdOrgIds.push(org.id);

    const first = await createIssuerOnboardingFee(
      { userId: user.user_id },
      { issuerOrganizationId: org.id },
      prisma
    );
    createdPaymentIds.push(first.id);

    await prisma.gatewayPayment.update({
      where: { id: first.id },
      data: {
        status: GatewayPaymentStatus.REFUNDED,
        refunded_at: new Date(),
        refund_reference: `rfnd_done_${Date.now()}`,
        metadata: {
          amountMismatch: {
            mismatchType: "AMOUNT_MISMATCH",
            expectedSen: 15000,
            actualSen: 99999,
          },
          captureMismatch: {
            mismatchType: "AMOUNT_MISMATCH",
            expectedSen: 15000,
            actualSen: 99999,
          },
        },
      },
    });

    const second = await createIssuerOnboardingFee(
      { userId: user.user_id },
      { issuerOrganizationId: org.id },
      prisma
    );
    createdPaymentIds.push(second.id);
    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe(GatewayPaymentStatus.CREATED);
  });

  it("currency mismatch holds issuer fee without completing", async () => {
    if (!migrated) return;

    const suffix = `${Date.now()}`.slice(-4);
    const mismatchUser = await prisma.user.create({
      data: {
        user_id: `C${suffix}`.slice(0, 5),
        email: `currency-mismatch-${Date.now()}@example.com`,
        cognito_sub: `sub-currency-mismatch-${Date.now()}`,
        cognito_username: `currency-mismatch-${Date.now()}`,
        first_name: "Currency",
        last_name: "Issuer",
        roles: [UserRole.ISSUER],
        issuer_account: ["COMPANY"],
      },
    });
    createdUserIds.push(mismatchUser.user_id);

    const mismatchOrg = await prisma.issuerOrganization.create({
      data: {
        owner_user_id: mismatchUser.user_id,
        type: OrganizationType.COMPANY,
        name: "Currency Mismatch Corp",
        tnc_accepted: true,
      },
    });
    createdOrgIds.push(mismatchOrg.id);

    const created = await createIssuerOnboardingFee(
      { userId: mismatchUser.user_id },
      { issuerOrganizationId: mismatchOrg.id },
      prisma
    );
    createdPaymentIds.push(created.id);

    (createCurlecClient as jest.Mock).mockReturnValueOnce({
      createOrder: jest.fn(),
      fetchPayment: jest.fn(async (paymentId: string) => ({
        id: paymentId,
        amount: 15000,
        currency: "SGD",
        status: "captured",
        method: "fpx",
        order_id: created.curlecOrderId,
      })),
      fetchOrderPayments: jest.fn(async () => []),
    });

    await processOnboardingFeeCapture(
      {
        orderId: created.curlecOrderId,
        paymentId: `pay_currency_mismatch_${Date.now()}`,
        eventId: `evt_currency_mismatch_${Date.now()}`,
        routeGatewayAccount: "OPERATING",
      },
      prisma
    );

    const held = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: created.id } });
    expect(held.status).toBe(GatewayPaymentStatus.HELD);
    expect(held.status).not.toBe(GatewayPaymentStatus.COMPLETED);
    expect((held.metadata as Record<string, unknown>).captureMismatch).toMatchObject({
      mismatchType: "CURRENCY_MISMATCH",
      reason: "Currency mismatch",
      expectedCurrency: "MYR",
      actualCurrency: "SGD",
    });
    expect(held.status).not.toBe(GatewayPaymentStatus.COMPLETED);

    const org = await prisma.issuerOrganization.findUniqueOrThrow({ where: { id: mismatchOrg.id } });
    expect(org.onboarding_fee_paid_at).toBeNull();

    const refundCalls = (createCurlecClient as jest.Mock).mock.results
      .map((result) => result.value?.refundPayment)
      .filter(Boolean);
    for (const refundPayment of refundCalls) {
      expect(refundPayment).not.toHaveBeenCalled();
    }

    const receiptCount = await prisma.gatewayPaymentReceipt.count({
      where: { gateway_payment_id: created.id },
    });
    expect(receiptCount).toBe(0);
  });

  it("poll sync completes CREATED fee when Curlec has failed null-fee attempt plus captured payment", async () => {
    if (!migrated) return;

    await prisma.issuerOrganization.update({
      where: { id: orgId },
      data: { onboarding_fee_paid_at: null },
    });
    await prisma.gatewayPayment.updateMany({
      where: {
        issuer_organization_id: orgId,
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        status: { in: [GatewayPaymentStatus.COMPLETED, GatewayPaymentStatus.HELD] },
      },
      data: { status: GatewayPaymentStatus.FAILED },
    });

    const created = await createIssuerOnboardingFee(
      { userId },
      { issuerOrganizationId: orgId },
      prisma
    );
    createdPaymentIds.push(created.id);
    expect(created.status).toBe(GatewayPaymentStatus.CREATED);

    const failedPaymentId = `pay_sync_failed_${Date.now()}`;
    const capturedPaymentId = `pay_sync_captured_${Date.now()}`;
    const mockedCreateCurlecClient = createCurlecClient as jest.Mock;
    mockedCreateCurlecClient.mockReturnValue({
      createOrder: jest.fn(),
      fetchOrderPayments: jest.fn(async () => [
        {
          id: failedPaymentId,
          amount: 15000,
          currency: "MYR",
          status: "failed",
          method: "fpx",
          order_id: created.curlecOrderId,
          fee: null,
          tax: null,
          created_at: 100,
        },
        {
          id: capturedPaymentId,
          amount: 15000,
          currency: "MYR",
          status: "captured",
          method: "fpx",
          order_id: created.curlecOrderId,
          fee: 100,
          tax: 0,
          created_at: 200,
        },
      ]),
      fetchPayment: jest.fn(async () => ({
        id: capturedPaymentId,
        amount: 15000,
        currency: "MYR",
        status: "captured",
        method: "fpx",
        order_id: created.curlecOrderId,
        fee: 100,
        tax: 0,
      })),
    });

    const result = await getIssuerOnboardingFee({ userId }, created.id, prisma);

    expect(result.status).toBe(GatewayPaymentStatus.COMPLETED);

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: created.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.COMPLETED);
    expect(updated.curlec_payment_id).toBe(capturedPaymentId);

    const org = await prisma.issuerOrganization.findUniqueOrThrow({ where: { id: orgId } });
    expect(org.onboarding_fee_paid_at).not.toBeNull();
  });
});
