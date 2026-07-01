import {
  GatewayOrganizationType,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  NameCheckResult,
  OrganizationType,
  Prisma,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import {
  approveNameCheck,
  getGatewayPaymentDetail,
  initiateCompletedDepositRefund,
  rejectNameCheck,
  retryHeldDepositRefund,
} from "./admin-service";

const prisma = new PrismaClient();

const mockRefundPayment = jest.fn();

jest.mock("./curlec-client", () => ({
  createCurlecClient: jest.fn(() => ({
    refundPayment: (...args: unknown[]) => mockRefundPayment(...args),
  })),
}));

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

describeIntegration("admin gateway payments refunds", () => {
  let migrated = false;
  let adminUserId = "";
  let orgId = "";
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdPaymentIds: string[] = [];

  beforeAll(async () => {
    migrated = await gatewayTablesMigrated();
    if (!migrated) return;

    const suffix = `${Date.now()}`.slice(-4);

    const admin = await prisma.user.create({
      data: {
        user_id: `A${suffix}`.slice(0, 5),
        email: `gw-admin-${Date.now()}@example.com`,
        cognito_sub: `sub-gw-admin-${Date.now()}`,
        cognito_username: `gw-admin-${Date.now()}`,
        first_name: "Admin",
        last_name: "User",
        roles: [UserRole.ADMIN],
      },
    });
    adminUserId = admin.user_id;
    createdUserIds.push(adminUserId);

    const investor = await prisma.user.create({
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
    createdUserIds.push(investor.user_id);

    const org = await prisma.investorOrganization.create({
      data: {
        owner_user_id: investor.user_id,
        type: OrganizationType.PERSONAL,
        first_name: "Jane",
        last_name: "Doe",
      },
    });
    orgId = org.id;
    createdOrgIds.push(orgId);
  });

  beforeEach(() => {
    mockRefundPayment.mockReset();
    mockRefundPayment.mockResolvedValue({
      id: "rfnd_admin_test",
      amount: 10000,
      payment_id: "pay_admin_test",
      status: "processed",
    });
  });

  afterAll(async () => {
    if (!migrated) return;
    if (createdPaymentIds.length > 0) {
      await prisma.noteLedgerEntry.deleteMany({
        where: { gateway_payment_id: { in: createdPaymentIds } },
      });
      await prisma.gatewayPaymentEvent.deleteMany({
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

  async function createHeldPayment() {
    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        organization_type: GatewayOrganizationType.INVESTOR,
        investor_organization_id: orgId,
        amount: new Prisma.Decimal("100.000000"),
        currency: "MYR",
        status: GatewayPaymentStatus.HELD,
        curlec_order_id: `order_admin_${Date.now()}`,
        curlec_payment_id: `pay_admin_${Date.now()}`,
        payer_name: "Wrong Name",
        name_check_result: NameCheckResult.FAIL,
        name_check_at: new Date(),
        idempotency_key: `admin-held:${Date.now()}`,
      },
    });
    createdPaymentIds.push(payment.id);
    return payment;
  }

  async function createNameCheckPendingPayment() {
    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        organization_type: GatewayOrganizationType.INVESTOR,
        investor_organization_id: orgId,
        amount: new Prisma.Decimal("75.000000"),
        currency: "MYR",
        status: GatewayPaymentStatus.NAME_CHECK_PENDING,
        curlec_order_id: `order_review_${Date.now()}`,
        curlec_payment_id: `pay_review_${Date.now()}`,
        payer_name: "Jane M Doe",
        name_check_result: NameCheckResult.REVIEW,
        name_check_at: new Date(),
        idempotency_key: `admin-review:${Date.now()}`,
      },
    });
    createdPaymentIds.push(payment.id);
    return payment;
  }

  it("retries refund for a HELD investor deposit", async () => {
    if (!migrated) return;

    const payment = await createHeldPayment();
    const detail = await retryHeldDepositRefund({ userId: adminUserId }, payment.id, prisma);

    expect(detail.status).toBe(GatewayPaymentStatus.REFUND_INITIATED);
    expect(detail.refundReference).toBe("rfnd_admin_test");
    expect(mockRefundPayment).toHaveBeenCalledTimes(1);
  });

  it("initiates refund for a COMPLETED investor deposit", async () => {
    if (!migrated) return;

    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        organization_type: GatewayOrganizationType.INVESTOR,
        investor_organization_id: orgId,
        amount: new Prisma.Decimal("50.000000"),
        currency: "MYR",
        status: GatewayPaymentStatus.COMPLETED,
        curlec_order_id: `order_completed_${Date.now()}`,
        curlec_payment_id: `pay_completed_${Date.now()}`,
        idempotency_key: `admin-completed:${Date.now()}`,
      },
    });
    createdPaymentIds.push(payment.id);

    const detail = await initiateCompletedDepositRefund(
      { userId: adminUserId },
      payment.id,
      "Post-credit correction",
      prisma
    );

    expect(detail.status).toBe(GatewayPaymentStatus.REFUND_INITIATED);
    expect(mockRefundPayment).toHaveBeenCalledTimes(1);
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

  it("approves a pending name check and credits the deposit", async () => {
    if (!migrated) return;

    const payment = await createNameCheckPendingPayment();
    const detail = await approveNameCheck({ userId: adminUserId }, payment.id, prisma);

    expect(detail.status).toBe(GatewayPaymentStatus.COMPLETED);
    expect(detail.nameCheckResult).toBe(NameCheckResult.PASS);

    const org = await prisma.investorOrganization.findUniqueOrThrow({ where: { id: orgId } });
    expect(org.deposit_received).toBe(true);
  });

  it("rejects a pending name check and initiates refund", async () => {
    if (!migrated) return;

    const payment = await createNameCheckPendingPayment();
    const detail = await rejectNameCheck({ userId: adminUserId }, payment.id, prisma);

    expect(detail.status).toBe(GatewayPaymentStatus.REFUND_INITIATED);
    expect(mockRefundPayment).toHaveBeenCalledTimes(1);
  });
});
