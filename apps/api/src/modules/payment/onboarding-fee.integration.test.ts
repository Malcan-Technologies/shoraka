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
  getIssuerOnboardingFee,
} from "./onboarding-fee-service";
import { processOnboardingFeeCapture } from "./webhook-service";

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
        order_id: "order_test_m8_1",
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

describeIntegration("issuer onboarding fee (M8)", () => {
  let migrated = false;
  let userId = "";
  let orgId = "";
  const createdPaymentIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdRegTankIds: string[] = [];
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

    const stored = await prisma.gatewayPayment.findUnique({ where: { id: result.id } });
    expect(stored?.purpose).toBe(GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE);
    expect(stored?.organization_type).toBe(GatewayOrganizationType.ISSUER);
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
        issuer_organization_id: orgId,
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
      },
    });
    expect(count).toBe(1);
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

    const payment = await prisma.gatewayPayment.findFirstOrThrow({
      where: {
        issuer_organization_id: orgId,
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
      },
    });

    const orderId = payment.curlec_order_id;
    const paymentId = `pay_m8_${Date.now()}`;
    const eventId = `evt_m8_${Date.now()}`;

    await seedWebhookEvent(eventId);
    await processOnboardingFeeCapture({ orderId, paymentId, eventId }, prisma);

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
    await seedWebhookEvent(replayEventId);
    await processOnboardingFeeCapture(
      {
        orderId,
        paymentId: `pay_m8_replay_${Date.now()}`,
        eventId: replayEventId,
      },
      prisma
    );

    const ledgerCountAfterReplay = await prisma.noteLedgerEntry.count({
      where: { gateway_payment_id: payment.id },
    });
    expect(ledgerCountAfterReplay).toBe(1);
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
});
