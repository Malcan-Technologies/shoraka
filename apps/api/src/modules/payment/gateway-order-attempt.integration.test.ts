import {
  CurlecGatewayAccount,
  GatewayOrganizationType,
  GatewayOrderAttemptStatus,
  GatewayPaymentPurpose,
  OrganizationType,
  Prisma,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import { createGatewayOrder } from "./gateway-order-service";
import { createCurlecClient } from "./curlec-client";

const prisma = new PrismaClient();
const mockCreateOrder = jest.fn();

jest.mock("./curlec-client", () => ({
  createCurlecClient: jest.fn(() => ({
    createOrder: (...args: unknown[]) => mockCreateOrder(...args),
  })),
}));

jest.mock("../../config/curlec", () => {
  const keyByAccount: Record<string, string> = {
    LEGACY_DEFAULT: "rzp_test_legacy_key",
    OPERATING: "rzp_test_operating_key",
    INVESTOR_POOL: "rzp_test_pool_key",
  };
  return {
    getCurlecConfig: jest.fn((gatewayAccount: string = "LEGACY_DEFAULT") => ({
      gatewayAccount,
      keyId: keyByAccount[gatewayAccount] ?? "rzp_test_unknown_key",
      keySecret: "secret",
      webhookSecret: "whsec",
      apiBaseUrl: "https://api.razorpay.com",
      environment: "sandbox" as const,
    })),
  };
});

async function tablesReady(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1 FROM gateway_order_attempts LIMIT 1`;
    await prisma.$queryRaw`SELECT 1 FROM gateway_payments LIMIT 1`;
    return true;
  } catch {
    return false;
  }
}

const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

describeIntegration("gateway order attempt recovery", () => {
  let migrated = false;
  let userId = "";
  let issuerOrgId = "";
  let investorOrgId = "";
  const createdUserIds: string[] = [];
  const createdIssuerOrgIds: string[] = [];
  const createdInvestorOrgIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdAttemptScopeKeys: string[] = [];

  beforeAll(async () => {
    migrated = await tablesReady();
    if (!migrated) return;

    const suffix = `${Date.now()}`.slice(-4);
    const user = await prisma.user.create({
      data: {
        user_id: `O${suffix}`.slice(0, 5),
        email: `order-attempt-${Date.now()}@example.com`,
        cognito_sub: `sub-order-attempt-${Date.now()}`,
        cognito_username: `order-attempt-${Date.now()}`,
        first_name: "Order",
        last_name: "Attempt",
        roles: [UserRole.ISSUER, UserRole.INVESTOR],
      },
    });
    userId = user.user_id;
    createdUserIds.push(userId);

    const issuerOrg = await prisma.issuerOrganization.create({
      data: {
        owner_user_id: userId,
        type: OrganizationType.COMPANY,
        tnc_accepted: true,
      },
    });
    issuerOrgId = issuerOrg.id;
    createdIssuerOrgIds.push(issuerOrgId);

    const investorOrg = await prisma.investorOrganization.create({
      data: {
        owner_user_id: userId,
        type: OrganizationType.PERSONAL,
        first_name: "Order",
        last_name: "Attempt",
      },
    });
    investorOrgId = investorOrg.id;
    createdInvestorOrgIds.push(investorOrgId);
  });

  beforeEach(() => {
    mockCreateOrder.mockReset();
    let counter = 0;
    mockCreateOrder.mockImplementation(async () => {
      counter += 1;
      return {
        id: `order_attempt_recovery_${Date.now()}_${counter}`,
        amount: 15000,
        currency: "MYR",
        status: "created",
      };
    });
    (createCurlecClient as jest.Mock).mockClear();
  });

  afterAll(async () => {
    if (createdPaymentIds.length) {
      await prisma.gatewayPayment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdAttemptScopeKeys.length) {
      await prisma.gatewayOrderAttempt.deleteMany({
        where: { scope_key: { in: createdAttemptScopeKeys } },
      });
    }
    if (createdIssuerOrgIds.length) {
      await prisma.issuerOrganization.deleteMany({ where: { id: { in: createdIssuerOrgIds } } });
    }
    if (createdInvestorOrgIds.length) {
      await prisma.investorOrganization.deleteMany({ where: { id: { in: createdInvestorOrgIds } } });
    }
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { user_id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  it("retries reuse remote Curlec order when local GatewayPayment insert fails", async () => {
    if (!migrated) return;

    const scopeKey = `issuer-org:${issuerOrgId}:orphan-${Date.now()}`;
    createdAttemptScopeKeys.push(scopeKey);

    // Simulate a remote-created orphan attempt left by a prior failed local insert.
    const remoteOrderId = `order_orphan_${Date.now()}`;
    await prisma.gatewayOrderAttempt.create({
      data: {
        gatewayAccount: CurlecGatewayAccount.OPERATING,
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        scope_key: scopeKey,
        receipt: `fee_${Date.now()}`,
        curlec_order_id: remoteOrderId,
        amount: new Prisma.Decimal("150.000000"),
        currency: "MYR",
        status: GatewayOrderAttemptStatus.REMOTE_CREATED,
        last_error_code: "GATEWAY_ORDER_PERSIST_FAILED",
      },
    });

    // Force createGatewayOrder to use our scope by calling with matching issuer org
    // and intercepting via a unique issuer org scoped create. We recover by calling
    // createGatewayOrder for the same issuer org after planting an attempt with the
    // normal scope key used by the service.
    await prisma.gatewayOrderAttempt.deleteMany({
      where: {
        gatewayAccount: CurlecGatewayAccount.OPERATING,
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        scope_key: `issuer-org:${issuerOrgId}`,
      },
    });
    createdAttemptScopeKeys.push(`issuer-org:${issuerOrgId}`);

    await prisma.gatewayOrderAttempt.create({
      data: {
        gatewayAccount: CurlecGatewayAccount.OPERATING,
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        scope_key: `issuer-org:${issuerOrgId}`,
        receipt: `fee_recover_${Date.now()}`,
        curlec_order_id: remoteOrderId,
        amount: new Prisma.Decimal("150.000000"),
        currency: "MYR",
        status: GatewayOrderAttemptStatus.REMOTE_CREATED,
        last_error_code: "GATEWAY_ORDER_PERSIST_FAILED",
      },
    });

    const result = await createGatewayOrder(
      { userId },
      {
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        organizationType: GatewayOrganizationType.ISSUER,
        amount: 150,
        receiptPrefix: "fee",
        notes: { issuerOrganizationId: issuerOrgId },
        issuerOrganizationId: issuerOrgId,
      },
      prisma
    );
    createdPaymentIds.push(result.id);

    expect(result.curlecOrderId).toBe(remoteOrderId);
    expect(result.gatewayAccount).toBe(CurlecGatewayAccount.OPERATING);
    expect(mockCreateOrder).not.toHaveBeenCalled();

    const attempt = await prisma.gatewayOrderAttempt.findUniqueOrThrow({
      where: {
        gatewayAccount_purpose_scope_key: {
          gatewayAccount: CurlecGatewayAccount.OPERATING,
          purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
          scope_key: `issuer-org:${issuerOrgId}`,
        },
      },
    });
    expect(attempt.status).toBe(GatewayOrderAttemptStatus.RESOLVED);
  });

  it("different depositIntentId creates a new Curlec order", async () => {
    if (!migrated) return;

    const intentA = `gateway-deposit:intent:a-${Date.now()}`;
    const intentB = `gateway-deposit:intent:b-${Date.now()}`;
    createdAttemptScopeKeys.push(intentA, intentB);

    const first = await createGatewayOrder(
      { userId },
      {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        organizationType: GatewayOrganizationType.INVESTOR,
        amount: 200,
        receiptPrefix: "dep",
        notes: { investorOrganizationId: investorOrgId },
        investorOrganizationId: investorOrgId,
        idempotencyKey: intentA,
      },
      prisma
    );
    createdPaymentIds.push(first.id);

    const second = await createGatewayOrder(
      { userId },
      {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        organizationType: GatewayOrganizationType.INVESTOR,
        amount: 200,
        receiptPrefix: "dep",
        notes: { investorOrganizationId: investorOrgId },
        investorOrganizationId: investorOrgId,
        idempotencyKey: intentB,
      },
      prisma
    );
    createdPaymentIds.push(second.id);

    expect(first.curlecOrderId).not.toBe(second.curlecOrderId);
    expect(first.gatewayAccount).toBe(CurlecGatewayAccount.INVESTOR_POOL);
    expect(second.gatewayAccount).toBe(CurlecGatewayAccount.INVESTOR_POOL);
    expect(mockCreateOrder).toHaveBeenCalledTimes(2);
  });

  it("OPERATING and INVESTOR_POOL attempts do not collide on same scope string", async () => {
    if (!migrated) return;

    const sharedScope = `shared-scope-${Date.now()}`;
    createdAttemptScopeKeys.push(sharedScope);

    await prisma.gatewayOrderAttempt.create({
      data: {
        gatewayAccount: CurlecGatewayAccount.OPERATING,
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        scope_key: sharedScope,
        receipt: `fee_shared_${Date.now()}`,
        curlec_order_id: `order_operating_shared_${Date.now()}`,
        amount: new Prisma.Decimal("150.000000"),
        currency: "MYR",
        status: GatewayOrderAttemptStatus.REMOTE_CREATED,
      },
    });

    await prisma.gatewayOrderAttempt.create({
      data: {
        gatewayAccount: CurlecGatewayAccount.INVESTOR_POOL,
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        scope_key: sharedScope,
        receipt: `dep_shared_${Date.now()}`,
        curlec_order_id: `order_pool_shared_${Date.now()}`,
        amount: new Prisma.Decimal("200.000000"),
        currency: "MYR",
        status: GatewayOrderAttemptStatus.REMOTE_CREATED,
      },
    });

    const operating = await prisma.gatewayOrderAttempt.findUniqueOrThrow({
      where: {
        gatewayAccount_purpose_scope_key: {
          gatewayAccount: CurlecGatewayAccount.OPERATING,
          purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
          scope_key: sharedScope,
        },
      },
    });
    const pool = await prisma.gatewayOrderAttempt.findUniqueOrThrow({
      where: {
        gatewayAccount_purpose_scope_key: {
          gatewayAccount: CurlecGatewayAccount.INVESTOR_POOL,
          purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
          scope_key: sharedScope,
        },
      },
    });
    expect(operating.curlec_order_id).not.toBe(pool.curlec_order_id);
  });
});
