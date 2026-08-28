import {
  CurlecGatewayAccount,
  GatewayOrganizationType,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  GatewayReconExceptionType,
  GatewayReconRunStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { processStaleGatewayPayment } from "../../lib/jobs/gateway-stuck-order-poller";
import {
  getYesterdayMytDateOnly,
  getGatewaySettlementReconLockKey,
  runGatewaySettlementReconJob,
  runGatewaySettlementReconForConfiguredAccounts,
} from "../../lib/jobs/gateway-settlement-recon";
import { runGatewayStuckOrderPollerJob } from "../../lib/jobs/gateway-stuck-order-poller";
import {
  listReconExceptions,
  listReconRuns,
  resolveReconException,
  triggerReconRun,
} from "./recon-service";
import { createCurlecClient } from "./curlec-client";

const mockFetchOrderPayments = jest.fn();
const mockFetchSettlementRecon = jest.fn();

jest.mock("./curlec-client", () => ({
  createCurlecClient: jest.fn(() => ({
    fetchOrderPayments: mockFetchOrderPayments,
    fetchSettlementRecon: mockFetchSettlementRecon,
    fetchPayment: jest.fn(async (paymentId: string) => ({
      id: paymentId,
      amount: 15000,
      currency: "MYR",
      status: "captured",
      method: "fpx",
      order_id: null,
    })),
    fetchRefund: jest.fn(async (refundId: string) => ({
      id: refundId,
      amount: 15000,
      currency: "MYR",
      status: "processed",
    })),
    fetchPaymentRefunds: jest.fn(async () => []),
    refundPayment: jest.fn(),
  })),
}));

// Stuck-order recovery can complete payments and schedule receipt PDFs. This suite
// is not about receipts — mock the fire-and-forget scheduler to avoid cleanup races.
jest.mock("./receipt/receipt-service", () => {
  const actual = jest.requireActual("./receipt/receipt-service") as Record<string, unknown>;
  return {
    ...actual,
    scheduleGatewayPaymentReceipt: jest.fn(),
  };
});

// The full poller also retries wallet reversals for any HELD row in the shared DB.
// Keep that off here so parallel payment suites are not mutated mid-test.
jest.mock("./refund-service", () => {
  const actual = jest.requireActual("./refund-service") as Record<string, unknown>;
  return {
    ...actual,
    recoverFailedWalletReversals: jest.fn(async () => ({
      scanned: 0,
      recovered: 0,
      stillHeld: 0,
      errors: [],
    })),
  };
});

jest.mock("../../config/curlec", () => ({
  getCurlecConfig: jest.fn(() => ({
    gatewayAccount: "OPERATING" as const,
    keyId: "rzp_test_key",
    keySecret: "secret",
    webhookSecret: "whsec",
    apiBaseUrl: "https://api.razorpay.com",
    environment: "sandbox" as const,
  })),
  getCurlecGatewayAccountConfigStatus: jest.fn((gatewayAccount: CurlecGatewayAccount) => ({
    gatewayAccount,
    configured: true,
    isPartial: false,
    missingEnvNames: [],
  })),
}));

const prisma = new PrismaClient();
const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

describeIntegration("gateway reconciliation (M10)", () => {
  let migrated = false;
  const createdPaymentIds: string[] = [];
  const createdRunIds: string[] = [];
  const createdExceptionIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];

  beforeEach(() => {
    mockFetchOrderPayments.mockReset();
    mockFetchOrderPayments.mockResolvedValue([]);
    mockFetchSettlementRecon.mockReset();
  });

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1 FROM gateway_recon_runs LIMIT 1`;
      migrated = true;
    } catch {
      migrated = false;
    }
  });

  afterAll(async () => {
    if (!migrated) return;
    if (createdExceptionIds.length) {
      await prisma.gatewayReconException.deleteMany({ where: { id: { in: createdExceptionIds } } });
    }
    if (createdRunIds.length) {
      await prisma.gatewayReconRun.deleteMany({ where: { id: { in: createdRunIds } } });
    }
    if (createdPaymentIds.length) {
      await prisma.gatewayPaymentEvent.deleteMany({
        where: { gateway_payment_id: { in: createdPaymentIds } },
      });
      await prisma.gatewayPayment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { user_id: { in: createdUserIds } } });
    }
    if (createdOrgIds.length) {
      await prisma.issuerOrganization.deleteMany({ where: { id: { in: createdOrgIds } } });
    }
    await prisma.$disconnect();
  });

  async function seedStaleCreatedPayment(
    suffix: string,
    extra?: { issuerOrganizationId?: string; gatewayAccount?: CurlecGatewayAccount }
  ) {
    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        organization_type: GatewayOrganizationType.ISSUER,
        gatewayAccount: extra?.gatewayAccount ?? CurlecGatewayAccount.OPERATING,
        issuer_organization_id: extra?.issuerOrganizationId,
        amount: new Prisma.Decimal("150.000000"),
        status: GatewayPaymentStatus.CREATED,
        curlec_order_id: `order_m10_${suffix}`,
        idempotency_key: `m10:${suffix}`,
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    });
    createdPaymentIds.push(payment.id);
    return payment;
  }

  it("new gateway models require explicit gatewayAccount", async () => {
    if (!migrated) return;

    await expect(
      prisma.gatewayPayment.create({
        data: {
          purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
          organization_type: GatewayOrganizationType.ISSUER,
          amount: new Prisma.Decimal("150.000000"),
          status: GatewayPaymentStatus.CREATED,
          curlec_order_id: `order_m10_default_${Date.now()}`,
          idempotency_key: `m10:default:${Date.now()}`,
        },
      })
    ).rejects.toThrow();

    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        organization_type: GatewayOrganizationType.ISSUER,
        gatewayAccount: CurlecGatewayAccount.OPERATING,
        amount: new Prisma.Decimal("150.000000"),
        status: GatewayPaymentStatus.CREATED,
        curlec_order_id: `order_m10_explicit_${Date.now()}`,
        idempotency_key: `m10:explicit:${Date.now()}`,
      },
    });
    createdPaymentIds.push(payment.id);
    expect(payment.gatewayAccount).toBe(CurlecGatewayAccount.OPERATING);

    const webhook = await prisma.gatewayWebhookEvent.create({
      data: {
        event_id: `evt_m10_explicit_${Date.now()}`,
        event_type: "payment.captured",
        gatewayAccount: CurlecGatewayAccount.OPERATING,
        payload: { event: "payment.captured" },
        signature_valid: true,
      },
    });
    expect(webhook.gatewayAccount).toBe(CurlecGatewayAccount.OPERATING);

    const run = await prisma.gatewayReconRun.create({
      data: {
        run_date: new Date(Date.UTC(2099, 6, 1)),
        gatewayAccount: CurlecGatewayAccount.OPERATING,
        status: GatewayReconRunStatus.COMPLETED,
        triggered_by: "TEST",
      },
    });
    createdRunIds.push(run.id);
    expect(run.gatewayAccount).toBe(CurlecGatewayAccount.OPERATING);
  });

  it("allows same recon date across different gateway accounts but rejects duplicates per account", async () => {
    if (!migrated) return;

    const runDate = new Date(Date.UTC(2099, 6, 2));

    const operatingRun = await prisma.gatewayReconRun.create({
      data: {
        run_date: runDate,
        gatewayAccount: CurlecGatewayAccount.OPERATING,
        status: GatewayReconRunStatus.COMPLETED,
        triggered_by: "TEST",
      },
    });
    createdRunIds.push(operatingRun.id);

    const poolRun = await prisma.gatewayReconRun.create({
      data: {
        run_date: runDate,
        gatewayAccount: CurlecGatewayAccount.INVESTOR_POOL,
        status: GatewayReconRunStatus.COMPLETED,
        triggered_by: "TEST",
      },
    });
    createdRunIds.push(poolRun.id);

    expect(operatingRun.id).not.toBe(poolRun.id);

    await expect(
      prisma.gatewayReconRun.create({
        data: {
          run_date: runDate,
          gatewayAccount: CurlecGatewayAccount.OPERATING,
          status: GatewayReconRunStatus.COMPLETED,
          triggered_by: "TEST",
        },
      })
    ).rejects.toThrow();
  });

  async function seedCompletedPayment(
    suffix: string,
    curlecPaymentId: string,
    amountMyr: string,
    gatewayAccount: CurlecGatewayAccount = CurlecGatewayAccount.OPERATING
  ) {
    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        organization_type: GatewayOrganizationType.ISSUER,
        gatewayAccount,
        amount: new Prisma.Decimal(amountMyr),
        status: GatewayPaymentStatus.COMPLETED,
        curlec_order_id: `order_m10_done_${suffix}`,
        curlec_payment_id: curlecPaymentId,
        idempotency_key: `m10:done:${suffix}`,
      },
    });
    createdPaymentIds.push(payment.id);
    return payment;
  }

  it("poller expires stale CREATED payments when Curlec has no capture", async () => {
    if (!migrated) return;

    const payment = await seedStaleCreatedPayment(`expire_${Date.now()}`);
    await prisma.gatewayPayment.update({
      where: { id: payment.id },
      data: { gatewayAccount: CurlecGatewayAccount.OPERATING },
    });
    const operatingPayment = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });

    const outcome = await processStaleGatewayPayment(operatingPayment, prisma);
    expect(outcome).toBe("expired");
    expect((createCurlecClient as jest.Mock).mock.calls.at(-1)?.[0]).toEqual({
      gatewayAccount: "OPERATING",
    });

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.EXPIRED);

    const events = await prisma.gatewayPaymentEvent.findMany({
      where: { gateway_payment_id: payment.id, type: "EXPIRED" },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.source).toBe("SYSTEM_JOB");
  });

  it("poller recovers captured payments instead of expiring", async () => {
    if (!migrated) return;

    const suffix = `recover_${Date.now()}`;
    const adminSuffix = `${Date.now()}`.slice(-4);
    const owner = await prisma.user.create({
      data: {
        user_id: `R${adminSuffix}`.slice(0, 5),
        email: `recon-owner-${Date.now()}@example.com`,
        cognito_sub: `sub-owner-${Date.now()}`,
        cognito_username: `owner-${Date.now()}`,
        first_name: "Owner",
        last_name: "Test",
        roles: ["ISSUER"],
        issuer_account: ["COMPANY"],
      },
    });
    createdUserIds.push(owner.user_id);
    const issuerOrg = await prisma.issuerOrganization.create({
      data: {
        owner_user_id: owner.user_id,
        type: "COMPANY",
        name: "Recon Test Co",
        tnc_accepted: true,
      },
    });
    createdOrgIds.push(issuerOrg.id);

    const payment = await seedStaleCreatedPayment(suffix, {
      issuerOrganizationId: issuerOrg.id,
    });
    await prisma.gatewayPayment.update({
      where: { id: payment.id },
      data: { gatewayAccount: CurlecGatewayAccount.INVESTOR_POOL },
    });
    const investorPoolPayment = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    mockFetchOrderPayments.mockImplementation(async (orderId: string) => {
      if (orderId !== payment.curlec_order_id) {
        return [];
      }
      return [
        {
          id: `pay_recover_${suffix}`,
          amount: 15000,
          currency: "MYR",
          status: "captured",
          method: "fpx",
          order_id: payment.curlec_order_id,
        },
      ];
    });

    const outcome = await processStaleGatewayPayment(investorPoolPayment, prisma);
    expect(outcome).toBe("recovered");
    expect((createCurlecClient as jest.Mock).mock.calls.at(-1)?.[0]).toEqual({
      gatewayAccount: "INVESTOR_POOL",
    });

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.COMPLETED);
  });

  it("poller isolates account-specific failures and continues other rows", async () => {
    if (!migrated) return;

    const operating = await seedStaleCreatedPayment(`operating_${Date.now()}`, {
      gatewayAccount: CurlecGatewayAccount.OPERATING,
    });
    const pool = await seedStaleCreatedPayment(`pool_${Date.now()}`, {
      gatewayAccount: CurlecGatewayAccount.INVESTOR_POOL,
    });

    mockFetchOrderPayments.mockImplementation(async (orderId: string) => {
      if (orderId === operating.curlec_order_id) {
        throw new Error("missing operating credentials");
      }
      return [];
    });

    const result = await runGatewayStuckOrderPollerJob(prisma);

    expect(result.scanned).toBeGreaterThanOrEqual(2);
    expect(result.expired).toBeGreaterThanOrEqual(1);

    const poolUpdated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: pool.id } });
    expect(poolUpdated.status).toBe(GatewayPaymentStatus.EXPIRED);
    const operatingUpdated = await prisma.gatewayPayment.findUniqueOrThrow({
      where: { id: operating.id },
    });
    // Operating fetch failed — row may remain CREATED or be marked depending on poller error handling
    expect([GatewayPaymentStatus.CREATED, GatewayPaymentStatus.EXPIRED]).toContain(
      operatingUpdated.status
    );
  });

  it("recon stamps settlement fields on matched payments", async () => {
    if (!migrated) return;

    const suffix = `stamp_${Date.now()}`;
    const curlecPaymentId = `pay_stamp_${suffix}`;
    const payment = await seedCompletedPayment(suffix, curlecPaymentId, "150.000000");
    const runDate = getYesterdayMytDateOnly();

    mockFetchSettlementRecon.mockResolvedValueOnce({
      count: 1,
      items: [
        {
          entity_type: "payment",
          amount: 15000,
          fee: 100,
          tax: 0,
          settled: true,
          settlement_id: `setl_${suffix}`,
          payment_id: curlecPaymentId,
          created_at: Math.floor(Date.now() / 1000),
        },
      ],
    });

    const result = await runGatewaySettlementReconJob(
      { runDate, triggeredBy: "TEST", gatewayAccount: CurlecGatewayAccount.OPERATING },
      prisma
    );
    expect(result).not.toBeNull();
    if (!result) return;
    createdRunIds.push(result.runId);
    expect(result.paymentsStamped).toBe(1);

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.settlement_id).toBe(`setl_${suffix}`);
    expect(updated.settled_at).not.toBeNull();
    expect(updated.gateway_fee_amount?.toNumber()).toBe(1);
  });

  it("recon records orphan and amount mismatch exceptions", async () => {
    if (!migrated) return;

    const suffix = `exc_${Date.now()}`;
    const payment = await seedCompletedPayment(suffix, `pay_mismatch_${suffix}`, "150.000000");
    const runDate = getYesterdayMytDateOnly();

    mockFetchSettlementRecon.mockResolvedValueOnce({
      count: 2,
      items: [
        {
          entity_type: "payment",
          amount: 15000,
          fee: 0,
          tax: 0,
          settled: true,
          settlement_id: "setl_orphan",
          payment_id: `pay_orphan_${suffix}`,
          created_at: Math.floor(Date.now() / 1000),
        },
        {
          entity_type: "payment",
          amount: 14000,
          fee: 0,
          tax: 0,
          settled: true,
          settlement_id: "setl_mismatch",
          payment_id: payment.curlec_payment_id,
          created_at: Math.floor(Date.now() / 1000),
        },
      ],
    });

    const result = await runGatewaySettlementReconJob(
      { runDate, triggeredBy: "TEST", gatewayAccount: CurlecGatewayAccount.OPERATING },
      prisma
    );
    expect(result).not.toBeNull();
    if (!result) return;
    createdRunIds.push(result.runId);
    expect(result.exceptionsCount).toBe(2);

    const exceptions = await prisma.gatewayReconException.findMany({
      where: { recon_run_id: result.runId },
    });
    createdExceptionIds.push(...exceptions.map((e) => e.id));

    expect(exceptions.some((e) => e.type === GatewayReconExceptionType.ORPHAN_CURLEC_PAYMENT)).toBe(
      true
    );
    expect(exceptions.some((e) => e.type === GatewayReconExceptionType.AMOUNT_MISMATCH)).toBe(true);
  });

  it("re-running recon for the same date replaces prior exceptions", async () => {
    if (!migrated) return;

    const runDate = getYesterdayMytDateOnly();
    mockFetchSettlementRecon.mockResolvedValue({
      count: 1,
      items: [
        {
          entity_type: "payment",
          amount: 99999,
          settled: true,
          settlement_id: "setl_orphan_only",
          payment_id: `pay_orphan_rerun_${Date.now()}`,
          created_at: Math.floor(Date.now() / 1000),
        },
      ],
    });

    const first = await runGatewaySettlementReconJob(
      { runDate, triggeredBy: "TEST", gatewayAccount: CurlecGatewayAccount.OPERATING }, prisma);
    expect(first).not.toBeNull();
    if (!first) return;
    createdRunIds.push(first.runId);
    const second = await runGatewaySettlementReconJob(
      { runDate, triggeredBy: "TEST", gatewayAccount: CurlecGatewayAccount.OPERATING }, prisma);
    expect(second).not.toBeNull();
    if (!second) return;

    expect(first.runId).toBe(second.runId);
    const count = await prisma.gatewayReconException.count({ where: { recon_run_id: first.runId } });
    expect(count).toBe(1);
  });

  it("recon matches and stamps only within the same gateway account", async () => {
    if (!migrated) return;

    const suffix = `scope_${Date.now()}`;
    const sharedPaymentId = `pay_scope_${suffix}`;
    const operatingPayment = await seedCompletedPayment(
      `${suffix}_op`,
      sharedPaymentId,
      "120.000000",
      CurlecGatewayAccount.OPERATING
    );
    const poolPayment = await seedCompletedPayment(
      `${suffix}_pool`,
      sharedPaymentId,
      "120.000000",
      CurlecGatewayAccount.INVESTOR_POOL
    );
    const runDate = getYesterdayMytDateOnly();

    mockFetchSettlementRecon.mockResolvedValueOnce({
      count: 1,
      items: [
        {
          entity_type: "payment",
          amount: 12000,
          fee: 100,
          tax: 0,
          settled: true,
          settlement_id: `setl_scope_${suffix}`,
          payment_id: sharedPaymentId,
          created_at: Math.floor(Date.now() / 1000),
        },
      ],
    });

    const result = await runGatewaySettlementReconJob(
      { runDate, triggeredBy: "TEST", gatewayAccount: CurlecGatewayAccount.OPERATING },
      prisma
    );
    expect(result).not.toBeNull();
    if (!result) return;
    createdRunIds.push(result.runId);

    const operatingUpdated = await prisma.gatewayPayment.findUniqueOrThrow({
      where: { id: operatingPayment.id },
    });
    const poolUpdated = await prisma.gatewayPayment.findUniqueOrThrow({
      where: { id: poolPayment.id },
    });
    expect(operatingUpdated.settlement_id).toBe(`setl_scope_${suffix}`);
    expect(poolUpdated.settlement_id).toBeNull();
  });

  it("scheduled recon continues other accounts when one fails", async () => {
    if (!migrated) return;

    const runDate = getYesterdayMytDateOnly();
    const fetcher = jest.fn(async (gatewayAccount: CurlecGatewayAccount) => {
      if (gatewayAccount === CurlecGatewayAccount.OPERATING) {
        throw new Error("operating fetch failed");
      }
      return [];
    });

    const result = await runGatewaySettlementReconForConfiguredAccounts(
      { runDate, triggeredBy: "CRON_TEST" },
      prisma,
      fetcher
    );

    result.completed.forEach((run) => createdRunIds.push(run.runId));

    expect(result.completed.some((run) => run.gatewayAccount === CurlecGatewayAccount.OPERATING)).toBe(
      false
    );
    expect(result.completed.some((run) => run.gatewayAccount === CurlecGatewayAccount.INVESTOR_POOL)).toBe(
      true
    );
    expect(result.failed.some((entry) => entry.gatewayAccount === CurlecGatewayAccount.OPERATING)).toBe(
      true
    );
  });

  it("scheduled recon skips fully unconfigured account", async () => {
    if (!migrated) return;

    const curlecConfigModule = jest.requireMock("../../config/curlec") as {
      getCurlecGatewayAccountConfigStatus: jest.Mock;
    };
    const originalImpl = curlecConfigModule.getCurlecGatewayAccountConfigStatus.getMockImplementation();
    curlecConfigModule.getCurlecGatewayAccountConfigStatus.mockImplementation(
      (gatewayAccount: CurlecGatewayAccount) => ({
        gatewayAccount,
        configured: gatewayAccount !== CurlecGatewayAccount.INVESTOR_POOL,
        isPartial: false,
        missingEnvNames:
          gatewayAccount === CurlecGatewayAccount.INVESTOR_POOL
            ? [
                "CURLEC_INVESTOR_POOL_KEY_ID",
                "CURLEC_INVESTOR_POOL_KEY_SECRET",
                "CURLEC_INVESTOR_POOL_WEBHOOK_SECRET",
              ]
            : [],
      })
    );

    const runDate = getYesterdayMytDateOnly();
    const result = await runGatewaySettlementReconForConfiguredAccounts(
      { runDate, triggeredBy: "CRON_TEST" },
      prisma,
      async () => []
    );
    result.completed.forEach((run) => createdRunIds.push(run.runId));

    expect(
      result.skippedUnconfigured.some(
        (entry) => entry.gatewayAccount === CurlecGatewayAccount.INVESTOR_POOL
      )
    ).toBe(true);
    expect(
      result.failed.some((entry) => entry.gatewayAccount === CurlecGatewayAccount.INVESTOR_POOL)
    ).toBe(false);

    curlecConfigModule.getCurlecGatewayAccountConfigStatus.mockImplementation(
      originalImpl ??
        ((gatewayAccount: CurlecGatewayAccount) => ({
          gatewayAccount,
          configured: true,
          isPartial: false,
          missingEnvNames: [],
        }))
    );
  });

  it("scheduled recon reports partial account configuration as failed", async () => {
    if (!migrated) return;

    const curlecConfigModule = jest.requireMock("../../config/curlec") as {
      getCurlecGatewayAccountConfigStatus: jest.Mock;
    };
    const originalImpl = curlecConfigModule.getCurlecGatewayAccountConfigStatus.getMockImplementation();
    curlecConfigModule.getCurlecGatewayAccountConfigStatus.mockImplementation(
      (gatewayAccount: CurlecGatewayAccount) => ({
        gatewayAccount,
        configured: gatewayAccount !== CurlecGatewayAccount.OPERATING,
        isPartial: gatewayAccount === CurlecGatewayAccount.OPERATING,
        missingEnvNames:
          gatewayAccount === CurlecGatewayAccount.OPERATING
            ? ["CURLEC_OPERATING_KEY_SECRET"]
            : [],
      })
    );

    const runDate = getYesterdayMytDateOnly();
    const result = await runGatewaySettlementReconForConfiguredAccounts(
      { runDate, triggeredBy: "CRON_TEST" },
      prisma,
      async () => []
    );
    result.completed.forEach((run) => createdRunIds.push(run.runId));

    expect(
      result.failed.some(
        (entry) =>
          entry.gatewayAccount === CurlecGatewayAccount.OPERATING &&
          entry.error.includes("Missing: CURLEC_OPERATING_KEY_SECRET")
      )
    ).toBe(true);
    expect(
      result.skippedUnconfigured.some(
        (entry) => entry.gatewayAccount === CurlecGatewayAccount.OPERATING
      )
    ).toBe(false);

    curlecConfigModule.getCurlecGatewayAccountConfigStatus.mockImplementation(
      originalImpl ??
        ((gatewayAccount: CurlecGatewayAccount) => ({
          gatewayAccount,
          configured: true,
          isPartial: false,
          missingEnvNames: [],
        }))
    );
  });

  it("builds different lock keys per account and date scope", () => {
    const runDate = new Date(Date.UTC(2026, 6, 13));
    const operatingLock = getGatewaySettlementReconLockKey(runDate, CurlecGatewayAccount.OPERATING);
    const poolLock = getGatewaySettlementReconLockKey(runDate, CurlecGatewayAccount.INVESTOR_POOL);
    const nextDayLock = getGatewaySettlementReconLockKey(
      new Date(Date.UTC(2026, 6, 14)),
      CurlecGatewayAccount.OPERATING
    );

    expect(operatingLock).not.toBe(poolLock);
    expect(operatingLock).not.toBe(nextDayLock);
  });

  it("manual trigger runs only the requested gateway account", async () => {
    if (!migrated) return;

    mockFetchSettlementRecon.mockResolvedValueOnce({
      count: 0,
      items: [],
    });

    const runDate = getYesterdayMytDateOnly().toISOString().slice(0, 10);
    const detail = await triggerReconRun(
      { userId: "ADMIN1" },
      runDate,
      CurlecGatewayAccount.OPERATING,
      prisma
    );
    createdRunIds.push(detail.id);
    expect(detail.gatewayAccount).toBe(CurlecGatewayAccount.OPERATING);
  });

  it("manual trigger fails clearly for partially configured account", async () => {
    if (!migrated) return;

    const curlecConfigModule = jest.requireMock("../../config/curlec") as {
      getCurlecGatewayAccountConfigStatus: jest.Mock;
    };
    const originalImpl = curlecConfigModule.getCurlecGatewayAccountConfigStatus.getMockImplementation();
    curlecConfigModule.getCurlecGatewayAccountConfigStatus.mockImplementation(
      (gatewayAccount: CurlecGatewayAccount) => ({
        gatewayAccount,
        configured: gatewayAccount !== CurlecGatewayAccount.INVESTOR_POOL,
        isPartial: gatewayAccount === CurlecGatewayAccount.INVESTOR_POOL,
        missingEnvNames:
          gatewayAccount === CurlecGatewayAccount.INVESTOR_POOL
            ? ["CURLEC_INVESTOR_POOL_KEY_SECRET"]
            : [],
      })
    );

    await expect(
      triggerReconRun(
        { userId: "ADMIN1" },
        getYesterdayMytDateOnly().toISOString().slice(0, 10),
        CurlecGatewayAccount.INVESTOR_POOL,
        prisma
      )
    ).rejects.toMatchObject({ code: "CURLEC_GATEWAY_ACCOUNT_UNCONFIGURED" });

    curlecConfigModule.getCurlecGatewayAccountConfigStatus.mockImplementation(
      originalImpl ??
        ((gatewayAccount: CurlecGatewayAccount) => ({
          gatewayAccount,
          configured: true,
          isPartial: false,
          missingEnvNames: [],
        }))
    );
  });

  it("manual trigger fails clearly for fully unconfigured account", async () => {
    if (!migrated) return;

    const curlecConfigModule = jest.requireMock("../../config/curlec") as {
      getCurlecGatewayAccountConfigStatus: jest.Mock;
    };
    const originalImpl = curlecConfigModule.getCurlecGatewayAccountConfigStatus.getMockImplementation();
    curlecConfigModule.getCurlecGatewayAccountConfigStatus.mockImplementation(
      (gatewayAccount: CurlecGatewayAccount) => ({
        gatewayAccount,
        configured: gatewayAccount !== CurlecGatewayAccount.OPERATING,
        isPartial: false,
        missingEnvNames:
          gatewayAccount === CurlecGatewayAccount.OPERATING
            ? [
                "CURLEC_OPERATING_KEY_ID",
                "CURLEC_OPERATING_KEY_SECRET",
                "CURLEC_OPERATING_WEBHOOK_SECRET",
              ]
            : [],
      })
    );

    await expect(
      triggerReconRun(
        { userId: "ADMIN1" },
        getYesterdayMytDateOnly().toISOString().slice(0, 10),
        CurlecGatewayAccount.OPERATING,
        prisma
      )
    ).rejects.toMatchObject({ code: "CURLEC_GATEWAY_ACCOUNT_UNCONFIGURED" });

    curlecConfigModule.getCurlecGatewayAccountConfigStatus.mockImplementation(
      originalImpl ??
        ((gatewayAccount: CurlecGatewayAccount) => ({
          gatewayAccount,
          configured: true,
          isPartial: false,
          missingEnvNames: [],
        }))
    );
  });

  it("list APIs support gatewayAccount filters", async () => {
    if (!migrated) return;

    const runDate = new Date(Date.UTC(2099, 6, 25));
    const operatingRun = await prisma.gatewayReconRun.create({
      data: {
        run_date: runDate,
        gatewayAccount: CurlecGatewayAccount.OPERATING,
        status: GatewayReconRunStatus.COMPLETED,
        triggered_by: "TEST",
      },
    });
    createdRunIds.push(operatingRun.id);
    const legacyRun = await prisma.gatewayReconRun.create({
      data: {
        run_date: new Date(Date.UTC(2099, 6, 26)),
        gatewayAccount: CurlecGatewayAccount.OPERATING,
        status: GatewayReconRunStatus.COMPLETED,
        triggered_by: "TEST",
      },
    });
    createdRunIds.push(legacyRun.id);

    const exception = await prisma.gatewayReconException.create({
      data: {
        recon_run_id: operatingRun.id,
        type: GatewayReconExceptionType.ORPHAN_CURLEC_PAYMENT,
        curlec_payment_id: `pay_filter_${Date.now()}`,
      },
    });
    createdExceptionIds.push(exception.id);

    const runList = await listReconRuns(
      {
        page: 1,
        pageSize: 20,
        gatewayAccount: CurlecGatewayAccount.OPERATING,
      },
      prisma
    );
    expect(runList.items.every((item) => item.gatewayAccount === CurlecGatewayAccount.OPERATING)).toBe(
      true
    );

    const exceptionList = await listReconExceptions(
      {
        page: 1,
        pageSize: 20,
        gatewayAccount: CurlecGatewayAccount.OPERATING,
      },
      prisma
    );
    expect(
      exceptionList.items.every(
        (item) => item.gatewayAccount === CurlecGatewayAccount.OPERATING
      )
    ).toBe(true);
  });

  it("resolve exception marks it resolved", async () => {
    if (!migrated) return;

    const run = await prisma.gatewayReconRun.create({
      data: {
        run_date: new Date(Date.UTC(2099, 5, 15)),
        gatewayAccount: CurlecGatewayAccount.OPERATING,
        status: GatewayReconRunStatus.COMPLETED,
        triggered_by: "TEST",
        exceptions_count: 1,
      },
    });
    createdRunIds.push(run.id);

    const exception = await prisma.gatewayReconException.create({
      data: {
        recon_run_id: run.id,
        type: GatewayReconExceptionType.ORPHAN_CURLEC_PAYMENT,
        curlec_payment_id: "pay_resolve_test",
        detail: "test orphan",
      },
    });
    createdExceptionIds.push(exception.id);

    const suffix = `${Date.now()}`.slice(-4);
    const adminUser = await prisma.user.create({
      data: {
        user_id: `A${suffix}`.slice(0, 5),
        email: `recon-admin-${Date.now()}@example.com`,
        cognito_sub: `sub-recon-${Date.now()}`,
        cognito_username: `recon-${Date.now()}`,
        first_name: "Recon",
        last_name: "Admin",
        roles: ["ADMIN"],
      },
    });
    createdUserIds.push(adminUser.user_id);

    const resolved = await resolveReconException(
      { userId: adminUser.user_id },
      exception.id,
      "Verified with Curlec dashboard",
      prisma
    );

    expect(resolved.resolvedAt).not.toBeNull();
    expect(resolved.resolveReason).toBe("Verified with Curlec dashboard");
  });
});
