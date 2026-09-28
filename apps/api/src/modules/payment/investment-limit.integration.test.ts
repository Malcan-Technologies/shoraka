import {
  NoteInvestmentStatus,
  NoteStatus,
  OrganizationType,
  Prisma,
  PrismaClient,
  ScInvestorCategory,
  UserRole,
} from "@prisma/client";
import {
  computeInvestmentHeadroom,
  lockInvestorInvestmentLimit,
  assertInvestmentWithinLimit,
} from "../notes/investment-limit";
import { createInvestorDeposit } from "./deposit-service";

jest.mock("./curlec-client", () => {
  let orderCounter = 0;
  return {
    createCurlecClient: jest.fn(() => ({
      createOrder: jest.fn(async () => {
        orderCounter += 1;
        return {
          id: `order_limit_${orderCounter}`,
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
    gatewayAccount: "INVESTOR_POOL",
    keyId: "rzp_test_pool_key",
    keySecret: "secret",
    webhookSecret: "whsec",
    apiBaseUrl: "https://api.razorpay.com",
    environment: "sandbox" as const,
  })),
}));

const prisma = new PrismaClient();
const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

describeIntegration("investor investment limits", () => {
  let migrated = false;
  let userId = "";
  let orgId = "";
  let issuerOrgId = "";
  const createdNoteIds: string[] = [];
  const createdInvestmentIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdIssuerOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  let previousLimits: {
    retail: Prisma.Decimal | null;
    angel: Prisma.Decimal | null;
    sophisticated: Prisma.Decimal | null;
  } | null = null;

  async function createNote(status: NoteStatus, suffix: string) {
    const note = await prisma.note.create({
      data: {
        source_application_id: `app-limit-${suffix}`,
        issuer_organization_id: issuerOrgId,
        title: `Limit note ${suffix}`,
        note_reference: `NOTE-LIM-${suffix}`,
        issuer_snapshot: { name: "Limit Corp" },
        requested_amount: new Prisma.Decimal("80000"),
        target_amount: new Prisma.Decimal("80000"),
        funded_amount: new Prisma.Decimal("20000"),
        status,
      },
    });
    createdNoteIds.push(note.id);
    return note;
  }

  async function createInvestment(
    noteId: string,
    amount: number,
    status: NoteInvestmentStatus
  ) {
    const investment = await prisma.noteInvestment.create({
      data: {
        note_id: noteId,
        investor_organization_id: orgId,
        investor_user_id: userId,
        status,
        amount: new Prisma.Decimal(amount.toFixed(6)),
      },
    });
    createdInvestmentIds.push(investment.id);
    return investment;
  }

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT retail_investment_limit_amount FROM platform_finance_settings LIMIT 1`;
      migrated = true;
    } catch {
      migrated = false;
    }
    if (!migrated) return;

    const suffix = `${Date.now()}`.slice(-6);
    const user = await prisma.user.create({
      data: {
        user_id: `L${suffix}`.slice(0, 5),
        email: `limit-test-${Date.now()}@example.com`,
        cognito_sub: `sub-limit-${Date.now()}`,
        cognito_username: `limit-${Date.now()}`,
        first_name: "Limit",
        last_name: "Investor",
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
        first_name: "Limit",
        last_name: "Investor",
        sc_investor_category: ScInvestorCategory.RETAIL,
      },
    });
    orgId = org.id;
    createdOrgIds.push(orgId);

    const issuerUser = await prisma.user.create({
      data: {
        user_id: `I${suffix}`.slice(0, 5),
        email: `limit-issuer-${Date.now()}@example.com`,
        cognito_sub: `sub-limit-iss-${Date.now()}`,
        cognito_username: `limit-iss-${Date.now()}`,
        first_name: "Limit",
        last_name: "Issuer",
        roles: [UserRole.ISSUER],
        issuer_account: ["COMPANY"],
      },
    });
    createdUserIds.push(issuerUser.user_id);

    const issuerOrg = await prisma.issuerOrganization.create({
      data: {
        owner_user_id: issuerUser.user_id,
        type: OrganizationType.COMPANY,
        name: "Limit Issuer Sdn Bhd",
      },
    });
    issuerOrgId = issuerOrg.id;
    createdIssuerOrgIds.push(issuerOrgId);

    const settings = await prisma.platformFinanceSetting.upsert({
      where: { key: "DEFAULT" },
      update: {},
      create: { key: "DEFAULT" },
    });
    previousLimits = {
      retail: settings.retail_investment_limit_amount,
      angel: settings.angel_investment_limit_amount,
      sophisticated: settings.sophisticated_investment_limit_amount,
    };
    await prisma.platformFinanceSetting.update({
      where: { key: "DEFAULT" },
      data: {
        retail_investment_limit_amount: new Prisma.Decimal("50000"),
        angel_investment_limit_amount: new Prisma.Decimal("500000"),
        sophisticated_investment_limit_amount: null,
        investor_min_deposit_amount: new Prisma.Decimal("100"),
        investor_max_deposit_amount: new Prisma.Decimal("30000"),
      },
    });
  });

  beforeEach(async () => {
    if (!migrated || !orgId) return;
    if (createdInvestmentIds.length > 0) {
      await prisma.noteInvestment.deleteMany({ where: { id: { in: createdInvestmentIds } } });
      createdInvestmentIds.length = 0;
    }
  });

  afterAll(async () => {
    if (createdPaymentIds.length > 0) {
      await prisma.gatewayPayment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdInvestmentIds.length > 0) {
      await prisma.noteInvestment.deleteMany({ where: { id: { in: createdInvestmentIds } } });
    }
    if (createdNoteIds.length > 0) {
      await prisma.note.deleteMany({ where: { id: { in: createdNoteIds } } });
    }
    if (previousLimits && migrated) {
      await prisma.platformFinanceSetting.update({
        where: { key: "DEFAULT" },
        data: {
          retail_investment_limit_amount: previousLimits.retail,
          angel_investment_limit_amount: previousLimits.angel,
          sophisticated_investment_limit_amount: previousLimits.sophisticated,
        },
      });
    }
    if (createdOrgIds.length > 0) {
      await prisma.investorBalance.deleteMany({
        where: { investor_organization_id: { in: createdOrgIds } },
      });
      await prisma.investorOrganization.deleteMany({ where: { id: { in: createdOrgIds } } });
    }
    if (createdIssuerOrgIds.length > 0) {
      await prisma.issuerOrganization.deleteMany({ where: { id: { in: createdIssuerOrgIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { user_id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  it("blocks an amount that would take outstanding principal over the retail limit", async () => {
    if (!migrated) return;
    const note = await createNote(NoteStatus.ACTIVE, `a${Date.now()}`.slice(-8));
    await createInvestment(note.id, 50_000, NoteInvestmentStatus.CONFIRMED);

    const headroom = await computeInvestmentHeadroom(orgId, prisma);
    expect(headroom.tier).toBe("RETAIL");
    expect(headroom.limit).toBe(50_000);
    expect(headroom.outstandingPrincipal).toBe(50_000);
    expect(headroom.investHeadroom).toBe(0);
    await prisma.$transaction(async (tx) => {
      await expect(
        assertInvestmentWithinLimit(tx, { investorOrganizationId: orgId, amount: 1 })
      ).rejects.toMatchObject({ code: "INVESTMENT_LIMIT_EXCEEDED" });
    });
  });

  it("allows 20k then 30k and leaves no further invest headroom", async () => {
    if (!migrated) return;
    const first = await createNote(NoteStatus.FUNDING, `b${Date.now()}`.slice(-8));
    await createInvestment(first.id, 20_000, NoteInvestmentStatus.COMMITTED);
    const after20 = await computeInvestmentHeadroom(orgId, prisma);
    expect(after20.investHeadroom).toBe(30_000);

    const second = await createNote(NoteStatus.FUNDING, `c${Date.now()}`.slice(-8));
    await createInvestment(second.id, 30_000, NoteInvestmentStatus.COMMITTED);
    const after50 = await computeInvestmentHeadroom(orgId, prisma);
    expect(after50.investHeadroom).toBe(0);
    expect(after50.outstandingPrincipal).toBe(50_000);
    await prisma.$transaction(async (tx) => {
      await expect(
        assertInvestmentWithinLimit(tx, { investorOrganizationId: orgId, amount: 1 })
      ).rejects.toMatchObject({ code: "INVESTMENT_LIMIT_EXCEEDED" });
    });
  });

  it("does not count settled, defaulted, or released principal as outstanding", async () => {
    if (!migrated) return;
    const settledNote = await createNote(NoteStatus.REPAID, `d${Date.now()}`.slice(-8));
    await createInvestment(settledNote.id, 10_000, NoteInvestmentStatus.SETTLED);

    const defaultedNote = await createNote(NoteStatus.DEFAULTED, `e${Date.now()}`.slice(-8));
    await createInvestment(defaultedNote.id, 10_000, NoteInvestmentStatus.CONFIRMED);

    const failedNote = await createNote(NoteStatus.FAILED_FUNDING, `f${Date.now()}`.slice(-8));
    await createInvestment(failedNote.id, 10_000, NoteInvestmentStatus.RELEASED);

    const headroom = await computeInvestmentHeadroom(orgId, prisma);
    expect(headroom.outstandingPrincipal).toBe(0);
    expect(headroom.investHeadroom).toBe(50_000);
  });

  it("applies a changed admin limit to the next headroom check", async () => {
    if (!migrated) return;
    const note = await createNote(NoteStatus.ACTIVE, `g${Date.now()}`.slice(-8));
    await createInvestment(note.id, 50_000, NoteInvestmentStatus.CONFIRMED);

    await prisma.platformFinanceSetting.update({
      where: { key: "DEFAULT" },
      data: { retail_investment_limit_amount: new Prisma.Decimal("60000") },
    });
    const raised = await computeInvestmentHeadroom(orgId, prisma);
    expect(raised.limit).toBe(60_000);
    expect(raised.investHeadroom).toBe(10_000);

    await prisma.platformFinanceSetting.update({
      where: { key: "DEFAULT" },
      data: { retail_investment_limit_amount: new Prisma.Decimal("50000") },
    });
    const restored = await computeInvestmentHeadroom(orgId, prisma);
    expect(restored.limit).toBe(50_000);
    expect(restored.investHeadroom).toBe(0);
  });

  it("blocks a deposit that would exceed remaining deposit headroom", async () => {
    if (!migrated) return;
    const note = await createNote(NoteStatus.ACTIVE, `h${Date.now()}`.slice(-8));
    await createInvestment(note.id, 50_000, NoteInvestmentStatus.CONFIRMED);
    await expect(
      createInvestorDeposit(
        { userId },
        {
          investorOrganizationId: orgId,
          amount: 100,
          depositIntentId: "22222222-2222-4222-8222-222222222222",
        },
        prisma
      )
    ).rejects.toMatchObject({ code: "DEPOSIT_LIMIT_EXCEEDED" });
  });

  it("takes a per-account advisory lock inside a transaction", async () => {
    if (!migrated) return;
    await prisma.$transaction(async (tx) => {
      await lockInvestorInvestmentLimit(tx, orgId);
    });
  });
});
