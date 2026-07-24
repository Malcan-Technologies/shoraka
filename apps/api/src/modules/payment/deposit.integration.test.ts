import {
  GatewayOrganizationType,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  OrganizationType,
  Prisma,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import { createInvestorDeposit, getInvestorDeposit, getInvestorDepositLimits } from "./deposit-service";
import { createCurlecClient } from "./curlec-client";
import { getCurlecConfig } from "../../config/curlec";

jest.mock("./curlec-client", () => {
  let orderCounter = 0;
  return {
    createCurlecClient: jest.fn(() => ({
      createOrder: jest.fn(async () => {
        orderCounter += 1;
        return {
          id: `order_test_m4_${orderCounter}`,
          amount: 10000,
          currency: "MYR",
          status: "created",
        };
      }),
    })),
  };
});

jest.mock("../../config/curlec", () => {
  const keyByAccount: Record<string, string> = {
    OPERATING: "rzp_test_operating_key",
    INVESTOR_POOL: "rzp_test_pool_key",
  };
  return {
    getCurlecConfig: jest.fn((gatewayAccount: string = "OPERATING") => ({
      gatewayAccount,
      keyId: keyByAccount[gatewayAccount] ?? "rzp_test_unknown_key",
      keySecret: "secret",
      webhookSecret: "whsec",
      apiBaseUrl: "https://api.razorpay.com",
      environment: "sandbox" as const,
    })),
  };
});

const prisma = new PrismaClient();
const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

describeIntegration("investor deposit service", () => {
  let migrated = false;
  let userId = "";
  let orgId = "";
  const createdPaymentIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  let secondUserId = "";
  let secondOrgId = "";

  function depositInput(amount: number, depositIntentId: string) {
    return { investorOrganizationId: orgId, amount, depositIntentId };
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
        user_id: `D${suffix}`.slice(0, 5),
        email: `deposit-test-${Date.now()}@example.com`,
        cognito_sub: `sub-${Date.now()}`,
        cognito_username: `deposit-${Date.now()}`,
        first_name: "Jane",
        last_name: "Doe",
        roles: [UserRole.INVESTOR],
        investor_account: ["PERSONAL"],
      },
    });
    userId = user.user_id;
    createdUserIds.push(userId);

    const org = await prisma.investorOrganization.create({
      data: {
        owner_user_id: userId,
        type: OrganizationType.PERSONAL,
        first_name: "Jane",
        last_name: "Doe",
      },
    });
    orgId = org.id;
    createdOrgIds.push(orgId);

    const secondUser = await prisma.user.create({
      data: {
        user_id: `E${suffix}`.slice(0, 5),
        email: `deposit-test-two-${Date.now()}@example.com`,
        cognito_sub: `sub-two-${Date.now()}`,
        cognito_username: `deposit-two-${Date.now()}`,
        first_name: "John",
        last_name: "Roe",
        roles: [UserRole.INVESTOR],
        investor_account: ["PERSONAL"],
      },
    });
    secondUserId = secondUser.user_id;
    createdUserIds.push(secondUserId);

    const secondOrg = await prisma.investorOrganization.create({
      data: {
        owner_user_id: secondUserId,
        type: OrganizationType.PERSONAL,
        first_name: "John",
        last_name: "Roe",
      },
    });
    secondOrgId = secondOrg.id;
    createdOrgIds.push(secondOrgId);

    await prisma.platformFinanceSetting.upsert({
      where: { key: "DEFAULT" },
      update: {
        investor_min_deposit_amount: new Prisma.Decimal("100.000000"),
        investor_max_deposit_amount: new Prisma.Decimal("30000.000000"),
      },
      create: {
        key: "DEFAULT",
        investor_min_deposit_amount: new Prisma.Decimal("100.000000"),
        investor_max_deposit_amount: new Prisma.Decimal("30000.000000"),
      },
    });
  });

  afterAll(async () => {
    if (createdPaymentIds.length > 0) {
      await prisma.gatewayPayment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdOrgIds.length > 0) {
      await prisma.investorOrganization.deleteMany({ where: { id: { in: createdOrgIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { user_id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  it("rejects deposits below platform minimum", async () => {
    if (!migrated) return;

    await expect(
      createInvestorDeposit(
        { userId },
        { investorOrganizationId: orgId, amount: 50, depositIntentId: "11111111-1111-4111-8111-111111111111" },
        prisma
      )
    ).rejects.toMatchObject({ code: "DEPOSIT_BELOW_MINIMUM" });
  });

  it("returns configured deposit limits", async () => {
    if (!migrated) return;

    const beforeCount = await prisma.gatewayPayment.count({
      where: {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        investor_organization_id: orgId,
      },
    });

    await expect(getInvestorDepositLimits(prisma)).resolves.toEqual({
      minAmount: 100,
      maxAmount: 30000,
    });

    const afterCount = await prisma.gatewayPayment.count({
      where: {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        investor_organization_id: orgId,
      },
    });
    expect(afterCount).toBe(beforeCount);
  });

  it("rejects deposits above platform maximum", async () => {
    if (!migrated) return;

    await expect(
      createInvestorDeposit(
        { userId },
        {
          investorOrganizationId: orgId,
          amount: 50000,
          depositIntentId: "22222222-2222-4222-8222-222222222222",
        },
        prisma
      )
    ).rejects.toMatchObject({ code: "DEPOSIT_ABOVE_MAXIMUM" });
  });

  it("first intent creates one gateway payment and curlec order", async () => {
    if (!migrated) return;

    const result = await createInvestorDeposit(
      { userId },
      depositInput(250, "33333333-3333-4333-8333-333333333333"),
      prisma
    );
    createdPaymentIds.push(result.id);

    expect(result.status).toBe(GatewayPaymentStatus.CREATED);
    expect(result.curlecOrderId).toBe("order_test_m4_1");
    expect(result.amount).toBe(250);
    expect(result.gatewayAccount).toBe("INVESTOR_POOL");
    expect(result.curlecKeyId).toBe("rzp_test_pool_key");

    const stored = await prisma.gatewayPayment.findUnique({ where: { id: result.id } });
    expect(stored?.purpose).toBe(GatewayPaymentPurpose.INVESTOR_DEPOSIT);
    expect(stored?.organization_type).toBe(GatewayOrganizationType.INVESTOR);
    expect(stored?.gatewayAccount).toBe("INVESTOR_POOL");
    expect(stored?.idempotency_key).toBe(
      "gateway-deposit:intent:33333333-3333-4333-8333-333333333333"
    );
    expect((createCurlecClient as jest.Mock).mock.calls.at(-1)?.[0]).toEqual({
      gatewayAccount: "INVESTOR_POOL",
    });
  });

  it("same intent repeated reuses same active order", async () => {
    if (!migrated) return;

    const first = await createInvestorDeposit(
      { userId },
      depositInput(450, "44444444-4444-4444-8444-444444444444"),
      prisma
    );
    const second = await createInvestorDeposit(
      { userId },
      depositInput(450, "44444444-4444-4444-8444-444444444444"),
      prisma
    );
    createdPaymentIds.push(first.id);
    expect(second.id).toBe(first.id);
  });

  it("same intent reuses active PAID order", async () => {
    if (!migrated) return;

    const first = await createInvestorDeposit(
      { userId },
      depositInput(460, "45454545-4545-4454-8454-454545454545"),
      prisma
    );
    await prisma.gatewayPayment.update({
      where: { id: first.id },
      data: { status: GatewayPaymentStatus.PAID },
    });
    const second = await createInvestorDeposit(
      { userId },
      depositInput(460, "45454545-4545-4454-8454-454545454545"),
      prisma
    );
    createdPaymentIds.push(first.id);
    expect(second.id).toBe(first.id);
  });

  it("reuses existing OPERATING active intent without replacing account", async () => {
    if (!migrated) return;

    const intent = "19191919-1919-4919-8919-191919191919";
    const legacy = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        organization_type: GatewayOrganizationType.INVESTOR,
        gatewayAccount: "OPERATING",
        investor_organization_id: orgId,
        amount: new Prisma.Decimal("250.000000"),
        currency: "MYR",
        status: GatewayPaymentStatus.CREATED,
        curlec_order_id: `order_legacy_dep_${Date.now()}`,
        idempotency_key: `gateway-deposit:intent:${intent}`,
      },
    });
    createdPaymentIds.push(legacy.id);
    const createCallsBefore = (createCurlecClient as jest.Mock).mock.calls.length;

    const reused = await createInvestorDeposit({ userId }, depositInput(250, intent), prisma);

    expect(reused.id).toBe(legacy.id);
    expect(reused.gatewayAccount).toBe("OPERATING");
    expect(reused.curlecOrderId).toBe(legacy.curlec_order_id);
    expect((createCurlecClient as jest.Mock).mock.calls.length).toBe(createCallsBefore);
  });

  it("reuses existing INVESTOR_POOL active intent without changing account", async () => {
    if (!migrated) return;

    const intent = "20202020-2020-4020-8020-202020202020";
    const pool = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        organization_type: GatewayOrganizationType.INVESTOR,
        gatewayAccount: "INVESTOR_POOL",
        investor_organization_id: orgId,
        amount: new Prisma.Decimal("260.000000"),
        currency: "MYR",
        status: GatewayPaymentStatus.CREATED,
        curlec_order_id: `order_pool_dep_${Date.now()}`,
        idempotency_key: `gateway-deposit:intent:${intent}`,
      },
    });
    createdPaymentIds.push(pool.id);
    const createCallsBefore = (createCurlecClient as jest.Mock).mock.calls.length;

    const reused = await createInvestorDeposit({ userId }, depositInput(260, intent), prisma);

    expect(reused.id).toBe(pool.id);
    expect(reused.gatewayAccount).toBe("INVESTOR_POOL");
    expect((createCurlecClient as jest.Mock).mock.calls.length).toBe(createCallsBefore);
  });

  it("concurrent same-intent requests dedupe safely", async () => {
    if (!migrated) return;

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        createInvestorDeposit(
          { userId },
          depositInput(500, "55555555-5555-4555-8555-555555555555"),
          prisma
        )
      )
    );
    createdPaymentIds.push(results[0].id);
    expect(new Set(results.map((entry) => entry.id)).size).toBe(1);
  });

  it("same intent with different amount is rejected", async () => {
    if (!migrated) return;

    const first = await createInvestorDeposit(
      { userId },
      depositInput(700, "66666666-6666-4666-8666-666666666666"),
      prisma
    );
    createdPaymentIds.push(first.id);
    await expect(
      createInvestorDeposit(
        { userId },
        depositInput(750, "66666666-6666-4666-8666-666666666666"),
        prisma
      )
    ).rejects.toMatchObject({ code: "DEPOSIT_INTENT_AMOUNT_CONFLICT" });
  });

  it("same intent with different currency is rejected safely", async () => {
    if (!migrated) return;

    const intent = "77777777-7777-4777-8777-777777777777";
    const created = await createInvestorDeposit({ userId }, depositInput(800, intent), prisma);
    createdPaymentIds.push(created.id);
    await prisma.gatewayPayment.update({
      where: { id: created.id },
      data: { currency: "USD" },
    });

    await expect(createInvestorDeposit({ userId }, depositInput(800, intent), prisma)).rejects.toMatchObject(
      { code: "DEPOSIT_INTENT_CURRENCY_CONFLICT" }
    );
  });

  it("same intent id cannot be used by another investor organization", async () => {
    if (!migrated) return;

    const intent = "88888888-8888-4888-8888-888888888888";
    const first = await createInvestorDeposit({ userId }, depositInput(900, intent), prisma);
    createdPaymentIds.push(first.id);

    await expect(
      createInvestorDeposit(
        { userId: secondUserId },
        { investorOrganizationId: secondOrgId, amount: 900, depositIntentId: intent },
        prisma
      )
    ).rejects.toMatchObject({ code: "DEPOSIT_INTENT_OWNERSHIP_CONFLICT" });
  });

  it("different intent ids with same amount create separate deposits", async () => {
    if (!migrated) return;

    const a = await createInvestorDeposit(
      { userId },
      depositInput(1000, "99999999-9999-4999-8999-999999999999"),
      prisma
    );
    const b = await createInvestorDeposit(
      { userId },
      depositInput(1000, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      prisma
    );
    createdPaymentIds.push(a.id, b.id);
    expect(a.id).not.toBe(b.id);
  });

  it("different intent ids with different amounts create separate deposits", async () => {
    if (!migrated) return;

    const a = await createInvestorDeposit(
      { userId },
      depositInput(1100, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
      prisma
    );
    const b = await createInvestorDeposit(
      { userId },
      depositInput(1200, "cccccccc-cccc-4ccc-8ccc-cccccccccccc"),
      prisma
    );
    createdPaymentIds.push(a.id, b.id);
    expect(a.id).not.toBe(b.id);
  });

  it("FAILED intent returns terminal code with status and new intent succeeds", async () => {
    if (!migrated) return;

    const first = await createInvestorDeposit(
      { userId },
      depositInput(1300, "dddddddd-dddd-4ddd-8ddd-dddddddddddd"),
      prisma
    );
    await prisma.gatewayPayment.update({
      where: { id: first.id },
      data: { status: GatewayPaymentStatus.FAILED },
    });

    createdPaymentIds.push(first.id);
    await expect(
      createInvestorDeposit({ userId }, depositInput(1300, "dddddddd-dddd-4ddd-8ddd-dddddddddddd"), prisma)
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "DEPOSIT_INTENT_TERMINAL",
      details: { currentStatus: GatewayPaymentStatus.FAILED },
    });

    const second = await createInvestorDeposit(
      { userId },
      depositInput(1300, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"),
      prisma
    );
    createdPaymentIds.push(second.id);
    expect(second.id).not.toBe(first.id);
  });

  it("EXPIRED intent returns terminal code with status and new intent succeeds", async () => {
    if (!migrated) return;

    const first = await createInvestorDeposit(
      { userId },
      depositInput(1400, "ffffffff-ffff-4fff-8fff-ffffffffffff"),
      prisma
    );
    await prisma.gatewayPayment.update({
      where: { id: first.id },
      data: { status: GatewayPaymentStatus.EXPIRED },
    });

    createdPaymentIds.push(first.id);
    await expect(
      createInvestorDeposit(
        { userId },
        depositInput(1400, "ffffffff-ffff-4fff-8fff-ffffffffffff"),
        prisma
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "DEPOSIT_INTENT_TERMINAL",
      details: { currentStatus: GatewayPaymentStatus.EXPIRED },
    });

    const second = await createInvestorDeposit(
      { userId },
      depositInput(1400, "17171717-1717-4717-8717-171717171717"),
      prisma
    );
    createdPaymentIds.push(second.id);
    expect(second.id).not.toBe(first.id);
  });

  it("COMPLETED intent must not be reused and returns terminal code", async () => {
    if (!migrated) return;

    const first = await createInvestorDeposit(
      { userId },
      depositInput(1500, "12121212-1212-4212-8212-121212121212"),
      prisma
    );
    await prisma.gatewayPayment.update({
      where: { id: first.id },
      data: { status: GatewayPaymentStatus.COMPLETED },
    });

    createdPaymentIds.push(first.id);
    await expect(
      createInvestorDeposit(
        { userId },
        depositInput(1500, "12121212-1212-4212-8212-121212121212"),
        prisma
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "DEPOSIT_INTENT_TERMINAL",
      details: { currentStatus: GatewayPaymentStatus.COMPLETED },
    });

    const second = await createInvestorDeposit(
      { userId },
      depositInput(1500, "13131313-1313-4313-8313-131313131313"),
      prisma
    );
    createdPaymentIds.push(second.id);
    expect(second.id).not.toBe(first.id);
  });

  it("fails clearly when INVESTOR_POOL credentials are missing and does not create payment", async () => {
    if (!migrated) return;

    const beforeCount = await prisma.gatewayPayment.count({
      where: { purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT, investor_organization_id: orgId },
    });

    const configMock = getCurlecConfig as jest.Mock;
    const originalImpl = configMock.getMockImplementation();
    configMock.mockImplementation((gatewayAccount: string = "OPERATING") => {
      if (gatewayAccount === "INVESTOR_POOL") {
        throw new Error(
          "Curlec INVESTOR_POOL credentials are required. Missing: CURLEC_INVESTOR_POOL_KEY_ID."
        );
      }
      return {
        gatewayAccount,
        keyId: "rzp_test_legacy_key",
        keySecret: "secret",
        webhookSecret: "whsec",
        apiBaseUrl: "https://api.razorpay.com",
        environment: "sandbox" as const,
      };
    });

    await expect(
      createInvestorDeposit(
        { userId },
        depositInput(1600, "21212121-2121-4121-8121-212121212121"),
        prisma
      )
    ).rejects.toMatchObject({
      code: "CURLEC_ACCOUNT_CONFIG_ERROR",
    });

    if (originalImpl) {
      configMock.mockImplementation(originalImpl);
    }

    const afterCount = await prisma.gatewayPayment.count({
      where: { purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT, investor_organization_id: orgId },
    });
    expect(afterCount).toBe(beforeCount);
  });

  it("blocks IDOR on deposit lookup", async () => {
    if (!migrated) return;

    const created = await createInvestorDeposit(
      { userId },
      depositInput(150, "14141414-1414-4414-8414-141414141414"),
      prisma
    );
    createdPaymentIds.push(created.id);

    await expect(getInvestorDeposit({ userId: "other-user" }, created.id, prisma)).rejects.toMatchObject(
      { code: "DEPOSIT_NOT_FOUND" }
    );
  });
});
