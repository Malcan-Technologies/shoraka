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
import {
  adoptGatewayRefundCreated,
  completeGatewayPaymentRefund,
  failGatewayPaymentRefund,
} from "./refund-service";
import { createCurlecClient } from "./curlec-client";

const prisma = new PrismaClient();
const mockRefundPayment = jest.fn();

jest.mock("./curlec-client", () => ({
  createCurlecClient: jest.fn(() => ({
    refundPayment: (...args: unknown[]) => mockRefundPayment(...args),
    fetchRefund: jest.fn(async (id: string) => ({ id, status: "processed" })),
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

describeIntegration("external Curlec refund on COMPLETED payments", () => {
  let migrated = false;
  let investorOrgId = "";
  let issuerOrgId = "";
  const createdPaymentIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    migrated = await gatewayTablesMigrated();
    if (!migrated) return;

    const suffix = `${Date.now()}`.slice(-4);
    const investor = await prisma.user.create({
      data: {
        user_id: `X${suffix}`.slice(0, 5),
        email: `ext-refund-inv-${Date.now()}@example.com`,
        cognito_sub: `sub-ext-inv-${Date.now()}`,
        cognito_username: `ext-inv-${Date.now()}`,
        first_name: "Ext",
        last_name: "Investor",
        roles: [UserRole.INVESTOR],
      },
    });
    createdUserIds.push(investor.user_id);

    const investorOrg = await prisma.investorOrganization.create({
      data: {
        owner_user_id: investor.user_id,
        type: OrganizationType.PERSONAL,
        first_name: "Ext",
        last_name: "Investor",
      },
    });
    investorOrgId = investorOrg.id;
    createdOrgIds.push(investorOrgId);

    const issuer = await prisma.user.create({
      data: {
        user_id: `Y${suffix}`.slice(0, 5),
        email: `ext-refund-iss-${Date.now()}@example.com`,
        cognito_sub: `sub-ext-iss-${Date.now()}`,
        cognito_username: `ext-iss-${Date.now()}`,
        first_name: "Ext",
        last_name: "Issuer",
        roles: [UserRole.ISSUER],
        issuer_account: ["COMPANY"],
      },
    });
    createdUserIds.push(issuer.user_id);

    const issuerOrg = await prisma.issuerOrganization.create({
      data: {
        owner_user_id: issuer.user_id,
        type: OrganizationType.COMPANY,
        name: "Ext Refund Co",
        tnc_accepted: true,
        onboarding_fee_paid_at: new Date(),
      },
    });
    issuerOrgId = issuerOrg.id;
    createdOrgIds.push(issuerOrgId);
  });

  beforeEach(async () => {
    mockRefundPayment.mockReset();
    (createCurlecClient as jest.Mock).mockClear();
    if (!migrated || !issuerOrgId) return;
    await prisma.gatewayPayment.updateMany({
      where: {
        issuer_organization_id: issuerOrgId,
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        status: {
          in: [
            GatewayPaymentStatus.CREATED,
            GatewayPaymentStatus.HELD,
            GatewayPaymentStatus.REFUND_INITIATED,
            GatewayPaymentStatus.COMPLETED,
          ],
        },
      },
      data: { status: GatewayPaymentStatus.FAILED },
    });
    await prisma.issuerOrganization.update({
      where: { id: issuerOrgId },
      data: { onboarding_fee_paid_at: new Date() },
    });
  });

  afterAll(async () => {
    if (createdPaymentIds.length) {
      await prisma.investorBalanceTransaction.deleteMany({
        where: {
          OR: createdPaymentIds.flatMap((id) => [
            { idempotency_key: `gateway-deposit:balance:${id}` },
            { idempotency_key: `gateway-deposit:refund:${id}` },
            { idempotency_key: { startsWith: `gateway-deposit:refund-hold:${id}` } },
            {
              idempotency_key: {
                startsWith: `gateway-deposit:refund-hold-release:gateway-deposit:refund-hold:${id}`,
              },
            },
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
    if (investorOrgId) {
      await prisma.investorBalance.deleteMany({
        where: { investor_organization_id: investorOrgId },
      });
    }
    if (createdOrgIds.length) {
      await prisma.investorOrganization.deleteMany({
        where: { id: { in: createdOrgIds } },
      });
      await prisma.issuerOrganization.deleteMany({
        where: { id: { in: createdOrgIds } },
      });
    }
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { user_id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  async function seedCompletedDeposit(available: number, gatewayAccount = CurlecGatewayAccount.INVESTOR_POOL) {
    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        organization_type: GatewayOrganizationType.INVESTOR,
        gatewayAccount,
        investor_organization_id: investorOrgId,
        amount: new Prisma.Decimal("100.000000"),
        currency: "MYR",
        status: GatewayPaymentStatus.COMPLETED,
        curlec_order_id: `order_ext_${gatewayAccount}_${Date.now()}`,
        curlec_payment_id: `pay_ext_${gatewayAccount}_${Date.now()}`,
        idempotency_key: `ext-completed:${gatewayAccount}:${Date.now()}`,
      },
    });
    createdPaymentIds.push(payment.id);

    await prisma.investorBalance.upsert({
      where: { investor_organization_id: investorOrgId },
      create: {
        investor_organization_id: investorOrgId,
        available_amount: new Prisma.Decimal(available.toFixed(6)),
      },
      update: {
        available_amount: new Prisma.Decimal(available.toFixed(6)),
      },
    });

    await prisma.investorBalanceTransaction.create({
      data: {
        investor_organization_id: investorOrgId,
        direction: InvestorBalanceTransactionDirection.IN,
        amount: new Prisma.Decimal("100.000000"),
        source: InvestorBalanceTransactionSource.GATEWAY_DEPOSIT,
        idempotency_key: `gateway-deposit:balance:${payment.id}`,
      },
    });

    return payment;
  }

  it("COMPLETED deposit + refund.created adopts refund id and blocks wallet", async () => {
    if (!migrated) return;

    const payment = await seedCompletedDeposit(100);
    const status = await adoptGatewayRefundCreated(
      payment,
      { refundId: "rfnd_ext_created_1" },
      prisma
    );

    expect(status).toBe(GatewayPaymentStatus.REFUND_INITIATED);
    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.refund_reference).toBe("rfnd_ext_created_1");
    expect(updated.metadata).toMatchObject({
      externalCurlecRefund: {
        source: "CURLEC_PROVIDER",
        refundId: "rfnd_ext_created_1",
        fundsProtected: true,
        blockedAmount: 100,
      },
    });

    const balance = await prisma.investorBalance.findUniqueOrThrow({
      where: { investor_organization_id: investorOrgId },
    });
    expect(balance.available_amount.toNumber()).toBe(0);
    expect(mockRefundPayment).not.toHaveBeenCalled();
  });

  it("duplicate refund.created is idempotent", async () => {
    if (!migrated) return;

    const payment = await seedCompletedDeposit(100);
    await adoptGatewayRefundCreated(payment, { refundId: "rfnd_ext_dup" }, prisma);
    const again = await adoptGatewayRefundCreated(
      await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } }),
      { refundId: "rfnd_ext_dup" },
      prisma
    );
    expect(again).toBe(GatewayPaymentStatus.REFUND_INITIATED);

    const holds = await prisma.investorBalanceTransaction.count({
      where: {
        idempotency_key: `gateway-deposit:refund-hold:${payment.id}`,
        source: InvestorBalanceTransactionSource.GATEWAY_DEPOSIT_REFUND_HOLD,
      },
    });
    expect(holds).toBe(1);
    expect(mockRefundPayment).not.toHaveBeenCalled();
  });

  it("COMPLETED deposit + refund.processed reverses wallet to REFUNDED", async () => {
    if (!migrated) return;

    const payment = await seedCompletedDeposit(100);
    await completeGatewayPaymentRefund(payment, { refundId: "rfnd_ext_proc_ok" }, prisma);

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.REFUNDED);
    expect(updated.refund_reference).toBe("rfnd_ext_proc_ok");
    expect(
      await prisma.investorBalanceTransaction.count({
        where: { idempotency_key: `gateway-deposit:refund:${payment.id}` },
      })
    ).toBe(1);
    expect(mockRefundPayment).not.toHaveBeenCalled();
  });

  it("duplicate refund.processed does not double debit", async () => {
    if (!migrated) return;

    const payment = await seedCompletedDeposit(100);
    await completeGatewayPaymentRefund(payment, { refundId: "rfnd_ext_proc_dup" }, prisma);
    await completeGatewayPaymentRefund(
      { ...payment, status: GatewayPaymentStatus.REFUNDED },
      { refundId: "rfnd_ext_proc_dup" },
      prisma
    );
    expect(
      await prisma.investorBalanceTransaction.count({
        where: { idempotency_key: `gateway-deposit:refund:${payment.id}` },
      })
    ).toBe(1);
  });

  it("COMPLETED deposit + refund.processed with insufficient funds goes HELD unprotected", async () => {
    if (!migrated) return;

    const payment = await seedCompletedDeposit(10);
    await completeGatewayPaymentRefund(payment, { refundId: "rfnd_ext_short" }, prisma);

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.HELD);
    expect(updated.metadata).toMatchObject({
      externalCurlecRefund: { source: "CURLEC_PROVIDER" },
      refundConfirmedWalletReversalFailed: {
        fundsProtected: false,
        blockedAmount: 10,
        intendedReversalAmount: 100,
      },
    });
    expect(mockRefundPayment).not.toHaveBeenCalled();
  });

  it("refund.failed after external adoption restores COMPLETED and releases hold", async () => {
    if (!migrated) return;

    const payment = await seedCompletedDeposit(100);
    await adoptGatewayRefundCreated(payment, { refundId: "rfnd_ext_fail" }, prisma);
    const adopted = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    await failGatewayPaymentRefund(
      adopted,
      { refundId: "rfnd_ext_fail", errorMessage: "provider cancelled" },
      prisma
    );

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.COMPLETED);
    expect(updated.refund_reference).toBeNull();
    const balance = await prisma.investorBalance.findUniqueOrThrow({
      where: { investor_organization_id: investorOrgId },
    });
    expect(balance.available_amount.toNumber()).toBe(100);
  });

  it("COMPLETED onboarding fee + refund.processed becomes REFUNDED without Curlec API call", async () => {
    if (!migrated) return;

    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        organization_type: GatewayOrganizationType.ISSUER,
        gatewayAccount: CurlecGatewayAccount.OPERATING,
        issuer_organization_id: issuerOrgId,
        amount: new Prisma.Decimal("150.000000"),
        currency: "MYR",
        status: GatewayPaymentStatus.COMPLETED,
        curlec_order_id: `order_ext_fee_${Date.now()}`,
        curlec_payment_id: `pay_ext_fee_${Date.now()}`,
        idempotency_key: `ext-fee:${Date.now()}`,
      },
    });
    createdPaymentIds.push(payment.id);

    await completeGatewayPaymentRefund(payment, { refundId: "rfnd_ext_fee" }, prisma);

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.REFUNDED);
    expect(updated.metadata).toMatchObject({
      externalCurlecRefund: { source: "CURLEC_PROVIDER", refundId: "rfnd_ext_fee" },
    });
    const org = await prisma.issuerOrganization.findUniqueOrThrow({ where: { id: issuerOrgId } });
    expect(org.onboarding_fee_paid_at).toBeNull();
    expect(mockRefundPayment).not.toHaveBeenCalled();
  });

  it("refund.created on COMPLETED onboarding fee clears paid_at and blocks progression", async () => {
    if (!migrated) return;

    const paidAt = new Date("2026-01-15T10:00:00.000Z");
    await prisma.issuerOrganization.update({
      where: { id: issuerOrgId },
      data: {
        onboarding_fee_paid_at: paidAt,
        name: "Ext Refund Co",
        tnc_accepted: true,
      },
    });

    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        organization_type: GatewayOrganizationType.ISSUER,
        gatewayAccount: CurlecGatewayAccount.OPERATING,
        issuer_organization_id: issuerOrgId,
        amount: new Prisma.Decimal("150.000000"),
        currency: "MYR",
        status: GatewayPaymentStatus.COMPLETED,
        curlec_order_id: `order_ext_fee_init_${Date.now()}`,
        curlec_payment_id: `pay_ext_fee_init_${Date.now()}`,
        idempotency_key: `ext-fee-init:${Date.now()}`,
      },
    });
    createdPaymentIds.push(payment.id);

    const status = await adoptGatewayRefundCreated(
      payment,
      { refundId: "rfnd_ext_fee_init" },
      prisma
    );
    expect(status).toBe(GatewayPaymentStatus.REFUND_INITIATED);

    const org = await prisma.issuerOrganization.findUniqueOrThrow({ where: { id: issuerOrgId } });
    expect(org.onboarding_fee_paid_at).toBeNull();
    expect(org.name).toBe("Ext Refund Co");
    expect(org.tnc_accepted).toBe(true);

    const { assertIssuerOnboardingFeePaid } = await import("./onboarding-fee-service");
    await expect(assertIssuerOnboardingFeePaid(prisma, issuerOrgId)).rejects.toMatchObject({
      statusCode: 402,
      code: "ONBOARDING_FEE_REQUIRED",
    });
  });

  it("HELD onboarding fee blocks progression while paid_at may still be set", async () => {
    if (!migrated) return;

    await prisma.issuerOrganization.update({
      where: { id: issuerOrgId },
      data: { onboarding_fee_paid_at: new Date() },
    });

    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        organization_type: GatewayOrganizationType.ISSUER,
        gatewayAccount: CurlecGatewayAccount.OPERATING,
        issuer_organization_id: issuerOrgId,
        amount: new Prisma.Decimal("150.000000"),
        currency: "MYR",
        status: GatewayPaymentStatus.HELD,
        curlec_order_id: `order_ext_fee_held_${Date.now()}`,
        curlec_payment_id: `pay_ext_fee_held_${Date.now()}`,
        idempotency_key: `ext-fee-held:${Date.now()}`,
      },
    });
    createdPaymentIds.push(payment.id);

    const { assertIssuerOnboardingFeePaid } = await import("./onboarding-fee-service");
    await expect(assertIssuerOnboardingFeePaid(prisma, issuerOrgId)).rejects.toMatchObject({
      code: "ONBOARDING_FEE_REQUIRED",
    });
  });

  it("refund.failed after onboarding fee adoption restores paid_at", async () => {
    if (!migrated) return;

    const paidAt = new Date("2026-02-01T08:00:00.000Z");
    await prisma.issuerOrganization.update({
      where: { id: issuerOrgId },
      data: { onboarding_fee_paid_at: paidAt },
    });

    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        organization_type: GatewayOrganizationType.ISSUER,
        gatewayAccount: CurlecGatewayAccount.OPERATING,
        issuer_organization_id: issuerOrgId,
        amount: new Prisma.Decimal("150.000000"),
        currency: "MYR",
        status: GatewayPaymentStatus.COMPLETED,
        curlec_order_id: `order_ext_fee_fail_${Date.now()}`,
        curlec_payment_id: `pay_ext_fee_fail_${Date.now()}`,
        idempotency_key: `ext-fee-fail:${Date.now()}`,
      },
    });
    createdPaymentIds.push(payment.id);

    await adoptGatewayRefundCreated(payment, { refundId: "rfnd_ext_fee_fail" }, prisma);
    const mid = await prisma.issuerOrganization.findUniqueOrThrow({ where: { id: issuerOrgId } });
    expect(mid.onboarding_fee_paid_at).toBeNull();

    const adopted = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    await failGatewayPaymentRefund(
      adopted,
      { refundId: "rfnd_ext_fee_fail", errorMessage: "provider cancelled" },
      prisma
    );

    const restored = await prisma.issuerOrganization.findUniqueOrThrow({
      where: { id: issuerOrgId },
    });
    expect(restored.onboarding_fee_paid_at).not.toBeNull();
    expect(restored.onboarding_fee_paid_at?.toISOString()).toBe(paidAt.toISOString());

    const { assertIssuerOnboardingFeePaid } = await import("./onboarding-fee-service");
    await expect(assertIssuerOnboardingFeePaid(prisma, issuerOrgId)).resolves.toBeUndefined();
  });

  it("duplicate refund.processed on onboarding fee stays idempotent", async () => {
    if (!migrated) return;

    await prisma.issuerOrganization.update({
      where: { id: issuerOrgId },
      data: { onboarding_fee_paid_at: new Date() },
    });

    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        organization_type: GatewayOrganizationType.ISSUER,
        gatewayAccount: CurlecGatewayAccount.OPERATING,
        issuer_organization_id: issuerOrgId,
        amount: new Prisma.Decimal("150.000000"),
        currency: "MYR",
        status: GatewayPaymentStatus.COMPLETED,
        curlec_order_id: `order_ext_fee_dup_${Date.now()}`,
        curlec_payment_id: `pay_ext_fee_dup_${Date.now()}`,
        idempotency_key: `ext-fee-dup:${Date.now()}`,
      },
    });
    createdPaymentIds.push(payment.id);

    await completeGatewayPaymentRefund(payment, { refundId: "rfnd_ext_fee_dup" }, prisma);
    const afterFirst = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    await completeGatewayPaymentRefund(afterFirst, { refundId: "rfnd_ext_fee_dup" }, prisma);

    const afterSecond = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(afterSecond.status).toBe(GatewayPaymentStatus.REFUNDED);
    const org = await prisma.issuerOrganization.findUniqueOrThrow({ where: { id: issuerOrgId } });
    expect(org.onboarding_fee_paid_at).toBeNull();
  });

  it("REFUNDED onboarding fee status requires repayment and still blocks progression", async () => {
    if (!migrated) return;

    await prisma.issuerOrganization.update({
      where: { id: issuerOrgId },
      data: { onboarding_fee_paid_at: null },
    });

    const refunded = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        organization_type: GatewayOrganizationType.ISSUER,
        gatewayAccount: CurlecGatewayAccount.OPERATING,
        issuer_organization_id: issuerOrgId,
        amount: new Prisma.Decimal("150.000000"),
        currency: "MYR",
        status: GatewayPaymentStatus.REFUNDED,
        refunded_at: new Date(),
        curlec_order_id: `order_ext_fee_old_${Date.now()}`,
        curlec_payment_id: `pay_ext_fee_old_${Date.now()}`,
        idempotency_key: `ext-fee-old:${Date.now()}`,
      },
    });
    createdPaymentIds.push(refunded.id);

    const {
      getIssuerOnboardingFeeStatus,
      assertIssuerOnboardingFeePaid,
    } = await import("./onboarding-fee-service");

    const owner = await prisma.issuerOrganization.findUniqueOrThrow({
      where: { id: issuerOrgId },
      select: { owner_user_id: true },
    });

    const statusBefore = await getIssuerOnboardingFeeStatus(
      { userId: owner.owner_user_id },
      issuerOrgId,
      prisma
    );
    expect(statusBefore.isPaid).toBe(false);
    expect(statusBefore.requiresRepayment).toBe(true);
    expect(statusBefore.isUnderReview).toBe(false);

    await expect(assertIssuerOnboardingFeePaid(prisma, issuerOrgId)).rejects.toMatchObject({
      code: "ONBOARDING_FEE_REQUIRED",
    });
  });

  it("OPERATING and INVESTOR_POOL deposits both adopt external refunds", async () => {
    if (!migrated) return;

    for (const account of [CurlecGatewayAccount.INVESTOR_POOL, CurlecGatewayAccount.OPERATING]) {
      const payment = await seedCompletedDeposit(100, account);
      const status = await adoptGatewayRefundCreated(
        payment,
        { refundId: `rfnd_ext_${account}` },
        prisma
      );
      expect(status).toBe(GatewayPaymentStatus.REFUND_INITIATED);
      const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(updated.gatewayAccount).toBe(account);
      expect(updated.refund_reference).toBe(`rfnd_ext_${account}`);
    }
    expect(mockRefundPayment).not.toHaveBeenCalled();
  });
});
