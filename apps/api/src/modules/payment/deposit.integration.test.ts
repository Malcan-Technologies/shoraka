import {
  GatewayOrganizationType,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  OrganizationType,
  Prisma,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import { createInvestorDeposit, getInvestorDeposit } from "./deposit-service";

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

describeIntegration("investor deposit service", () => {
  let migrated = false;
  let userId = "";
  let orgId = "";
  const createdPaymentIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];

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
      createInvestorDeposit({ userId }, { investorOrganizationId: orgId, amount: 50 }, prisma)
    ).rejects.toMatchObject({ code: "DEPOSIT_BELOW_MINIMUM" });
  });

  it("rejects deposits above platform maximum", async () => {
    if (!migrated) return;

    await expect(
      createInvestorDeposit({ userId }, { investorOrganizationId: orgId, amount: 50000 }, prisma)
    ).rejects.toMatchObject({ code: "DEPOSIT_ABOVE_MAXIMUM" });
  });

  it("creates a CREATED gateway payment for valid deposits", async () => {
    if (!migrated) return;

    const result = await createInvestorDeposit(
      { userId },
      { investorOrganizationId: orgId, amount: 250 },
      prisma
    );
    createdPaymentIds.push(result.id);

    expect(result.status).toBe(GatewayPaymentStatus.CREATED);
    expect(result.curlecOrderId).toBe("order_test_m4_1");
    expect(result.amount).toBe(250);

    const stored = await prisma.gatewayPayment.findUnique({ where: { id: result.id } });
    expect(stored?.purpose).toBe(GatewayPaymentPurpose.INVESTOR_DEPOSIT);
    expect(stored?.organization_type).toBe(GatewayOrganizationType.INVESTOR);
    expect(stored?.idempotency_key).toBe("curlec:order:order_test_m4_1");
  });

  it("blocks IDOR on deposit lookup", async () => {
    if (!migrated) return;

    const created = await createInvestorDeposit(
      { userId },
      { investorOrganizationId: orgId, amount: 150 },
      prisma
    );
    createdPaymentIds.push(created.id);

    await expect(getInvestorDeposit({ userId: "other-user" }, created.id, prisma)).rejects.toMatchObject(
      { code: "DEPOSIT_NOT_FOUND" }
    );
  });
});
