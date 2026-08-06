import {
  CurlecGatewayAccount,
  GatewayOrganizationType,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  InvestorBalanceTransactionDirection,
  InvestorBalanceTransactionSource,
  OrganizationType,
  Prisma,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import { retryHeldDepositRefund } from "./admin-service";
import { completeInvestorDepositRefund, initiateInvestorDepositRefund } from "./refund-service";
import { createCurlecClient } from "./curlec-client";

const prisma = new PrismaClient();
const mockRefundPayment = jest.fn();

jest.mock("./curlec-client", () => ({
  createCurlecClient: jest.fn(() => ({
    refundPayment: (...args: unknown[]) => mockRefundPayment(...args),
    fetchRefund: jest.fn(async () => ({ id: "rfnd_wallet_test", status: "processed" })),
    fetchPaymentRefunds: jest.fn(async () => []),
  })),
}));

async function gatewayTablesMigrated(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1 FROM gateway_payments LIMIT 1`;
    return true;
  } catch {
    return false;
  }
}

const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

describeIntegration("refund confirmed + wallet reversal recovery", () => {
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
        user_id: `W${suffix}`.slice(0, 5),
        email: `wallet-admin-${Date.now()}@example.com`,
        cognito_sub: `sub-wallet-admin-${Date.now()}`,
        cognito_username: `wallet-admin-${Date.now()}`,
        first_name: "Admin",
        last_name: "User",
        roles: [UserRole.ADMIN],
      },
    });
    adminUserId = admin.user_id;
    createdUserIds.push(adminUserId);

    const investor = await prisma.user.create({
      data: {
        user_id: `V${suffix}`.slice(0, 5),
        email: `wallet-inv-${Date.now()}@example.com`,
        cognito_sub: `sub-wallet-inv-${Date.now()}`,
        cognito_username: `wallet-inv-${Date.now()}`,
        first_name: "Jane",
        last_name: "Doe",
        roles: [UserRole.INVESTOR],
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
    mockRefundPayment.mockResolvedValue({ id: "rfnd_wallet_test", status: "processed" });
    (createCurlecClient as jest.Mock).mockClear();
  });

  afterAll(async () => {
    if (createdPaymentIds.length) {
      await prisma.investorBalanceTransaction.deleteMany({
        where: {
          OR: createdPaymentIds.flatMap((id) => [
            { idempotency_key: `gateway-deposit:balance:${id}` },
            { idempotency_key: `gateway-deposit:refund:${id}` },
            { idempotency_key: `gateway-deposit:refund-hold:${id}` },
            { idempotency_key: { startsWith: `gateway-deposit:refund-hold:${id}` } },
            { idempotency_key: { startsWith: `gateway-deposit:refund-hold-release:gateway-deposit:refund-hold:${id}` } },
          ]),
        },
      });
      await prisma.noteLedgerEntry.deleteMany({
        where: {
          idempotency_key: {
            in: createdPaymentIds.flatMap((id) => [
              `gateway-deposit:ledger:${id}`,
              `gateway-deposit:refund-ledger:${id}`,
            ]),
          },
        },
      });
      await prisma.gatewayPaymentEvent.deleteMany({
        where: { gateway_payment_id: { in: createdPaymentIds } },
      });
      await prisma.gatewayPayment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdOrgIds.length) {
      await prisma.investorBalance.deleteMany({
        where: { investor_organization_id: { in: createdOrgIds } },
      });
      await prisma.investorOrganization.deleteMany({ where: { id: { in: createdOrgIds } } });
    }
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { user_id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  async function seedCompletedDeposit(gatewayAccount: CurlecGatewayAccount, available: number) {
    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        organization_type: GatewayOrganizationType.INVESTOR,
        gatewayAccount,
        investor_organization_id: orgId,
        amount: new Prisma.Decimal("100.000000"),
        currency: "MYR",
        status: GatewayPaymentStatus.COMPLETED,
        curlec_order_id: `order_wallet_${gatewayAccount}_${Date.now()}`,
        curlec_payment_id: `pay_wallet_${gatewayAccount}_${Date.now()}`,
        idempotency_key: `wallet-completed:${gatewayAccount}:${Date.now()}`,
      },
    });
    createdPaymentIds.push(payment.id);

    await prisma.investorBalance.upsert({
      where: { investor_organization_id: orgId },
      create: {
        investor_organization_id: orgId,
        available_amount: new Prisma.Decimal(available.toFixed(6)),
      },
      update: {
        available_amount: new Prisma.Decimal(available.toFixed(6)),
      },
    });

    await prisma.investorBalanceTransaction.create({
      data: {
        investor_organization_id: orgId,
        direction: InvestorBalanceTransactionDirection.IN,
        amount: new Prisma.Decimal("100.000000"),
        source: InvestorBalanceTransactionSource.GATEWAY_DEPOSIT,
        idempotency_key: `gateway-deposit:balance:${payment.id}`,
      },
    });

    return payment;
  }

  it("moves to HELD when confirmed refund wallet debit fails for insufficient balance", async () => {
    if (!migrated) return;

    const payment = await seedCompletedDeposit(CurlecGatewayAccount.INVESTOR_POOL, 10);
    await prisma.gatewayPayment.update({
      where: { id: payment.id },
      data: {
        status: GatewayPaymentStatus.REFUND_INITIATED,
        refund_reference: "rfnd_confirmed_1",
      },
    });

    await completeInvestorDepositRefund(
      { ...payment, status: GatewayPaymentStatus.REFUND_INITIATED, refund_reference: "rfnd_confirmed_1" },
      { refundId: "rfnd_confirmed_1" },
      prisma
    );

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.HELD);
    expect(updated.gatewayAccount).toBe(CurlecGatewayAccount.INVESTOR_POOL);

    const refundDebits = await prisma.investorBalanceTransaction.count({
      where: { idempotency_key: `gateway-deposit:refund:${payment.id}` },
    });
    expect(refundDebits).toBe(0);

    const holdDebits = await prisma.investorBalanceTransaction.findMany({
      where: {
        investor_organization_id: orgId,
        source: InvestorBalanceTransactionSource.GATEWAY_DEPOSIT_REFUND_HOLD,
        idempotency_key: { startsWith: `gateway-deposit:refund-hold:${payment.id}` },
      },
    });
    expect(holdDebits.length).toBe(1);
    expect(holdDebits[0]?.amount.toNumber()).toBe(10);

    const balance = await prisma.investorBalance.findUniqueOrThrow({
      where: { investor_organization_id: orgId },
    });
    expect(balance.available_amount.toNumber()).toBe(0);

    const metadata = updated.metadata as Record<string, unknown>;
    expect(metadata.refundConfirmedWalletReversalFailed).toMatchObject({
      refundId: "rfnd_confirmed_1",
      gatewayAccount: CurlecGatewayAccount.INVESTOR_POOL,
      fundsBlocked: true,
      blockedAmount: 10,
      fundsProtected: false,
      intendedReversalAmount: 100,
    });
  });

  it("duplicate completeInvestorDepositRefund does not double debit after recovery", async () => {
    if (!migrated) return;

    const payment = await seedCompletedDeposit(CurlecGatewayAccount.INVESTOR_POOL, 100);
    await prisma.gatewayPayment.update({
      where: { id: payment.id },
      data: {
        status: GatewayPaymentStatus.REFUND_INITIATED,
        refund_reference: "rfnd_dup_1",
      },
    });

    const current = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    await completeInvestorDepositRefund(current, { refundId: "rfnd_dup_1" }, prisma);
    await completeInvestorDepositRefund(
      { ...current, status: GatewayPaymentStatus.REFUNDED },
      { refundId: "rfnd_dup_1" },
      prisma
    );

    const refundDebits = await prisma.investorBalanceTransaction.count({
      where: { idempotency_key: `gateway-deposit:refund:${payment.id}` },
    });
    expect(refundDebits).toBe(1);
    const final = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(final.status).toBe(GatewayPaymentStatus.REFUNDED);
  });

  it("wallet-only admin retry recovers HELD confirmed-refund failure without calling Curlec", async () => {
    if (!migrated) return;

    const payment = await seedCompletedDeposit(CurlecGatewayAccount.INVESTOR_POOL, 10);
    await prisma.gatewayPayment.update({
      where: { id: payment.id },
      data: {
        status: GatewayPaymentStatus.HELD,
        refund_reference: "rfnd_retry_1",
        metadata: {
          refundConfirmedWalletReversalFailed: {
            refundId: "rfnd_retry_1",
            error: "Insufficient available balance",
            errorCode: "INSUFFICIENT_INVESTOR_BALANCE",
            gatewayAccount: CurlecGatewayAccount.INVESTOR_POOL,
            at: new Date().toISOString(),
          },
        },
      },
    });

    const stillHeld = await retryHeldDepositRefund({ userId: adminUserId }, payment.id, prisma);
    expect(stillHeld.status).toBe(GatewayPaymentStatus.HELD);
    expect(mockRefundPayment).not.toHaveBeenCalled();

    await prisma.investorBalance.update({
      where: { investor_organization_id: orgId },
      data: { available_amount: new Prisma.Decimal("100.000000") },
    });

    const detail = await retryHeldDepositRefund({ userId: adminUserId }, payment.id, prisma);
    expect(detail.status).toBe(GatewayPaymentStatus.REFUNDED);
    expect(mockRefundPayment).not.toHaveBeenCalled();

    const refundDebits = await prisma.investorBalanceTransaction.count({
      where: { idempotency_key: `gateway-deposit:refund:${payment.id}` },
    });
    expect(refundDebits).toBe(1);

    await expect(
      retryHeldDepositRefund({ userId: adminUserId }, payment.id, prisma)
    ).rejects.toMatchObject({ code: "INVALID_GATEWAY_STATUS" });
    expect(
      await prisma.investorBalanceTransaction.count({
        where: { idempotency_key: `gateway-deposit:refund:${payment.id}` },
      })
    ).toBe(1);
  });

  it("blocked hold reduces available balance so further wallet spend cannot use refunded cash", async () => {
    if (!migrated) return;

    const payment = await seedCompletedDeposit(CurlecGatewayAccount.INVESTOR_POOL, 100);
    await prisma.gatewayPayment.update({
      where: { id: payment.id },
      data: {
        status: GatewayPaymentStatus.REFUND_INITIATED,
        refund_reference: "rfnd_block_1",
      },
    });

    // Simulate spent funds leaving only RM40 before reversal.
    await prisma.investorBalance.update({
      where: { investor_organization_id: orgId },
      data: { available_amount: new Prisma.Decimal("40.000000") },
    });

    await completeInvestorDepositRefund(
      {
        ...payment,
        status: GatewayPaymentStatus.REFUND_INITIATED,
        refund_reference: "rfnd_block_1",
      },
      { refundId: "rfnd_block_1" },
      prisma
    );

    const balance = await prisma.investorBalance.findUniqueOrThrow({
      where: { investor_organization_id: orgId },
    });
    expect(balance.available_amount.toNumber()).toBe(0);

    await expect(
      prisma.$transaction(async (tx) => {
        const { debitInvestorBalanceForCommit } = await import("../notes/investor-balance");
        await debitInvestorBalanceForCommit(tx, {
          investorOrganizationId: orgId,
          amount: 10,
          noteId: "00000000-0000-4000-8000-000000000001",
          noteInvestmentId: "00000000-0000-4000-8000-000000000002",
          idempotencyKey: `test-invest-blocked:${payment.id}`,
        });
      })
    ).rejects.toMatchObject({ code: "INSUFFICIENT_INVESTOR_BALANCE" });
  });

  it("fee refund completion does not create wallet reversal transactions", async () => {
    if (!migrated) return;

    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        organization_type: GatewayOrganizationType.ISSUER,
        gatewayAccount: CurlecGatewayAccount.OPERATING,
        amount: new Prisma.Decimal("50.000000"),
        currency: "MYR",
        status: GatewayPaymentStatus.REFUND_INITIATED,
        curlec_order_id: `order_fee_${Date.now()}`,
        curlec_payment_id: `pay_fee_${Date.now()}`,
        refund_reference: "rfnd_fee_1",
        idempotency_key: `wallet-fee:${Date.now()}`,
      },
    });
    createdPaymentIds.push(payment.id);

    await completeInvestorDepositRefund(payment, { refundId: "rfnd_fee_1" }, prisma);

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.REFUNDED);
    expect(
      await prisma.investorBalanceTransaction.count({
        where: {
          OR: [
            { idempotency_key: `gateway-deposit:refund:${payment.id}` },
            { idempotency_key: `gateway-deposit:refund-hold:${payment.id}` },
          ],
        },
      })
    ).toBe(0);
  });

  it("failed remote refund does not debit wallet", async () => {
    if (!migrated) return;

    mockRefundPayment.mockRejectedValueOnce(new Error("Curlec refund failed"));
    const payment = await seedCompletedDeposit(CurlecGatewayAccount.OPERATING, 100);
    await prisma.gatewayPayment.update({
      where: { id: payment.id },
      data: { status: GatewayPaymentStatus.PAID },
    });
    const paid = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });

    const status = await initiateInvestorDepositRefund(
      paid,
      {
        reason: "ADMIN_INITIATED",
        curlecPaymentId: paid.curlec_payment_id!,
        actorUserId: adminUserId,
      },
      prisma
    );

    expect(status).toBe(GatewayPaymentStatus.HELD);
    const refundDebits = await prisma.investorBalanceTransaction.count({
      where: { idempotency_key: `gateway-deposit:refund:${payment.id}` },
    });
    expect(refundDebits).toBe(0);
    expect((createCurlecClient as jest.Mock).mock.calls.at(-1)?.[0]).toEqual({
      gatewayAccount: CurlecGatewayAccount.OPERATING,
    });
  });

  it("uses INVESTOR_POOL credentials for investor-pool refund initiation", async () => {
    if (!migrated) return;

    const payment = await seedCompletedDeposit(CurlecGatewayAccount.INVESTOR_POOL, 100);
    await initiateInvestorDepositRefund(
      payment,
      {
        reason: "ADMIN_INITIATED",
        curlecPaymentId: payment.curlec_payment_id!,
        actorUserId: adminUserId,
      },
      prisma
    );

    expect((createCurlecClient as jest.Mock).mock.calls.at(-1)?.[0]).toEqual({
      gatewayAccount: CurlecGatewayAccount.INVESTOR_POOL,
    });
  });
});
