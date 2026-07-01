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
import { processProcessingFeeCapture } from "./webhook-service";

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
        order_id: "order_test_m9_1",
      })),
      fetchOrderPayments: jest.fn(async () => []),
    })),
  };
});

jest.mock("../../config/curlec", () => ({
  getCurlecConfig: jest.fn(() => ({
    keyId: "rzp_test_key",
    keySecret: "secret",
    webhookSecret: "whsec",
    apiBaseUrl: "https://api.razorpay.com",
    environment: "sandbox" as const,
  })),
}));

const prisma = new PrismaClient();
const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

describeIntegration("application processing fee (M9)", () => {
  let migrated = false;
  let userId = "";
  let orgId = "";
  let applicationId = "";
  const createdPaymentIds: string[] = [];
  const createdApplicationIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdEventIds: string[] = [];

  async function seedWebhookEvent(eventId: string) {
    createdEventIds.push(eventId);
    await prisma.gatewayWebhookEvent.create({
      data: {
        event_id: eventId,
        event_type: "payment.captured",
        payload: {
          event: "payment.captured",
          payload: { payment: { entity: { id: "pay_stub", order_id: "order_stub" } } },
        },
        signature_valid: true,
      },
    });
  }

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

    const stored = await prisma.gatewayPayment.findUnique({ where: { id: result.id } });
    expect(stored?.purpose).toBe(GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE);
    expect(stored?.organization_type).toBe(GatewayOrganizationType.ISSUER);
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

  it("blocks IDOR on fee lookup", async () => {
    if (!migrated) return;

    const created = await createApplicationProcessingFee({ userId }, applicationId, prisma);

    await expect(
      getApplicationProcessingFee({ userId: "other-user" }, applicationId, created.id, prisma)
    ).rejects.toMatchObject({ code: "PROCESSING_FEE_NOT_FOUND" });
  });

  it("completes fee on webhook capture and posts operating ledger exactly once", async () => {
    if (!migrated) return;

    const payment = await prisma.gatewayPayment.findFirstOrThrow({
      where: {
        application_id: applicationId,
        purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
      },
    });

    const orderId = payment.curlec_order_id;
    const paymentId = `pay_m9_${Date.now()}`;
    const eventId = `evt_m9_${Date.now()}`;

    await seedWebhookEvent(eventId);
    await processProcessingFeeCapture({ orderId, paymentId, eventId }, prisma);

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
    await seedWebhookEvent(replayEventId);
    await processProcessingFeeCapture(
      {
        orderId,
        paymentId: `pay_m9_replay_${Date.now()}`,
        eventId: replayEventId,
      },
      prisma
    );

    const ledgerCountAfterReplay = await prisma.noteLedgerEntry.count({
      where: { gateway_payment_id: payment.id },
    });
    expect(ledgerCountAfterReplay).toBe(1);
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
