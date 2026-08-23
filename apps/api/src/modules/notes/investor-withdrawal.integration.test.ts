import {
  InvestorBalanceTransactionSource,
  OrganizationType,
  Prisma,
  PrismaClient,
  UserRole,
  WithdrawalType,
} from "@prisma/client";
import { NoteService } from "./service";
import {
  buildInvestorWithdrawalBalanceTxnKey,
  buildInvestorWithdrawalInstructionKey,
} from "./schemas";

const prisma = new PrismaClient();
const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

describeIntegration("investor withdrawal idempotency", () => {
  let migrated = false;
  let userId = "";
  let orgId = "";
  let secondUserId = "";
  let secondOrgId = "";
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdWithdrawalIds: string[] = [];
  const service = new NoteService();

  function actor(id = userId) {
    return { userId: id, portal: "INVESTOR" };
  }

  function input(amount: number, withdrawalIntentId: string, organizationId = orgId) {
    return { amount, investorOrganizationId: organizationId, withdrawalIntentId };
  }

  async function credit(organizationId: string, amount: number) {
    await prisma.investorBalance.upsert({
      where: { investor_organization_id: organizationId },
      create: {
        investor_organization_id: organizationId,
        available_amount: new Prisma.Decimal(amount.toFixed(6)),
      },
      update: { available_amount: new Prisma.Decimal(amount.toFixed(6)) },
    });
  }

  async function available(organizationId: string) {
    const row = await prisma.investorBalance.findUnique({
      where: { investor_organization_id: organizationId },
    });
    return row ? Number(row.available_amount.toString()) : 0;
  }

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1 FROM withdrawal_instructions LIMIT 1`;
      migrated = true;
    } catch {
      migrated = false;
    }
    if (!migrated) return;

    const suffix = `${Date.now()}`.slice(-4);
    const user = await prisma.user.create({
      data: {
        user_id: `W${suffix}`.slice(0, 5),
        email: `wdl-test-${Date.now()}@example.com`,
        cognito_sub: `wdl-sub-${Date.now()}`,
        cognito_username: `wdl-${Date.now()}`,
        first_name: "Wei",
        last_name: "Lin",
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
        name: "Wei Lin",
        first_name: "Wei",
        last_name: "Lin",
        bank_account_details: {
          bank_name: "Maybank",
          account_number: "1234567890",
          account_holder: "Wei Lin",
        },
      },
    });
    orgId = org.id;
    createdOrgIds.push(orgId);

    const secondUser = await prisma.user.create({
      data: {
        user_id: `X${suffix}`.slice(0, 5),
        email: `wdl-test-two-${Date.now()}@example.com`,
        cognito_sub: `wdl-sub-two-${Date.now()}`,
        cognito_username: `wdl-two-${Date.now()}`,
        first_name: "Xin",
        last_name: "Tan",
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
        name: "Xin Tan",
        first_name: "Xin",
        last_name: "Tan",
        bank_account_details: {
          bank_name: "CIMB",
          account_number: "0987654321",
          account_holder: "Xin Tan",
        },
      },
    });
    secondOrgId = secondOrg.id;
    createdOrgIds.push(secondOrgId);
  });

  afterAll(async () => {
    if (createdWithdrawalIds.length > 0) {
      await prisma.paymentAuditLog.deleteMany({
        where: { target_id: { in: createdWithdrawalIds } },
      });
      await prisma.displayReferenceAllocation.deleteMany({
        where: { entity_id: { in: createdWithdrawalIds } },
      });
      await prisma.withdrawalInstruction.deleteMany({
        where: { id: { in: createdWithdrawalIds } },
      });
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

  it("first request creates one instruction, one debit, and one REQUESTED audit", async () => {
    if (!migrated) return;
    await credit(orgId, 1000);
    const intent = "11111111-1111-4111-8111-111111111111";

    const created = await service.createInvestorWithdrawal(input(200, intent), actor());
    createdWithdrawalIds.push(created.id);

    expect(created.withdrawalType).toBe(WithdrawalType.INVESTOR_WITHDRAWAL);
    expect(created.amount).toBe(200);
    expect(created.displayReference).toMatch(/^WDL-/);

    const instructions = await prisma.withdrawalInstruction.findMany({
      where: { idempotency_key: buildInvestorWithdrawalInstructionKey(intent) },
    });
    expect(instructions).toHaveLength(1);

    const txns = await prisma.investorBalanceTransaction.findMany({
      where: { idempotency_key: buildInvestorWithdrawalBalanceTxnKey(intent) },
    });
    expect(txns).toHaveLength(1);
    expect(txns[0]?.source).toBe(InvestorBalanceTransactionSource.INVESTOR_WITHDRAWAL_REQUEST);
    expect(Number(txns[0]?.amount.toString())).toBe(200);

    const audits = await prisma.paymentAuditLog.findMany({
      where: { target_id: created.id, event_type: "INVESTOR_WITHDRAWAL_REQUESTED" },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.idempotency_key).toBe(`payment-audit:withdrawal-requested:${created.id}`);
    expect(await available(orgId)).toBe(800);
  });

  it("sequential retry with the same intent returns the same withdrawal without a second debit", async () => {
    if (!migrated) return;
    await credit(orgId, 600);
    const intent = "12121212-1212-4121-8121-121212121212";
    const first = await service.createInvestorWithdrawal(input(200, intent), actor());
    createdWithdrawalIds.push(first.id);
    const before = await available(orgId);

    const reused = await service.createInvestorWithdrawal(input(200, intent), actor());

    expect(reused.id).toBe(first.id);
    expect(reused.displayReference).toBe(first.displayReference);
    expect(await available(orgId)).toBe(before);
    expect(
      await prisma.investorBalanceTransaction.count({
        where: { idempotency_key: buildInvestorWithdrawalBalanceTxnKey(intent) },
      })
    ).toBe(1);
    expect(
      await prisma.paymentAuditLog.count({
        where: { target_id: first.id, event_type: "INVESTOR_WITHDRAWAL_REQUESTED" },
      })
    ).toBe(1);
  });

  it("concurrent same-intent requests debit once and return the same instruction", async () => {
    if (!migrated) return;
    await credit(orgId, 900);
    const intent = "22222222-2222-4222-8222-222222222222";
    const beforeTxns = await prisma.investorBalanceTransaction.count({
      where: { investor_organization_id: orgId },
    });

    const results = await Promise.all(
      Array.from({ length: 5 }, () => service.createInvestorWithdrawal(input(150, intent), actor()))
    );
    createdWithdrawalIds.push(results[0].id);

    expect(new Set(results.map((row) => row.id)).size).toBe(1);
    expect(new Set(results.map((row) => row.displayReference)).size).toBe(1);
    expect(
      await prisma.investorBalanceTransaction.count({
        where: { idempotency_key: buildInvestorWithdrawalBalanceTxnKey(intent) },
      })
    ).toBe(1);
    expect(
      await prisma.paymentAuditLog.count({
        where: { target_id: results[0].id, event_type: "INVESTOR_WITHDRAWAL_REQUESTED" },
      })
    ).toBe(1);
    expect(await prisma.investorBalanceTransaction.count({
      where: { investor_organization_id: orgId },
    })).toBe(beforeTxns + 1);
  });

  it("same amount with different intents creates two withdrawals when funded", async () => {
    if (!migrated) return;
    await credit(orgId, 500);
    const a = await service.createInvestorWithdrawal(
      input(100, "33333333-3333-4333-8333-333333333333"),
      actor()
    );
    const b = await service.createInvestorWithdrawal(
      input(100, "44444444-4444-4444-8444-444444444444"),
      actor()
    );
    createdWithdrawalIds.push(a.id, b.id);
    expect(a.id).not.toBe(b.id);
    expect(await available(orgId)).toBe(300);
  });

  it("different intents exceeding balance allow only funded requests and keep balance >= 0", async () => {
    if (!migrated) return;
    await credit(orgId, 150);
    const first = await service.createInvestorWithdrawal(
      input(100, "55555555-5555-4555-8555-555555555555"),
      actor()
    );
    createdWithdrawalIds.push(first.id);

    await expect(
      service.createInvestorWithdrawal(input(100, "66666666-6666-4666-8666-666666666666"), actor())
    ).rejects.toMatchObject({ code: "INSUFFICIENT_INVESTOR_BALANCE" });

    expect(await available(orgId)).toBeGreaterThanOrEqual(0);
    expect(await available(orgId)).toBe(50);
    expect(
      await prisma.withdrawalInstruction.count({
        where: { idempotency_key: buildInvestorWithdrawalInstructionKey("66666666-6666-4666-8666-666666666666") },
      })
    ).toBe(0);
  });

  it("rejects the same intent with a different amount without debiting again", async () => {
    if (!migrated) return;
    const intent = "77777777-7777-4777-8777-777777777777";
    await credit(orgId, 400);
    const first = await service.createInvestorWithdrawal(input(120, intent), actor());
    createdWithdrawalIds.push(first.id);
    const before = await available(orgId);

    await expect(service.createInvestorWithdrawal(input(180, intent), actor())).rejects.toMatchObject({
      code: "WITHDRAWAL_INTENT_AMOUNT_CONFLICT",
    });
    expect(await available(orgId)).toBe(before);
  });

  it("rejects the same intent used against another organization", async () => {
    if (!migrated) return;
    const intent = "88888888-8888-4888-8888-888888888888";
    await credit(orgId, 300);
    await credit(secondOrgId, 300);
    const first = await service.createInvestorWithdrawal(input(110, intent), actor());
    createdWithdrawalIds.push(first.id);
    const beforeSecond = await available(secondOrgId);

    await expect(
      service.createInvestorWithdrawal(input(110, intent, secondOrgId), actor(secondUserId))
    ).rejects.toMatchObject({ code: "WITHDRAWAL_INTENT_OWNERSHIP_CONFLICT" });
    expect(await available(secondOrgId)).toBe(beforeSecond);
  });

  it("rolls back instruction, debit, and audit when funds are insufficient", async () => {
    if (!migrated) return;
    await credit(orgId, 50);
    const intent = "99999999-9999-4999-8999-999999999999";

    await expect(service.createInvestorWithdrawal(input(100, intent), actor())).rejects.toMatchObject({
      code: "INSUFFICIENT_INVESTOR_BALANCE",
    });

    expect(
      await prisma.withdrawalInstruction.count({
        where: { idempotency_key: buildInvestorWithdrawalInstructionKey(intent) },
      })
    ).toBe(0);
    expect(
      await prisma.investorBalanceTransaction.count({
        where: { idempotency_key: buildInvestorWithdrawalBalanceTxnKey(intent) },
      })
    ).toBe(0);
    expect(await available(orgId)).toBe(50);
  });

  it("rejects missing bank details without creating rows or debiting", async () => {
    if (!migrated) return;
    await prisma.investorOrganization.update({
      where: { id: secondOrgId },
      data: { bank_account_details: {} },
    });
    await credit(secondOrgId, 500);
    const before = await available(secondOrgId);
    const intent = "abababab-abab-4bab-8bab-abababababab";

    await expect(
      service.createInvestorWithdrawal(input(100, intent, secondOrgId), actor(secondUserId))
    ).rejects.toMatchObject({ code: "BENEFICIARY_DETAILS_MISSING" });

    expect(
      await prisma.withdrawalInstruction.count({
        where: { idempotency_key: buildInvestorWithdrawalInstructionKey(intent) },
      })
    ).toBe(0);
    expect(await available(secondOrgId)).toBe(before);
  });
});
