import {
  ApplicationStatus,
  GatewayOrganizationType,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  NoteLedgerDirection,
  OrganizationType,
  Prisma,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import { ApplicationService } from "../applications/service";
import {
  createApplicationProcessingFee,
  getApplicationProcessingFee,
} from "./processing-fee-service";
import { createCurlecClient } from "./curlec-client";
import { getCurlecConfig } from "../../config/curlec";
import { processProcessingFeeCapture, processStoredCurlecWebhook } from "./webhook-service";

jest.mock("./curlec-client", () => {
  let orderCounter = 0;
  return {
    createCurlecClient: jest.fn(() => ({
      createOrder: jest.fn(async () => {
        orderCounter += 1;
        return {
          id: `order_test_m9_${orderCounter}`,
          amount: 5000,
          currency: "MYR",
          status: "created",
        };
      }),
      fetchPayment: jest.fn(async (paymentId: string) => ({
        id: paymentId,
        amount: 5000,
        currency: "MYR",
        status: "captured",
        method: "fpx",
        order_id: null,
      })),
      fetchOrderPayments: jest.fn(async () => []),
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

describeIntegration("application processing fee (M9)", () => {
  let curlecOrderCounter = 0;
  let migrated = false;
  let userId = "";
  let orgId = "";
  let applicationId = "";
  const createdPaymentIds: string[] = [];
  const createdApplicationIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
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
          id: `order_test_m9_${curlecOrderCounter}`,
          amount: 5000,
          currency: "MYR",
          status: "created",
        };
      }),
      fetchPayment: jest.fn(async (paymentId: string) => ({
        id: paymentId,
        amount: 5000,
        currency: "MYR",
        status: "captured",
        method: "fpx",
        order_id: null,
      })),
      fetchOrderPayments: jest.fn(async () => []),
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
        user_id: `P${suffix}`.slice(0, 5),
        email: `processing-fee-${Date.now()}@example.com`,
        cognito_sub: `sub-pf-${Date.now()}`,
        cognito_username: `pf-${Date.now()}`,
        first_name: "Apply",
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
        name: "Apply Corp",
      },
    });
    orgId = org.id;
    createdOrgIds.push(orgId);

    const application = await prisma.application.create({
      data: {
        issuer_organization_id: orgId,
        product_version: 1,
        status: ApplicationStatus.DRAFT,
        last_completed_step: 1,
      },
    });
    applicationId = application.id;
    createdApplicationIds.push(applicationId);

    await prisma.platformFinanceSetting.upsert({
      where: { key: "DEFAULT" },
      update: {
        application_processing_fee_amount: new Prisma.Decimal("50.000000"),
      },
      create: {
        key: "DEFAULT",
        application_processing_fee_amount: new Prisma.Decimal("50.000000"),
      },
    });
  });

  afterAll(async () => {
    if (createdEventIds.length > 0) {
      await prisma.gatewayWebhookEvent.deleteMany({ where: { event_id: { in: createdEventIds } } });
    }
    if (createdPaymentIds.length > 0) {
      await prisma.noteLedgerEntry.deleteMany({
        where: { gateway_payment_id: { in: createdPaymentIds } },
      });
      await prisma.gatewayPayment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdApplicationIds.length > 0) {
      await prisma.application.deleteMany({ where: { id: { in: createdApplicationIds } } });
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

    const result = await createApplicationProcessingFee({ userId }, applicationId, prisma);
    createdPaymentIds.push(result.id);

    expect(result.status).toBe(GatewayPaymentStatus.CREATED);
    expect(result.amount).toBe(50);
    expect(result.applicationId).toBe(applicationId);
    expect(result.gatewayAccount).toBe("OPERATING");
    expect(result.curlecKeyId).toBe("rzp_test_operating_key");

    const stored = await prisma.gatewayPayment.findUnique({ where: { id: result.id } });
    expect(stored?.purpose).toBe(GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE);
    expect(stored?.organization_type).toBe(GatewayOrganizationType.ISSUER);
    expect(stored?.gatewayAccount).toBe("OPERATING");
    expect((createCurlecClient as jest.Mock).mock.calls.at(-1)?.[0]).toEqual({
      gatewayAccount: "OPERATING",
    });
  });

  it("returns existing payment on duplicate create (no second order)", async () => {
    if (!migrated) return;

    const first = await createApplicationProcessingFee({ userId }, applicationId, prisma);
    const second = await createApplicationProcessingFee({ userId }, applicationId, prisma);

    expect(second.id).toBe(first.id);

    const count = await prisma.gatewayPayment.count({
      where: {
        application_id: applicationId,
        purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
      },
    });
    expect(count).toBe(1);
  });

  it("dedupes concurrent create calls to one active processing fee payment", async () => {
    if (!migrated) return;

    await prisma.gatewayPayment.updateMany({
      where: {
        application_id: applicationId,
        purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
        status: { in: [GatewayPaymentStatus.CREATED, GatewayPaymentStatus.PAID] },
      },
      data: { status: GatewayPaymentStatus.FAILED },
    });

    const results = await Promise.all(
      Array.from({ length: 5 }, () => createApplicationProcessingFee({ userId }, applicationId, prisma))
    );

    const uniquePaymentIds = new Set(results.map((entry) => entry.id));
    expect(uniquePaymentIds.size).toBe(1);

    const activeCount = await prisma.gatewayPayment.count({
      where: {
        application_id: applicationId,
        purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
        status: { in: [GatewayPaymentStatus.CREATED, GatewayPaymentStatus.PAID] },
      },
    });
    expect(activeCount).toBe(1);
  });

  it("does not reuse EXPIRED processing fee payments and creates a fresh order", async () => {
    if (!migrated) return;

    const first = await createApplicationProcessingFee({ userId }, applicationId, prisma);
    await prisma.gatewayPayment.update({
      where: { id: first.id },
      data: { status: GatewayPaymentStatus.EXPIRED },
    });

    const second = await createApplicationProcessingFee({ userId }, applicationId, prisma);
    createdPaymentIds.push(first.id, second.id);

    expect(second.id).not.toBe(first.id);
    expect(second.curlecOrderId).not.toBe(first.curlecOrderId);
  });

  it("does not reuse FAILED processing fee payments and creates a fresh order", async () => {
    if (!migrated) return;

    const first = await createApplicationProcessingFee({ userId }, applicationId, prisma);
    await prisma.gatewayPayment.update({
      where: { id: first.id },
      data: { status: GatewayPaymentStatus.FAILED },
    });

    const second = await createApplicationProcessingFee({ userId }, applicationId, prisma);
    createdPaymentIds.push(first.id, second.id);

    expect(second.id).not.toBe(first.id);
    expect(second.curlecOrderId).not.toBe(first.curlecOrderId);
  });

  it("fails clearly when OPERATING credentials are missing and does not create payment", async () => {
    if (!migrated) return;

    await prisma.gatewayPayment.updateMany({
      where: {
        application_id: applicationId,
        purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
      },
      data: { status: GatewayPaymentStatus.FAILED },
    });

    const beforeCount = await prisma.gatewayPayment.count({
      where: {
        application_id: applicationId,
        purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
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

    await expect(createApplicationProcessingFee({ userId }, applicationId, prisma)).rejects.toMatchObject(
      {
        code: "CURLEC_ACCOUNT_CONFIG_ERROR",
      }
    );

    if (originalImpl) {
      configMock.mockImplementation(originalImpl);
    }

    const afterCount = await prisma.gatewayPayment.count({
      where: {
        application_id: applicationId,
        purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
      },
    });
    expect(afterCount).toBe(beforeCount);
  });

  it("reuses COMPLETED processing fee as proof of payment", async () => {
    if (!migrated) return;

    const created = await createApplicationProcessingFee({ userId }, applicationId, prisma);
    await prisma.gatewayPayment.update({
      where: { id: created.id },
      data: { status: GatewayPaymentStatus.COMPLETED },
    });

    const result = await createApplicationProcessingFee({ userId }, applicationId, prisma);
    createdPaymentIds.push(created.id);

    expect(result.id).toBe(created.id);
    expect(result.status).toBe(GatewayPaymentStatus.COMPLETED);
  });

  it("blocks IDOR on fee lookup", async () => {
    if (!migrated) return;

    const created = await createApplicationProcessingFee({ userId }, applicationId, prisma);

    await expect(
      getApplicationProcessingFee({ userId: "other-user" }, applicationId, created.id, prisma)
    ).rejects.toMatchObject({ code: "APPLICATION_FORBIDDEN" });
  });

  it("completes fee on webhook capture and posts operating ledger exactly once", async () => {
    if (!migrated) return;

    await prisma.gatewayPayment.updateMany({
      where: {
        application_id: applicationId,
        purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
        status: GatewayPaymentStatus.COMPLETED,
      },
      data: { status: GatewayPaymentStatus.FAILED },
    });

    const created = await createApplicationProcessingFee({ userId }, applicationId, prisma);
    createdPaymentIds.push(created.id);
    const payment = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: created.id } });

    const orderId = payment.curlec_order_id;
    const paymentId = `pay_m9_${Date.now()}`;
    const eventId = `evt_m9_${Date.now()}`;

    await seedCaptureWebhookEvent(eventId, orderId, paymentId);
    await processProcessingFeeCapture(
      { orderId, paymentId, eventId, routeGatewayAccount: "OPERATING" },
      prisma
    );

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.COMPLETED);

    const ledgerEntry = await prisma.noteLedgerEntry.findFirst({
      where: { gateway_payment_id: payment.id },
    });
    expect(ledgerEntry?.direction).toBe(NoteLedgerDirection.CREDIT);
    expect(ledgerEntry?.amount.toNumber()).toBe(50);

    const ledgerCount = await prisma.noteLedgerEntry.count({
      where: { idempotency_key: `gateway-processing-fee:ledger:${payment.id}` },
    });
    expect(ledgerCount).toBe(1);

    const replayEventId = `evt_m9_replay_${Date.now()}`;
    await seedCaptureWebhookEvent(replayEventId, orderId, `pay_m9_replay_${Date.now()}`);
    await processProcessingFeeCapture(
      {
        orderId,
        paymentId: `pay_m9_replay_${Date.now()}`,
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

    const created = await createApplicationProcessingFee({ userId }, applicationId, prisma);
    createdPaymentIds.push(created.id);

    await prisma.gatewayPayment.update({
      where: { id: created.id },
      data: { status: GatewayPaymentStatus.EXPIRED },
    });

    const eventId = `evt_m9_expired_capture_${Date.now()}`;
    await seedCaptureWebhookEvent(eventId, created.curlecOrderId, `pay_m9_expired_${Date.now()}`);
    await processProcessingFeeCapture(
      {
        orderId: created.curlecOrderId,
        paymentId: `pay_m9_expired_${Date.now()}`,
        eventId,
        routeGatewayAccount: "OPERATING",
      },
      prisma
    );

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: created.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.COMPLETED);

    const replayEventId = `evt_m9_expired_capture_replay_${Date.now()}`;
    await seedCaptureWebhookEvent(
      replayEventId,
      created.curlecOrderId,
      `pay_m9_expired_replay_${Date.now()}`
    );
    await processProcessingFeeCapture(
      {
        orderId: created.curlecOrderId,
        paymentId: `pay_m9_expired_replay_${Date.now()}`,
        eventId: replayEventId,
        routeGatewayAccount: "OPERATING",
      },
      prisma
    );

    const ledgerCount = await prisma.noteLedgerEntry.count({
      where: { idempotency_key: `gateway-processing-fee:ledger:${created.id}` },
    });
    expect(ledgerCount).toBe(1);
  });

  it("normal order.paid completes an active CREATED processing fee payment", async () => {
    if (!migrated) return;

    const created = await createApplicationProcessingFee({ userId }, applicationId, prisma);
    createdPaymentIds.push(created.id);

    const paymentId = `pay_m9_order_paid_${Date.now()}`;
    const eventId = `evt_m9_order_paid_${Date.now()}`;
    const mockedCreateCurlecClient = createCurlecClient as jest.Mock;
    mockedCreateCurlecClient
      .mockReturnValueOnce({
        createOrder: jest.fn(),
        fetchOrderPayments: jest.fn(async () => [
          {
            id: paymentId,
            amount: 5000,
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
          amount: 5000,
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

    const created = await createApplicationProcessingFee({ userId }, applicationId, prisma);
    createdPaymentIds.push(created.id);
    await prisma.gatewayPayment.update({
      where: { id: created.id },
      data: { status: GatewayPaymentStatus.EXPIRED },
    });

    const paymentId = `pay_m9_order_paid_expired_${Date.now()}`;
    const eventId = `evt_m9_order_paid_expired_${Date.now()}`;
    const replayEventId = `evt_m9_order_paid_expired_replay_${Date.now()}`;
    const mockedCreateCurlecClient = createCurlecClient as jest.Mock;
    mockedCreateCurlecClient
      .mockReturnValueOnce({
        createOrder: jest.fn(),
        fetchOrderPayments: jest.fn(async () => [
          {
            id: paymentId,
            amount: 5000,
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
          amount: 5000,
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
      where: { idempotency_key: `gateway-processing-fee:ledger:${created.id}` },
    });
    expect(ledgerCount).toBe(1);
  });

  it("payment.captured followed by order.paid for the same curlec_payment_id does not process twice", async () => {
    if (!migrated) return;

    const created = await createApplicationProcessingFee({ userId }, applicationId, prisma);
    createdPaymentIds.push(created.id);

    const paymentId = `pay_m9_sequence_1_${Date.now()}`;
    const captureEventId = `evt_m9_sequence_capture_${Date.now()}`;
    const orderPaidEventId = `evt_m9_sequence_order_paid_${Date.now()}`;
    await seedCaptureWebhookEvent(captureEventId, created.curlecOrderId, paymentId);
    await processStoredCurlecWebhook(captureEventId, prisma, "OPERATING");

    const mockedCreateCurlecClient = createCurlecClient as jest.Mock;
    mockedCreateCurlecClient.mockReturnValueOnce({
      createOrder: jest.fn(),
      fetchOrderPayments: jest.fn(async () => [
        {
          id: paymentId,
          amount: 5000,
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
      where: { idempotency_key: `gateway-processing-fee:ledger:${created.id}` },
    });
    expect(ledgerCount).toBe(1);
  });

  it("order.paid followed by payment.captured for the same curlec_payment_id does not process twice", async () => {
    if (!migrated) return;

    const created = await createApplicationProcessingFee({ userId }, applicationId, prisma);
    createdPaymentIds.push(created.id);

    const paymentId = `pay_m9_sequence_2_${Date.now()}`;
    const orderPaidEventId = `evt_m9_sequence_order_paid_first_${Date.now()}`;
    const captureEventId = `evt_m9_sequence_capture_second_${Date.now()}`;
    const mockedCreateCurlecClient = createCurlecClient as jest.Mock;
    mockedCreateCurlecClient
      .mockReturnValueOnce({
        createOrder: jest.fn(),
        fetchOrderPayments: jest.fn(async () => [
          {
            id: paymentId,
            amount: 5000,
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
          amount: 5000,
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
      where: { idempotency_key: `gateway-processing-fee:ledger:${created.id}` },
    });
    expect(ledgerCount).toBe(1);
  });

  it("order.paid with wrong amount/currency/order is rejected or held safely", async () => {
    if (!migrated) return;

    await prisma.gatewayPayment.updateMany({
      where: {
        application_id: applicationId,
        purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
        status: GatewayPaymentStatus.COMPLETED,
      },
      data: { status: GatewayPaymentStatus.FAILED },
    });

    const created = await createApplicationProcessingFee({ userId }, applicationId, prisma);
    createdPaymentIds.push(created.id);

    const paymentId = `pay_m9_order_paid_bad_${Date.now()}`;
    const eventId = `evt_m9_order_paid_bad_${Date.now()}`;
    const mockedCreateCurlecClient = createCurlecClient as jest.Mock;
    mockedCreateCurlecClient
      .mockReturnValueOnce({
        createOrder: jest.fn(),
        fetchOrderPayments: jest.fn(async () => [
          {
            id: paymentId,
            amount: 4900,
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
          amount: 4900,
          currency: "USD",
          status: "captured",
          method: "fpx",
          order_id: `wrong_${created.curlecOrderId}`,
        })),
      });

    await seedOrderPaidWebhookEvent(eventId, created.curlecOrderId);
    await processStoredCurlecWebhook(eventId, prisma, "OPERATING");

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: created.id } });
    expect(updated.status).not.toBe(GatewayPaymentStatus.COMPLETED);
  });

  it("blocks DRAFT to SUBMITTED without completed processing fee", async () => {
    if (!migrated) return;

    const suffix = `${Date.now()}`.slice(-4);
    const unpaidUser = await prisma.user.create({
      data: {
        user_id: `B${suffix}`.slice(0, 5),
        email: `blocked-submit-${Date.now()}@example.com`,
        cognito_sub: `sub-block-${Date.now()}`,
        cognito_username: `block-${Date.now()}`,
        first_name: "Blocked",
        last_name: "Submit",
        roles: [UserRole.ISSUER],
        issuer_account: ["COMPANY"],
      },
    });
    createdUserIds.push(unpaidUser.user_id);

    const unpaidOrg = await prisma.issuerOrganization.create({
      data: {
        owner_user_id: unpaidUser.user_id,
        type: OrganizationType.COMPANY,
        name: "Blocked Corp",
      },
    });
    createdOrgIds.push(unpaidOrg.id);

    const unpaidApp = await prisma.application.create({
      data: {
        issuer_organization_id: unpaidOrg.id,
        product_version: 1,
        status: ApplicationStatus.DRAFT,
        last_completed_step: 1,
      },
    });
    createdApplicationIds.push(unpaidApp.id);

    const service = new ApplicationService();
    await expect(
      service.updateApplicationStatus(unpaidApp.id, "SUBMITTED", unpaidUser.user_id)
    ).rejects.toMatchObject({ statusCode: 402, code: "PROCESSING_FEE_REQUIRED" });
  });

  it("allows resubmit without requiring a new processing fee", async () => {
    if (!migrated) return;

    const suffix = `${Date.now()}`.slice(-4);
    const resubmitUser = await prisma.user.create({
      data: {
        user_id: `S${suffix}`.slice(0, 5),
        email: `resubmit-fee-${Date.now()}@example.com`,
        cognito_sub: `sub-resubmit-${Date.now()}`,
        cognito_username: `resubmit-${Date.now()}`,
        first_name: "Resubmit",
        last_name: "Issuer",
        roles: [UserRole.ISSUER],
        issuer_account: ["COMPANY"],
      },
    });
    createdUserIds.push(resubmitUser.user_id);

    const resubmitOrg = await prisma.issuerOrganization.create({
      data: {
        owner_user_id: resubmitUser.user_id,
        type: OrganizationType.COMPANY,
        name: "Resubmit Corp",
      },
    });
    createdOrgIds.push(resubmitOrg.id);

    const resubmitApp = await prisma.application.create({
      data: {
        issuer_organization_id: resubmitOrg.id,
        product_version: 1,
        status: ApplicationStatus.AMENDMENT_REQUESTED,
        last_completed_step: 1,
      },
    });
    createdApplicationIds.push(resubmitApp.id);

    const service = new ApplicationService();
    await expect(
      service.resubmitApplication(resubmitApp.id, resubmitUser.user_id)
    ).resolves.toBeDefined();
  });
});
