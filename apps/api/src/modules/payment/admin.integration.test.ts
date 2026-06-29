import {
  GatewayOrganizationType,
  GatewayPaymentEventType,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  NameCheckResult,
  OrganizationType,
  Prisma,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import {
  approveHeldDepositOverride,
  approveNameCheckPendingDeposit,
  getGatewayPaymentDetail,
  proposeHeldDepositOverride,
  recordGatewayRefundInitiated,
  rejectHeldDepositOverride,
} from "./admin-service";
import { creditCompletedDeposit } from "./deposit-service";

const prisma = new PrismaClient();

async function gatewayTablesMigrated(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1 FROM gateway_payments LIMIT 1`;
    await prisma.$queryRaw`SELECT 1 FROM gateway_payment_events LIMIT 1`;
    return true;
  } catch {
    return false;
  }
}

const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

describeIntegration("admin gateway payments (M7)", () => {
  let migrated = false;
  let investorUserId = "";
  let makerUserId = "";
  let checkerUserId = "";
  let orgId = "";
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdPaymentIds: string[] = [];

  beforeAll(async () => {
    migrated = await gatewayTablesMigrated();
    if (!migrated) return;

    const suffix = `${Date.now()}`.slice(-4);

    const investorUser = await prisma.user.create({
      data: {
        user_id: `I${suffix}`.slice(0, 5),
        email: `gw-inv-${Date.now()}@example.com`,
        cognito_sub: `sub-gw-inv-${Date.now()}`,
        cognito_username: `gw-inv-${Date.now()}`,
        first_name: "Jane",
        last_name: "Doe",
        roles: [UserRole.INVESTOR],
        investor_account: ["PERSONAL"],
      },
    });
    investorUserId = investorUser.user_id;
    createdUserIds.push(investorUserId);

    const maker = await prisma.user.create({
      data: {
        user_id: `M${suffix}`.slice(0, 5),
        email: `gw-maker-${Date.now()}@example.com`,
        cognito_sub: `sub-gw-maker-${Date.now()}`,
        cognito_username: `gw-maker-${Date.now()}`,
        first_name: "Maker",
        last_name: "Admin",
        roles: [UserRole.ADMIN],
      },
    });
    makerUserId = maker.user_id;
    createdUserIds.push(makerUserId);

    const checker = await prisma.user.create({
      data: {
        user_id: `C${suffix}`.slice(0, 5),
        email: `gw-check-${Date.now()}@example.com`,
        cognito_sub: `sub-gw-check-${Date.now()}`,
        cognito_username: `gw-check-${Date.now()}`,
        first_name: "Checker",
        last_name: "Admin",
        roles: [UserRole.ADMIN],
      },
    });
    checkerUserId = checker.user_id;
    createdUserIds.push(checkerUserId);

    const org = await prisma.investorOrganization.create({
      data: {
        owner_user_id: investorUserId,
        type: OrganizationType.PERSONAL,
        first_name: "Jane",
        last_name: "Doe",
      },
    });
    orgId = org.id;
    createdOrgIds.push(orgId);
  });

  afterAll(async () => {
    if (!migrated) return;
    if (createdPaymentIds.length > 0) {
      await prisma.gatewayPaymentEvent.deleteMany({
        where: { gateway_payment_id: { in: createdPaymentIds } },
      });
      await prisma.noteLedgerEntry.deleteMany({
        where: { gateway_payment_id: { in: createdPaymentIds } },
      });
      await prisma.gatewayPayment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdOrgIds.length > 0) {
      await prisma.investorBalanceTransaction.deleteMany({
        where: { investor_organization_id: { in: createdOrgIds } },
      });
      await prisma.investorBalance.deleteMany({
        where: { investor_organization_id: { in: createdOrgIds } },
      });
      await prisma.investorOrganization.deleteMany({ where: { id: { in: createdOrgIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { user_id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  async function createHeldPayment(amount = 100) {
    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        organization_type: GatewayOrganizationType.INVESTOR,
        investor_organization_id: orgId,
        amount: new Prisma.Decimal(amount.toFixed(6)),
        currency: "MYR",
        status: GatewayPaymentStatus.HELD,
        curlec_order_id: `order_m7_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        curlec_payment_id: `pay_m7_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        payer_name: "Wrong Name",
        name_check_result: NameCheckResult.FAIL,
        name_check_at: new Date(),
        idempotency_key: `m7-test:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      },
    });
    createdPaymentIds.push(payment.id);
    return payment;
  }

  it("credits a HELD deposit after maker-checker override approval", async () => {
    if (!migrated) return;

    const payment = await createHeldPayment(250);

    await proposeHeldDepositOverride(
      { userId: makerUserId },
      payment.id,
      "Verified with bank statement"
    );

    await expect(
      approveHeldDepositOverride({ userId: makerUserId }, payment.id)
    ).rejects.toMatchObject({ code: "OVERRIDE_SELF_APPROVAL" });

    const detail = await approveHeldDepositOverride({ userId: checkerUserId }, payment.id);
    expect(detail.status).toBe(GatewayPaymentStatus.COMPLETED);

    const balance = await prisma.investorBalance.findUnique({
      where: { investor_organization_id: orgId },
    });
    expect(balance?.available_balance.toNumber()).toBeGreaterThanOrEqual(250);

    const events = await prisma.gatewayPaymentEvent.findMany({
      where: { gateway_payment_id: payment.id },
      orderBy: { created_at: "asc" },
    });
    expect(events.map((event) => event.type)).toEqual([
      GatewayPaymentEventType.OVERRIDE_PROPOSED,
      GatewayPaymentEventType.OVERRIDE_APPROVED,
    ]);
  });

  it("approves NAME_CHECK_PENDING and credits exactly once on replay", async () => {
    if (!migrated) return;

    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        organization_type: GatewayOrganizationType.INVESTOR,
        investor_organization_id: orgId,
        amount: new Prisma.Decimal("50.000000"),
        currency: "MYR",
        status: GatewayPaymentStatus.NAME_CHECK_PENDING,
        curlec_order_id: `order_nc_${Date.now()}`,
        idempotency_key: `m7-nc:${Date.now()}`,
      },
    });
    createdPaymentIds.push(payment.id);

    await approveNameCheckPendingDeposit(
      { userId: checkerUserId },
      payment.id,
      "Manual verification complete"
    );

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.COMPLETED);

    await expect(
      prisma.$transaction(async (tx) => {
        await creditCompletedDeposit(tx, updated, { actorUserId: checkerUserId });
      })
    ).rejects.toMatchObject({ code: "INVALID_GATEWAY_TRANSITION" });
  });

  it("records refund initiation for a HELD payment", async () => {
    if (!migrated) return;

    const payment = await createHeldPayment(75);
    const detail = await recordGatewayRefundInitiated(
      { userId: makerUserId },
      payment.id,
      { reference: "REF-12345", notes: "Refund in Curlec dashboard" }
    );

    expect(detail.status).toBe(GatewayPaymentStatus.REFUND_INITIATED);
    expect(detail.refundReference).toBe("REF-12345");
  });

  it("loads detail for non-deposit gateway payments", async () => {
    if (!migrated) return;

    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
        organization_type: GatewayOrganizationType.ISSUER,
        amount: new Prisma.Decimal("50.000000"),
        currency: "MYR",
        status: GatewayPaymentStatus.COMPLETED,
        curlec_order_id: `order_admin_fee_${Date.now()}`,
        curlec_payment_id: `pay_admin_fee_${Date.now()}`,
        idempotency_key: `m7-fee-detail:${Date.now()}`,
      },
    });
    createdPaymentIds.push(payment.id);

    const detail = await getGatewayPaymentDetail(payment.id, prisma);
    expect(detail.purpose).toBe(GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE);
    expect(detail.expectedPayerName).toBeNull();
  });

  it("rejects an open override proposal without changing payment status", async () => {
    if (!migrated) return;

    const payment = await createHeldPayment(30);
    await proposeHeldDepositOverride({ userId: makerUserId }, payment.id, "Try override");
    await rejectHeldDepositOverride(
      { userId: checkerUserId },
      payment.id,
      "Insufficient evidence"
    );

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.HELD);
  });
});
