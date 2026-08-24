import {
  GatewayOrganizationType,
  GatewayPayment,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  InvestorBalanceTransactionSource,
  NoteLedgerDirection,
  NoteSettlementStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import {
  mapExcessLateChargesDto,
  NOTE_MONEY_TOLERANCE,
  resolveExcessLateChargeOutstanding,
  roundNoteMoney,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { creditInvestorBalance } from "../notes/investor-balance";
import { postLedgerEntry } from "../notes/ledger";
import { buildSettlementAllocations } from "../notes/calculators";
import type { ActorContext } from "./deposit-service";
import { createGatewayOrder, mapGatewayPaymentResponse } from "./gateway-order-service";
import { assertTransition } from "./state";
import {
  allocateExcessLateChargePayment,
  allocateRoundedShares,
  frozenExcessLateChargeTotal,
} from "./excess-late-charge-allocation";

function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

async function assertNoteAccess(db: PrismaClient, actor: ActorContext, noteId: string) {
  const note = await db.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      note_reference: true,
      issuer_organization_id: true,
    },
  });

  if (!note) {
    throw new AppError(403, "NOTE_FORBIDDEN", "Note is not accessible");
  }

  const org = await db.issuerOrganization.findFirst({
    where: {
      id: note.issuer_organization_id,
      OR: [{ owner_user_id: actor.userId }, { members: { some: { user_id: actor.userId } } }],
    },
    select: { id: true },
  });

  if (!org) {
    throw new AppError(403, "NOTE_FORBIDDEN", "Note is not accessible");
  }

  return note;
}

async function getExcessLateChargeGatewayTxnMaxAmount(
  db: PrismaClient | Prisma.TransactionClient
) {
  const settings = await db.platformFinanceSetting.upsert({
    where: { key: "DEFAULT" },
    update: {},
    create: { key: "DEFAULT" },
  });

  return decimalToNumber(settings.excess_late_charge_gateway_txn_max_amount);
}

async function lockSettlementRow(tx: Prisma.TransactionClient, settlementId: string) {
  await tx.$queryRaw`SELECT id FROM note_settlements WHERE id = ${settlementId} FOR UPDATE`;
}

function resolveSettlementTotals(settlement: {
  excess_late_charge_amount: Prisma.Decimal;
  excess_late_charge_paid_amount: Prisma.Decimal;
  excess_tawidh_amount: Prisma.Decimal;
  excess_gharamah_amount: Prisma.Decimal;
}) {
  const excessTawidhAmount = decimalToNumber(settlement.excess_tawidh_amount);
  const excessGharamahAmount = decimalToNumber(settlement.excess_gharamah_amount);
  const splitTotal = frozenExcessLateChargeTotal(excessTawidhAmount, excessGharamahAmount);
  const owedAmount = Math.max(splitTotal, decimalToNumber(settlement.excess_late_charge_amount));
  const paidAmount = decimalToNumber(settlement.excess_late_charge_paid_amount);
  return {
    excessTawidhAmount,
    excessGharamahAmount,
    owedAmount,
    paidAmount,
    outstanding: resolveExcessLateChargeOutstanding(owedAmount, paidAmount),
    splitTotal,
  };
}

function assertFrozenSplit(totals: ReturnType<typeof resolveSettlementTotals>) {
  if (totals.owedAmount <= 0) return;
  if (Math.abs(totals.splitTotal - totals.owedAmount) > NOTE_MONEY_TOLERANCE) {
    throw new AppError(
      409,
      "EXCESS_LATE_CHARGE_SPLIT_MISSING",
      "This settlement is missing a frozen Ta'widh and Gharamah split, so the charge cannot be collected."
    );
  }
}

function mapExcessLateChargePaymentResponse(
  payment: GatewayPayment,
  totals: {
    owedAmount: number;
    paidAmount: number;
    outstanding: number;
    perTxnMaxAmount: number;
    noteReference: string;
  }
) {
  return {
    ...mapGatewayPaymentResponse(payment),
    noteId: payment.note_id,
    settlementId: payment.settlement_id,
    owedAmount: totals.owedAmount,
    paidAmount: totals.paidAmount,
    outstanding: totals.outstanding,
    perTxnMaxAmount: totals.perTxnMaxAmount,
    noteReference: totals.noteReference,
  };
}

async function findPayablePostedSettlement(
  db: PrismaClient | Prisma.TransactionClient,
  noteId: string
) {
  const settlements = await db.noteSettlement.findMany({
    where: { note_id: noteId, status: NoteSettlementStatus.POSTED },
    orderBy: { posted_at: "desc" },
  });
  return (
    settlements.find((settlement) => resolveSettlementTotals(settlement).outstanding > 0) ??
    settlements[0] ??
    null
  );
}

