import {
  CurlecGatewayAccount,
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
  getGatewayPaymentsExceptionCount,
  initiateCompletedDepositRefund,
  listGatewayPayments,
  rejectNameCheck,
  retryHeldDepositRefund,
} from "./admin-service";
import { createCurlecClient } from "./curlec-client";
import * as curlecConfig from "../../config/curlec";

const prisma = new PrismaClient();

const mockRefundPayment = jest.fn();

jest.mock("./curlec-client", () => ({
  createCurlecClient: jest.fn(() => ({
    refundPayment: (...args: unknown[]) => mockRefundPayment(...args),
  })),
}));

// Name-check approval schedules receipt PDF asynchronously. These admin tests
// do not cover receipts — avoid racing afterAll payment deletes.
jest.mock("./receipt/receipt-service", () => {
  const actual = jest.requireActual("./receipt/receipt-service") as Record<string, unknown>;
  return {
    ...actual,
    scheduleGatewayPaymentReceipt: jest.fn(),
  };
});

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
    jest.restoreAllMocks();
    process.env.CURLEC_OPERATING_KEY_ID = "rzp_operating_key";
    process.env.CURLEC_OPERATING_KEY_SECRET = "operating_secret";
    process.env.CURLEC_OPERATING_WEBHOOK_SECRET = "operating_whsec";
    process.env.CURLEC_INVESTOR_POOL_KEY_ID = "rzp_pool_key";
    process.env.CURLEC_INVESTOR_POOL_KEY_SECRET = "pool_secret";
    process.env.CURLEC_INVESTOR_POOL_WEBHOOK_SECRET = "pool_whsec";
    curlecConfig.resetCurlecConfigCache();
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

  async function createHeldPayment(gatewayAccount: CurlecGatewayAccount = "OPERATING") {
    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        organization_type: GatewayOrganizationType.INVESTOR,
        gatewayAccount,
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
        gatewayAccount: "INVESTOR_POOL",
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
    expect((createCurlecClient as jest.Mock).mock.calls.at(-1)?.[0]).toEqual({
      gatewayAccount: "OPERATING",
    });
  });

  it("routes HELD refund retry to OPERATING account credentials", async () => {
    if (!migrated) return;

    const payment = await createHeldPayment("OPERATING");
    await retryHeldDepositRefund({ userId: adminUserId }, payment.id, prisma);

    expect((createCurlecClient as jest.Mock).mock.calls.at(-1)?.[0]).toEqual({
      gatewayAccount: "OPERATING",
    });
  });

  it("routes HELD refund retry to INVESTOR_POOL account credentials", async () => {
    if (!migrated) return;

    const payment = await createHeldPayment("INVESTOR_POOL");
    await retryHeldDepositRefund({ userId: adminUserId }, payment.id, prisma);

    expect((createCurlecClient as jest.Mock).mock.calls.at(-1)?.[0]).toEqual({
      gatewayAccount: "INVESTOR_POOL",
    });
  });

  it("fails before remote call when account credentials are missing", async () => {
    if (!migrated) return;

    const payment = await createHeldPayment("OPERATING");
    jest.spyOn(curlecConfig, "getCurlecConfig").mockImplementation((gatewayAccount = "OPERATING") => {
      if (gatewayAccount === "OPERATING") {
        throw new Error("missing operating credentials");
      }
      return {
        gatewayAccount,
        keyId: "key",
        keySecret: "secret",
        webhookSecret: "whsec",
        apiBaseUrl: "https://api.razorpay.com",
        environment: "sandbox",
      };
    });

    await expect(retryHeldDepositRefund({ userId: adminUserId }, payment.id, prisma)).rejects.toMatchObject(
      {
        code: "CURLEC_ACCOUNT_CONFIG_ERROR",
      }
    );
    expect(mockRefundPayment).not.toHaveBeenCalled();

    const current = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(current.status).toBe(GatewayPaymentStatus.HELD);
    expect(current.gatewayAccount).toBe("OPERATING");
  });

  it("initiates refund for a COMPLETED investor deposit", async () => {
    if (!migrated) return;

    const payment = await prisma.gatewayPayment.create({
      data: {
        gatewayAccount: "INVESTOR_POOL",
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
        gatewayAccount: "OPERATING",
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

  it("keeps exceptions list total equal to pending-count for mixed purposes and statuses", async () => {
    if (!migrated) return;

    const marker = `exc-parity-${Date.now()}`;
    const rows: Array<{
      purpose: GatewayPaymentPurpose;
      status: GatewayPaymentStatus;
      organization_type: GatewayOrganizationType;
    }> = [
      {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        status: GatewayPaymentStatus.HELD,
        organization_type: GatewayOrganizationType.INVESTOR,
      },
      {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        status: GatewayPaymentStatus.NAME_CHECK_PENDING,
        organization_type: GatewayOrganizationType.INVESTOR,
      },
      {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        status: GatewayPaymentStatus.COMPLETED,
        organization_type: GatewayOrganizationType.INVESTOR,
      },
      {
        purpose: GatewayPaymentPurpose.FACILITY_FEE,
        status: GatewayPaymentStatus.HELD,
        organization_type: GatewayOrganizationType.ISSUER,
      },
      {
        purpose: GatewayPaymentPurpose.FACILITY_FEE,
        status: GatewayPaymentStatus.NAME_CHECK_PENDING,
        organization_type: GatewayOrganizationType.ISSUER,
      },
    ];

    const created: Array<{
      id: string;
      purpose: GatewayPaymentPurpose;
      status: GatewayPaymentStatus;
    }> = [];
    for (const [index, row] of rows.entries()) {
      const payment = await prisma.gatewayPayment.create({
        data: {
          purpose: row.purpose,
          organization_type: row.organization_type,
          gatewayAccount:
            row.purpose === GatewayPaymentPurpose.INVESTOR_DEPOSIT
              ? CurlecGatewayAccount.INVESTOR_POOL
              : CurlecGatewayAccount.OPERATING,
          investor_organization_id:
            row.organization_type === GatewayOrganizationType.INVESTOR ? orgId : null,
          amount: new Prisma.Decimal("25.000000"),
          currency: "MYR",
          status: row.status,
          payer_name: marker,
          curlec_order_id: `order_${marker}_${index}`,
          curlec_payment_id: `pay_${marker}_${index}`,
          idempotency_key: `${marker}:${index}`,
        },
      });
      createdPaymentIds.push(payment.id);
      created.push(payment);
    }

    const [count, listed] = await Promise.all([
      getGatewayPaymentsExceptionCount(prisma),
      listGatewayPayments({ page: 1, pageSize: 100, filter: "exceptions" }, prisma),
    ]);
    expect(listed.total).toBe(count.count);
    expect(
      listed.items.every(
        (item) =>
          item.purpose === GatewayPaymentPurpose.INVESTOR_DEPOSIT &&
          (item.status === GatewayPaymentStatus.HELD ||
            item.status === GatewayPaymentStatus.NAME_CHECK_PENDING)
      )
    ).toBe(true);

    const scoped = await listGatewayPayments(
      { page: 1, pageSize: 20, filter: "exceptions", search: marker },
      prisma
    );
    expect(scoped.total).toBe(2);
    expect(scoped.items.map((item) => item.status).sort()).toEqual([
      GatewayPaymentStatus.HELD,
      GatewayPaymentStatus.NAME_CHECK_PENDING,
    ]);
    expect(scoped.items.every((item) => item.purpose === GatewayPaymentPurpose.INVESTOR_DEPOSIT)).toBe(
      true
    );
    expect(scoped.items.map((item) => item.id).sort()).toEqual(
      created
        .filter(
          (row) =>
            row.purpose === GatewayPaymentPurpose.INVESTOR_DEPOSIT &&
            (row.status === GatewayPaymentStatus.HELD ||
              row.status === GatewayPaymentStatus.NAME_CHECK_PENDING)
        )
        .map((row) => row.id)
        .sort()
    );

    const needsAttention = await listGatewayPayments(
      { page: 1, pageSize: 20, filter: "needs_attention", search: marker },
      prisma
    );
    expect(needsAttention.items.every((item) => item.status === GatewayPaymentStatus.HELD)).toBe(true);
    expect(needsAttention.items.some((item) => item.purpose === GatewayPaymentPurpose.FACILITY_FEE)).toBe(
      true
    );

    const review = await listGatewayPayments(
      { page: 1, pageSize: 20, filter: "review", search: marker },
      prisma
    );
    expect(review.items.every((item) => item.status === GatewayPaymentStatus.NAME_CHECK_PENDING)).toBe(
      true
    );
    expect(review.items.some((item) => item.purpose === GatewayPaymentPurpose.FACILITY_FEE)).toBe(true);
  });
});
