import {
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
  runGatewaySettlementReconJob,
} from "../../lib/jobs/gateway-settlement-recon";
import { resolveReconException } from "./recon-service";

const mockFetchOrderPayments = jest.fn();
const mockFetchSettlementRecon = jest.fn();

jest.mock("./curlec-client", () => ({
  createCurlecClient: jest.fn(() => ({
    fetchOrderPayments: mockFetchOrderPayments,
    fetchSettlementRecon: mockFetchSettlementRecon,
    fetchPayment: jest.fn(async (paymentId: string) => ({
      id: paymentId,
      amount: 10000,
      currency: "MYR",
      status: "captured",
      method: "fpx",
      order_id: "order_stub",
    })),
  })),
}));

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
    extra?: { issuerOrganizationId?: string }
  ) {
    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        organization_type: GatewayOrganizationType.ISSUER,
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

  async function seedCompletedPayment(suffix: string, curlecPaymentId: string, amountMyr: string) {
    const payment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        organization_type: GatewayOrganizationType.ISSUER,
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

    const outcome = await processStaleGatewayPayment(payment, prisma);
    expect(outcome).toBe("expired");

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.EXPIRED);
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

    const outcome = await processStaleGatewayPayment(payment, prisma);
    expect(outcome).toBe("recovered");

    const updated = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(GatewayPaymentStatus.COMPLETED);
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
      { runDate, triggeredBy: "TEST" },
      prisma
    );
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
      { runDate, triggeredBy: "TEST" },
      prisma
    );
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

    const first = await runGatewaySettlementReconJob({ runDate, triggeredBy: "TEST" }, prisma);
    createdRunIds.push(first.runId);
    const second = await runGatewaySettlementReconJob({ runDate, triggeredBy: "TEST" }, prisma);

    expect(first.runId).toBe(second.runId);
    const count = await prisma.gatewayReconException.count({ where: { recon_run_id: first.runId } });
    expect(count).toBe(1);
  });

  it("resolve exception marks it resolved", async () => {
    if (!migrated) return;

    const run = await prisma.gatewayReconRun.create({
      data: {
        run_date: new Date(Date.UTC(2099, 5, 15)),
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