async function findReusablePayment(
  db: PrismaClient | Prisma.TransactionClient,
  noteId: string
) {
  return db.gatewayPayment.findFirst({
    where: {
      purpose: GatewayPaymentPurpose.EXCESS_LATE_CHARGES,
      note_id: noteId,
      status: { in: [GatewayPaymentStatus.CREATED, GatewayPaymentStatus.PAID] },
    },
    orderBy: { created_at: "desc" },
  });
}

async function findBlockingPayment(
  db: PrismaClient | Prisma.TransactionClient,
  noteId: string
) {
  return db.gatewayPayment.findFirst({
    where: {
      purpose: GatewayPaymentPurpose.EXCESS_LATE_CHARGES,
      note_id: noteId,
      status: {
        in: [GatewayPaymentStatus.HELD, GatewayPaymentStatus.REFUND_INITIATED],
      },
    },
    orderBy: { created_at: "desc" },
  });
}

export async function createExcessLateChargePayment(
  actor: ActorContext,
  noteId: string,
  db: PrismaClient = defaultPrisma
) {
  const note = await assertNoteAccess(db, actor, noteId);
  const perTxnMaxAmount = await getExcessLateChargeGatewayTxnMaxAmount(db);

  return db.$transaction(async (tx) => {
    const payable = await findPayablePostedSettlement(tx, noteId);
    if (!payable) {
      throw new AppError(
        409,
        "EXCESS_LATE_CHARGE_NOT_DUE",
        "No posted settlement has outstanding late charges"
      );
    }
    await lockSettlementRow(tx, payable.id);
    const locked = await tx.noteSettlement.findUniqueOrThrow({ where: { id: payable.id } });
    const totals = resolveSettlementTotals(locked);
    assertFrozenSplit(totals);
    const responseTotals = {
      ...totals,
      perTxnMaxAmount,
      noteReference: note.note_reference,
    };

    if (totals.outstanding <= 0) {
      throw new AppError(
        409,
        "EXCESS_LATE_CHARGE_NOT_DUE",
        "No outstanding late charges are due",
        { outstanding: 0, owedAmount: totals.owedAmount, paidAmount: totals.paidAmount }
      );
    }

    const blocking = await findBlockingPayment(tx, noteId);
    if (blocking) {
      throw new AppError(
        409,
        "EXCESS_LATE_CHARGE_CAPTURE_MISMATCH_HELD",
        blocking.status === GatewayPaymentStatus.REFUND_INITIATED
          ? "A mismatched late-charge refund is still pending. Do not create another payment order."
          : "A captured late-charge payment needs attention. Do not create another payment order.",
        { gatewayPaymentId: blocking.id, status: blocking.status }
      );
    }

    const existing = await findReusablePayment(tx, noteId);
    if (existing) {
      return mapExcessLateChargePaymentResponse(existing, responseTotals);
    }

    const amount = roundNoteMoney(Math.min(totals.outstanding, perTxnMaxAmount));
    if (amount <= 0) {
      throw new AppError(
        409,
        "EXCESS_LATE_CHARGE_NOT_DUE",
        "No outstanding late charges are due",
        {
          outstanding: totals.outstanding,
          owedAmount: totals.owedAmount,
          paidAmount: totals.paidAmount,
        }
      );
    }

    const priorCount = await tx.gatewayPayment.count({
      where: { purpose: GatewayPaymentPurpose.EXCESS_LATE_CHARGES, note_id: noteId },
    });
    const created = await createGatewayOrder(
      actor,
      {
        purpose: GatewayPaymentPurpose.EXCESS_LATE_CHARGES,
        organizationType: GatewayOrganizationType.ISSUER,
        amount,
        receiptPrefix: "elc",
        notes: {
          noteId,
          settlementId: locked.id,
          issuerOrganizationId: note.issuer_organization_id,
        },
        issuerOrganizationId: note.issuer_organization_id,
        noteId,
        settlementId: locked.id,
        idempotencyKey: `note:${noteId}:excess-late-charges:${priorCount + 1}`,
      },
      tx
    );

    const stored = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: created.id } });
    return mapExcessLateChargePaymentResponse(stored, responseTotals);
  });
}

