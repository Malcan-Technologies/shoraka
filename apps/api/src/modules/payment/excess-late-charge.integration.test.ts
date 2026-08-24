import {
  GatewayOrganizationType,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  NoteInvestmentStatus,
  NoteLedgerDirection,
  NoteSettlementStatus,
  OrganizationType,
  Prisma,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import { createCurlecClient } from "./curlec-client";
import {
  createExcessLateChargePayment,
  getExcessLateChargePayment,
} from "./excess-late-charge-payment-service";
import { processExcessLateChargeCapture } from "./webhook-service";

jest.mock("./curlec-client", () => {
  let orderCounter = 0;
  let lastOrderSen = 500000;
  return {
    createCurlecClient: jest.fn(() => ({
      createOrder: jest.fn(async (input: { amountSen?: number }) => {
        orderCounter += 1;
        lastOrderSen = input.amountSen ?? lastOrderSen;
        return {
          id: `order_test_elc_${orderCounter}`,
          amount: lastOrderSen,
          currency: "MYR",
          status: "created",
        };
      }),
      fetchPayment: jest.fn(async (paymentId: string) => ({
        id: paymentId,
        amount: lastOrderSen,
        currency: "MYR",
        status: "captured",
        method: "fpx",
        order_id: null,
      })),
      fetchOrderPayments: jest.fn(async () => []),
      refundPayment: jest.fn(async () => ({
        id: `rfnd_elc_${Date.now()}`,
        amount: lastOrderSen,
        currency: "MYR",
        status: "processed",
      })),
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

jest.mock("./receipt/receipt-service", () => {
  const actual = jest.requireActual("./receipt/receipt-service") as Record<string, unknown>;
  return {
    ...actual,
    scheduleGatewayPaymentReceipt: jest.fn(),
  };
});

jest.mock("../notification/excess-late-charge-notifications", () => ({
  notifyExcessLateChargesDue: jest.fn().mockResolvedValue(undefined),
  notifyExcessLateChargesPaidIfSettled: jest.fn().mockResolvedValue(undefined),
}));

const prisma = new PrismaClient();
const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

describeIntegration("excess late charge gateway payments", () => {
  let migrated = false;
  let userId = "";
  let otherUserId = "";
  let orgId = "";
  let investorOrgId = "";
  let noteId = "";
  let settlementId = "";
  const createdPaymentIds: string[] = [];
  const createdNoteIds: string[] = [];
  const createdSettlementIds: string[] = [];
  const createdInvestmentIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdInvestorOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdEventIds: string[] = [];

  async function seedCaptureWebhookEvent(eventId: string, orderId: string, paymentId: string) {
    createdEventIds.push(eventId);
    await prisma.gatewayWebhookEvent.create({
      data: {
        event_id: eventId,
        event_type: "payment.captured",
        gatewayAccount: "OPERATING",
        payload: {
          event: "payment.captured",
          payload: { payment: { entity: { id: paymentId, order_id: orderId } } },
        },
        signature_valid: true,
      },
    });
  }

  async function capturePayment(payment: { id: string; curlec_order_id: string }) {
    const paymentId = `pay_elc_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const eventId = `evt_elc_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    await seedCaptureWebhookEvent(eventId, payment.curlec_order_id, paymentId);
    await processExcessLateChargeCapture(
      {
        orderId: payment.curlec_order_id,
        paymentId,
        eventId,
        routeGatewayAccount: "OPERATING",
      },
      prisma
    );
  }

  async function createPostedNote(input: {
    suffix: string;
    owed: number;
    paid?: number;
    tawidh: number;
    gharamah: number;
    tawidhSharePercent?: number;
  }) {
    const note = await prisma.note.create({
      data: {
        source_application_id: `app-elc-${input.suffix}`,
        issuer_organization_id: orgId,
        title: `Late charge note ${input.suffix}`,
        note_reference: `NOTE-ELC-${input.suffix}`,
        issuer_snapshot: { name: "Late Charge Corp" },
        requested_amount: new Prisma.Decimal("80000"),
        target_amount: new Prisma.Decimal("80000"),
        funded_amount: new Prisma.Decimal("80000"),
      },
    });
    createdNoteIds.push(note.id);
    const settlement = await prisma.noteSettlement.create({
      data: {
        note_id: note.id,
        status: NoteSettlementStatus.POSTED,
        posted_at: new Date(),
        excess_late_charge_amount: new Prisma.Decimal(input.owed.toFixed(6)),
        excess_late_charge_paid_amount: new Prisma.Decimal((input.paid ?? 0).toFixed(6)),
        excess_tawidh_amount: new Prisma.Decimal(input.tawidh.toFixed(6)),
        excess_gharamah_amount: new Prisma.Decimal(input.gharamah.toFixed(6)),
        tawidh_investor_share_percent: new Prisma.Decimal((input.tawidhSharePercent ?? 50).toFixed(6)),
        preview_snapshot: {
          unpaidTawidhAmount: input.tawidh,
          unpaidGharamahAmount: input.gharamah,
        },
      },
    });
    createdSettlementIds.push(settlement.id);
    const investment = await prisma.noteInvestment.create({
      data: {
        note_id: note.id,
        investor_organization_id: investorOrgId,
        investor_user_id: userId,
        status: NoteInvestmentStatus.SETTLED,
        amount: new Prisma.Decimal("80000"),
      },
    });
    createdInvestmentIds.push(investment.id);
    return { note, settlement };
  }

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1 FROM gateway_payments LIMIT 1`;
      await prisma.$queryRaw`SELECT excess_tawidh_amount FROM note_settlements LIMIT 1`;
      await prisma.$queryRaw`SELECT excess_late_charge_gateway_txn_max_amount FROM platform_finance_settings LIMIT 1`;
      migrated = true;
    } catch {
      migrated = false;
    }

    if (!migrated) return;

    const suffix = `${Date.now()}`.slice(-4);
    const user = await prisma.user.create({
      data: {
        user_id: `E${suffix}`.slice(0, 5),
        email: `excess-late-${Date.now()}@example.com`,
        cognito_sub: `sub-elc-${Date.now()}`,
        cognito_username: `elc-${Date.now()}`,
        first_name: "Late",
        last_name: "Issuer",
        roles: [UserRole.ISSUER],
        issuer_account: ["COMPANY"],
      },
    });
    userId = user.user_id;
    createdUserIds.push(userId);

    const other = await prisma.user.create({
      data: {
        user_id: `X${suffix}`.slice(0, 5),
        email: `excess-late-other-${Date.now()}@example.com`,
        cognito_sub: `sub-elc-other-${Date.now()}`,
        cognito_username: `elc-other-${Date.now()}`,
        first_name: "Other",
        last_name: "Issuer",
        roles: [UserRole.ISSUER],
        issuer_account: ["COMPANY"],
      },
    });
    otherUserId = other.user_id;
    createdUserIds.push(otherUserId);

    const org = await prisma.issuerOrganization.create({
      data: {
        owner_user_id: userId,
        type: OrganizationType.COMPANY,
        name: "Late Charge Corp",
      },
    });
    orgId = org.id;
    createdOrgIds.push(orgId);

    const investorOrg = await prisma.investorOrganization.create({
      data: {
        owner_user_id: userId,
        type: OrganizationType.PERSONAL,
        name: "Late Charge Investor",
      },
    });
    investorOrgId = investorOrg.id;
    createdInvestorOrgIds.push(investorOrgId);

    const seeded = await createPostedNote({
      suffix: `${Date.now()}`.slice(-6),
      owed: 8_000,
      tawidh: 3_000,
      gharamah: 5_000,
    });
    noteId = seeded.note.id;
    settlementId = seeded.settlement.id;

    await prisma.platformFinanceSetting.upsert({
      where: { key: "DEFAULT" },
      update: {
        excess_late_charge_gateway_txn_max_amount: new Prisma.Decimal("5000.000000"),
      },
      create: {
        key: "DEFAULT",
        excess_late_charge_gateway_txn_max_amount: new Prisma.Decimal("5000.000000"),
      },
    });
  });

  afterAll(async () => {
    if (createdEventIds.length > 0) {
      await prisma.gatewayWebhookEvent.deleteMany({ where: { event_id: { in: createdEventIds } } });
    }
    if (createdPaymentIds.length > 0) {
      await prisma.noteLedgerEntry.deleteMany({
        where: { gateway_payment_id: { in: createdPaymentIds } },
      });
      await prisma.investorBalanceTransaction.deleteMany({
        where: { note_id: { in: createdNoteIds } },
      });
      await prisma.gatewayPayment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdNoteIds.length > 0) {
      await prisma.gatewayOrderAttempt.deleteMany({
        where: {
          purpose: GatewayPaymentPurpose.EXCESS_LATE_CHARGES,
          OR: createdNoteIds.map((id) => ({ scope_key: { startsWith: `note:${id}` } })),
        },
      });
      await prisma.noteInvestment.deleteMany({ where: { id: { in: createdInvestmentIds } } });
      await prisma.noteSettlement.deleteMany({ where: { id: { in: createdSettlementIds } } });
      await prisma.note.deleteMany({ where: { id: { in: createdNoteIds } } });
    }
    if (createdInvestorOrgIds.length > 0) {
      await prisma.investorBalance.deleteMany({
        where: { investor_organization_id: { in: createdInvestorOrgIds } },
      });
      await prisma.investorOrganization.deleteMany({ where: { id: { in: createdInvestorOrgIds } } });
    }
    if (createdOrgIds.length > 0) {
      await prisma.issuerOrganization.deleteMany({ where: { id: { in: createdOrgIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { user_id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  it("clamps the first order to the configured per-transaction max", async () => {
    if (!migrated) return;

    const result = await createExcessLateChargePayment({ userId }, noteId, prisma);
    createdPaymentIds.push(result.id);

    expect(result.status).toBe(GatewayPaymentStatus.CREATED);
    expect(result.amount).toBe(5_000);
    expect(result.purpose).toBe(GatewayPaymentPurpose.EXCESS_LATE_CHARGES);
    expect(result.noteId).toBe(noteId);
    expect(result.settlementId).toBe(settlementId);
    expect(result.gatewayAccount).toBe("OPERATING");
    expect(result.outstanding).toBe(8_000);
    expect(result.owedAmount).toBe(8_000);
    expect(result.perTxnMaxAmount).toBe(5_000);

    const stored = await prisma.gatewayPayment.findUnique({ where: { id: result.id } });
    expect(stored?.purpose).toBe(GatewayPaymentPurpose.EXCESS_LATE_CHARGES);
    expect(stored?.organization_type).toBe(GatewayOrganizationType.ISSUER);
    expect(stored?.note_id).toBe(noteId);
    expect(stored?.settlement_id).toBe(settlementId);
    expect(stored?.idempotency_key).toBe(`note:${noteId}:excess-late-charges:1`);
  });

  it("reuses an active CREATED order instead of opening another", async () => {
    if (!migrated) return;

    const first = await createExcessLateChargePayment({ userId }, noteId, prisma);
    const second = await createExcessLateChargePayment({ userId }, noteId, prisma);
    createdPaymentIds.push(first.id);

    expect(second.id).toBe(first.id);
    const count = await prisma.gatewayPayment.count({
      where: { note_id: noteId, purpose: GatewayPaymentPurpose.EXCESS_LATE_CHARGES },
    });
    expect(count).toBe(1);
  });

  it("blocks IDOR on create and lookup", async () => {
    if (!migrated) return;

    const created = await createExcessLateChargePayment({ userId }, noteId, prisma);
    createdPaymentIds.push(created.id);

    await expect(
      createExcessLateChargePayment({ userId: otherUserId }, noteId, prisma)
    ).rejects.toMatchObject({ code: "NOTE_FORBIDDEN" });
    await expect(
      getExcessLateChargePayment({ userId: otherUserId }, noteId, created.id, prisma)
    ).rejects.toMatchObject({ code: "NOTE_FORBIDDEN" });
  });

  it("captures under the settlement lock, splits the ledger, and allows the next order", async () => {
    if (!migrated) return;

    const { scheduleGatewayPaymentReceipt } = await import("./receipt/receipt-service");
    const first = await createExcessLateChargePayment({ userId }, noteId, prisma);
    createdPaymentIds.push(first.id);
    const stored = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: first.id } });
    await capturePayment(stored);

    const completed = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: first.id } });
    expect(completed.status).toBe(GatewayPaymentStatus.COMPLETED);
    expect(scheduleGatewayPaymentReceipt).toHaveBeenCalledWith(first.id, prisma);

    const settlement = await prisma.noteSettlement.findUniqueOrThrow({ where: { id: settlementId } });
    expect(settlement.excess_late_charge_paid_amount.toNumber()).toBe(5_000);

    const entries = await prisma.noteLedgerEntry.findMany({
      where: { gateway_payment_id: first.id },
      include: { account: true },
    });
    const byKey = Object.fromEntries(entries.map((entry) => [entry.idempotency_key, entry]));
    expect(byKey[`gateway-elc:operating-credit:${first.id}`]?.direction).toBe(
      NoteLedgerDirection.CREDIT
    );
    expect(byKey[`gateway-elc:operating-credit:${first.id}`]?.amount.toNumber()).toBe(5_000);
    expect(byKey[`gateway-elc:operating-debit:${first.id}`]?.direction).toBe(
      NoteLedgerDirection.DEBIT
    );
    expect(byKey[`gateway-elc:operating-debit:${first.id}`]?.amount.toNumber()).toBe(5_000);
    expect(byKey[`gateway-elc:investor-pool:${first.id}`]?.account.code).toBe("INVESTOR_POOL");
    expect(byKey[`gateway-elc:investor-pool:${first.id}`]?.amount.toNumber()).toBe(1_500);
    expect(byKey[`gateway-elc:tawidh:${first.id}`]?.account.code).toBe("TAWIDH_ACCOUNT");
    expect(byKey[`gateway-elc:tawidh:${first.id}`]?.amount.toNumber()).toBe(1_500);
    expect(byKey[`gateway-elc:gharamah:${first.id}`]?.account.code).toBe("GHARAMAH_ACCOUNT");
    expect(byKey[`gateway-elc:gharamah:${first.id}`]?.amount.toNumber()).toBe(2_000);

    const investorCredit = await prisma.investorBalanceTransaction.findFirst({
      where: { idempotency_key: { startsWith: `investor-balance:elc:${first.id}:` } },
    });
    expect(investorCredit?.amount.toNumber()).toBe(1_500);

    const replayEventId = `evt_elc_replay_${Date.now()}`;
    await seedCaptureWebhookEvent(replayEventId, stored.curlec_order_id, `pay_elc_replay_${Date.now()}`);
    await processExcessLateChargeCapture(
      {
        orderId: stored.curlec_order_id,
        paymentId: `pay_elc_replay_${Date.now()}`,
        eventId: replayEventId,
        routeGatewayAccount: "OPERATING",
      },
      prisma
    );
    expect(
      (
        await prisma.noteSettlement.findUniqueOrThrow({ where: { id: settlementId } })
      ).excess_late_charge_paid_amount.toNumber()
    ).toBe(5_000);
    expect(
      await prisma.noteLedgerEntry.count({
        where: { idempotency_key: `gateway-elc:operating-credit:${first.id}` },
      })
    ).toBe(1);

    const second = await createExcessLateChargePayment({ userId }, noteId, prisma);
    createdPaymentIds.push(second.id);
    expect(second.id).not.toBe(first.id);
    expect(second.amount).toBe(3_000);
    expect(second.outstanding).toBe(3_000);
    expect(second.paidAmount).toBe(5_000);
    expect(second.idempotency_key ?? (await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: second.id } })).idempotency_key).toBe(
      `note:${noteId}:excess-late-charges:2`
    );

    const secondStored = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: second.id } });
    await capturePayment(secondStored);
    const afterSecond = await prisma.noteSettlement.findUniqueOrThrow({ where: { id: settlementId } });
    expect(afterSecond.excess_late_charge_paid_amount.toNumber()).toBe(8_000);

    const secondEntries = await prisma.noteLedgerEntry.findMany({
      where: { gateway_payment_id: second.id },
      include: { account: true },
    });
    expect(
      secondEntries.find((entry) => entry.account.code === "GHARAMAH_ACCOUNT")?.amount.toNumber()
    ).toBe(3_000);
    expect(secondEntries.some((entry) => entry.account.code === "TAWIDH_ACCOUNT")).toBe(false);
    expect(secondEntries.some((entry) => entry.account.code === "INVESTOR_POOL")).toBe(false);
  });

  it("returns 409 when outstanding is already zero", async () => {
    if (!migrated) return;

    await expect(createExcessLateChargePayment({ userId }, noteId, prisma)).rejects.toMatchObject({
      code: "EXCESS_LATE_CHARGE_NOT_DUE",
      statusCode: 409,
    });
  });

  it("rejects a grandfathered posted settlement that has no frozen split", async () => {
    if (!migrated) return;

    const missing = await createPostedNote({
      suffix: `miss${Date.now()}`.slice(-6),
      owed: 250,
      tawidh: 0,
      gharamah: 0,
    });

    await expect(
      createExcessLateChargePayment({ userId }, missing.note.id, prisma)
    ).rejects.toMatchObject({
      code: "EXCESS_LATE_CHARGE_SPLIT_MISSING",
      statusCode: 409,
    });
  });

  it("does not over-credit paid when a capture would exceed the frozen total", async () => {
    if (!migrated) return;

    const overflow = await createPostedNote({
      suffix: `over${Date.now()}`.slice(-6),
      owed: 8_000,
      paid: 7_500,
      tawidh: 3_000,
      gharamah: 5_000,
    });

    const overflowPayment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.EXCESS_LATE_CHARGES,
        organization_type: GatewayOrganizationType.ISSUER,
        gatewayAccount: "OPERATING",
        issuer_organization_id: orgId,
        note_id: overflow.note.id,
        settlement_id: overflow.settlement.id,
        amount: new Prisma.Decimal("2000.000000"),
        currency: "MYR",
        status: GatewayPaymentStatus.CREATED,
        curlec_order_id: `order_elc_overflow_${Date.now()}`,
        idempotency_key: `elc-overflow-${Date.now()}`,
      },
    });
    createdPaymentIds.push(overflowPayment.id);

    const mockedCreateCurlecClient = createCurlecClient as jest.Mock;
    mockedCreateCurlecClient.mockImplementation(() => ({
      createOrder: jest.fn(),
      fetchPayment: jest.fn(async (paymentId: string) => ({
        id: paymentId,
        amount: 200000,
        currency: "MYR",
        status: "captured",
        method: "fpx",
        order_id: null,
      })),
      fetchOrderPayments: jest.fn(async () => []),
      refundPayment: jest.fn(),
    }));

    const paymentId = `pay_elc_overflow_${Date.now()}`;
    const eventId = `evt_elc_overflow_${Date.now()}`;
    await seedCaptureWebhookEvent(eventId, overflowPayment.curlec_order_id, paymentId);

    await processExcessLateChargeCapture(
      {
        orderId: overflowPayment.curlec_order_id,
        paymentId,
        eventId,
        routeGatewayAccount: "OPERATING",
      },
      prisma
    );

    const settlement = await prisma.noteSettlement.findUniqueOrThrow({
      where: { id: overflow.settlement.id },
    });
    expect(settlement.excess_late_charge_paid_amount.toNumber()).toBe(7_500);
    const payment = await prisma.gatewayPayment.findUniqueOrThrow({
      where: { id: overflowPayment.id },
    });
    expect(payment.status).toBe(GatewayPaymentStatus.HELD);
    expect((payment.metadata as { captureMismatch?: { mismatchType?: string } }).captureMismatch).toMatchObject({
      mismatchType: "EXCESS_LATE_CHARGE_CAPTURE_EXCEEDS_TOTAL",
    });
    expect(
      await prisma.noteLedgerEntry.count({
        where: { idempotency_key: `gateway-elc:operating-credit:${overflowPayment.id}` },
      })
    ).toBe(0);

    await expect(
      createExcessLateChargePayment({ userId }, overflow.note.id, prisma)
    ).rejects.toMatchObject({
      code: "EXCESS_LATE_CHARGE_CAPTURE_MISMATCH_HELD",
      statusCode: 409,
    });
  });
});