export async function getExcessLateChargePayment(
  actor: ActorContext,
  noteId: string,
  paymentId: string,
  db: PrismaClient = defaultPrisma
) {
  const note = await assertNoteAccess(db, actor, noteId);
  const perTxnMaxAmount = await getExcessLateChargeGatewayTxnMaxAmount(db);

  const payment = await db.gatewayPayment.findFirst({
    where: {
      id: paymentId,
      note_id: noteId,
      purpose: GatewayPaymentPurpose.EXCESS_LATE_CHARGES,
    },
  });

  if (!payment) {
    throw new AppError(404, "EXCESS_LATE_CHARGE_NOT_FOUND", "Late charge payment not found");
  }

  const { syncGatewayPaymentFromCurlec } = await import("./webhook-service");
  const synced = await syncGatewayPaymentFromCurlec(payment, db);
  const settlement = payment.settlement_id
    ? await db.noteSettlement.findUnique({ where: { id: payment.settlement_id } })
    : await findPayablePostedSettlement(db, noteId);
  const totals = settlement
    ? resolveSettlementTotals(settlement)
    : { owedAmount: 0, paidAmount: 0, outstanding: 0 };

  return mapExcessLateChargePaymentResponse(synced, {
    ...totals,
    perTxnMaxAmount,
    noteReference: note.note_reference,
  });
}

export async function completeExcessLateChargePayment(
  tx: Prisma.TransactionClient,
  gatewayPayment: GatewayPayment
) {
  if (!gatewayPayment.note_id) {
    throw new AppError(500, "GATEWAY_PAYMENT_INVALID", "Late charge payment is missing note");
  }

  const noteId = gatewayPayment.note_id;
  const captured = roundNoteMoney(gatewayPayment.amount.toNumber());
  const payable = gatewayPayment.settlement_id
    ? await tx.noteSettlement.findUnique({ where: { id: gatewayPayment.settlement_id } })
    : await findPayablePostedSettlement(tx, noteId);
  if (!payable || payable.note_id !== noteId || payable.status !== NoteSettlementStatus.POSTED) {
    throw new AppError(409, "EXCESS_LATE_CHARGE_NOT_DUE", "No posted settlement can accept this payment");
  }

  await lockSettlementRow(tx, payable.id);
  const settlement = await tx.noteSettlement.findUniqueOrThrow({ where: { id: payable.id } });
  const totals = resolveSettlementTotals(settlement);
  assertFrozenSplit(totals);
  const nextPaid = roundNoteMoney(totals.paidAmount + captured);
  if (nextPaid - totals.owedAmount > NOTE_MONEY_TOLERANCE) {
    return {
      heldForOverCredit: true as const,
      settlementId: settlement.id,
      remainingOwed: totals.outstanding,
    };
  }

  const allocation = allocateExcessLateChargePayment({
    excessTawidhAmount: totals.excessTawidhAmount,
    excessGharamahAmount: totals.excessGharamahAmount,
    tawidhInvestorSharePercent: decimalToNumber(settlement.tawidh_investor_share_percent),
    priorPaidAmount: totals.paidAmount,
    paymentAmount: captured,
  });

  await tx.noteSettlement.update({
    where: { id: settlement.id },
    data: {
      excess_late_charge_paid_amount: Math.min(nextPaid, totals.owedAmount),
    },
  });

  const confirmed = await tx.noteInvestment.findMany({
    where: { note_id: noteId, status: { in: ["CONFIRMED", "SETTLED"] } },
    select: { id: true, investor_organization_id: true, amount: true },
  });
  const shares = allocateRoundedShares(
    allocation.tawidhInvestorAmount,
    confirmed.map((investment) => investment.amount.toNumber())
  );
  const investorAllocations = buildSettlementAllocations({
    investments: confirmed.map((investment) => ({
      id: investment.id,
      investorOrganizationId: investment.investor_organization_id,
      amount: investment.amount.toNumber(),
    })),
    investorPrincipal: 0,
    investorProfitNet: 0,
    tawidhInvestorAmount: allocation.tawidhInvestorAmount,
  }).map((row, index) => ({
    ...row,
    tawidhInvestorShare: shares[index] ?? 0,
  }));

  await postLedgerEntry(tx, {
    accountCode: "OPERATING_ACCOUNT",
    direction: NoteLedgerDirection.CREDIT,
    amount: captured,
    description: "Late payment charges received into operating account",
    idempotencyKey: `gateway-elc:operating-credit:${gatewayPayment.id}`,
    gatewayPaymentId: gatewayPayment.id,
    noteId,
    settlementId: settlement.id,
    metadata: {
      gatewayPaymentId: gatewayPayment.id,
      settlementId: settlement.id,
      noteId,
      curlecOrderId: gatewayPayment.curlec_order_id,
      curlecPaymentId: gatewayPayment.curlec_payment_id,
    },
  });

  const transferTotal = allocation.allocatedTotal;
  if (transferTotal > 0) {
    await postLedgerEntry(tx, {
      accountCode: "OPERATING_ACCOUNT",
      direction: NoteLedgerDirection.DEBIT,
      amount: transferTotal,
      description: "Late payment charges allocated from operating account",
      idempotencyKey: `gateway-elc:operating-debit:${gatewayPayment.id}`,
      gatewayPaymentId: gatewayPayment.id,
      noteId,
      settlementId: settlement.id,
    });
  }
  if (allocation.tawidhInvestorAmount > 0) {
    await postLedgerEntry(tx, {
      accountCode: "INVESTOR_POOL",
      direction: NoteLedgerDirection.CREDIT,
      amount: allocation.tawidhInvestorAmount,
      description: "Investor Ta'widh from separately collected late charges",
      idempotencyKey: `gateway-elc:investor-pool:${gatewayPayment.id}`,
      gatewayPaymentId: gatewayPayment.id,
      noteId,
      settlementId: settlement.id,
    });
  }
  if (allocation.tawidhAccountAmount > 0) {
    await postLedgerEntry(tx, {
      accountCode: "TAWIDH_ACCOUNT",
      direction: NoteLedgerDirection.CREDIT,
      amount: allocation.tawidhAccountAmount,
      description: "Ta'widh account share from separately collected late charges",
      idempotencyKey: `gateway-elc:tawidh:${gatewayPayment.id}`,
      gatewayPaymentId: gatewayPayment.id,
      noteId,
      settlementId: settlement.id,
    });
  }
  if (allocation.gharamahAmount > 0) {
    await postLedgerEntry(tx, {
      accountCode: "GHARAMAH_ACCOUNT",
      direction: NoteLedgerDirection.CREDIT,
      amount: allocation.gharamahAmount,
      description: "Gharamah from separately collected late charges",
      idempotencyKey: `gateway-elc:gharamah:${gatewayPayment.id}`,
      gatewayPaymentId: gatewayPayment.id,
      noteId,
      settlementId: settlement.id,
    });
  }

  for (const row of investorAllocations) {
    if (row.tawidhInvestorShare <= 0) continue;
    await creditInvestorBalance(tx, {
      investorOrganizationId: row.investorOrganizationId,
      amount: row.tawidhInvestorShare,
      source: InvestorBalanceTransactionSource.NOTE_INVESTMENT_RELEASE,
      noteId,
      noteInvestmentId: row.investmentId,
      idempotencyKey: `investor-balance:elc:${gatewayPayment.id}:${row.investmentId}`,
      metadata: {
        releaseReason: "EXCESS_LATE_CHARGE_TAWIDH",
        settlementId: settlement.id,
        gatewayPaymentId: gatewayPayment.id,
        tawidhInvestorShare: row.tawidhInvestorShare,
      },
    });
  }

  const snapshot =
    settlement.preview_snapshot &&
    typeof settlement.preview_snapshot === "object" &&
    !Array.isArray(settlement.preview_snapshot)
      ? { ...(settlement.preview_snapshot as Record<string, unknown>) }
      : {};
  const priorPayments = Array.isArray(snapshot.excessLateChargePayments)
    ? snapshot.excessLateChargePayments
    : [];
  await tx.noteSettlement.update({
    where: { id: settlement.id },
    data: {
      preview_snapshot: {
        ...snapshot,
        excessLateChargePayments: [
          ...priorPayments,
          {
            gatewayPaymentId: gatewayPayment.id,
            amount: captured,
            ...allocation,
            investorAllocations,
          },
        ],
      } as Prisma.InputJsonValue,
    },
  });

  assertTransition(gatewayPayment.status, GatewayPaymentStatus.COMPLETED);
  await tx.gatewayPayment.update({
    where: { id: gatewayPayment.id },
    data: {
      status: GatewayPaymentStatus.COMPLETED,
      settlement_id: settlement.id,
    },
  });

  return {
    heldForOverCredit: false as const,
    settlementId: settlement.id,
    remainingOwed: resolveExcessLateChargeOutstanding(totals.owedAmount, nextPaid),
    fullyPaid: resolveExcessLateChargeOutstanding(totals.owedAmount, nextPaid) <= 0,
    dto: mapExcessLateChargesDto({
      status: "POSTED",
      excessLateChargeAmount: totals.owedAmount,
      excessLateChargePaidAmount: Math.min(nextPaid, totals.owedAmount),
      noteReference: "",
    }),
  };
}

export { resolveSettlementTotals };
