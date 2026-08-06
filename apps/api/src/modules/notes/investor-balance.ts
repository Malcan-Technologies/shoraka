import {
  InvestorBalanceTransactionDirection,
  InvestorBalanceTransactionSource,
  Prisma,
} from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(6));
}

function prismaDecimal(value: Prisma.Decimal | number | string): number {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isUniqueConstraintError(error: unknown, target: string): boolean {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") {
    return false;
  }
  const meta = "meta" in error && error.meta && typeof error.meta === "object" ? error.meta : null;
  const constraint = meta && "target" in meta ? meta.target : null;
  return Array.isArray(constraint) ? constraint.includes(target) : constraint === target;
}

export async function ensureInvestorBalanceRow(
  tx: Prisma.TransactionClient,
  investorOrganizationId: string
) {
  await tx.investorBalance.upsert({
    where: { investor_organization_id: investorOrganizationId },
    create: {
      investor_organization_id: investorOrganizationId,
      available_amount: money(0),
    },
    update: {},
  });
}

export async function debitInvestorBalanceForCommit(
  tx: Prisma.TransactionClient,
  input: {
    investorOrganizationId: string;
    amount: number;
    noteId: string;
    noteInvestmentId: string;
    idempotencyKey: string;
    postedAt?: Date;
  }
) {
  const existing = await tx.investorBalanceTransaction.findUnique({
    where: { idempotency_key: input.idempotencyKey },
  });
  if (existing) return existing;

  const amountDecimal = money(input.amount);
  await ensureInvestorBalanceRow(tx, input.investorOrganizationId);

  const updated = await tx.investorBalance.updateMany({
    where: {
      investor_organization_id: input.investorOrganizationId,
      available_amount: { gte: amountDecimal },
    },
    data: { available_amount: { decrement: amountDecimal } },
  });

  if (updated.count !== 1) {
    const row = await tx.investorBalance.findUnique({
      where: { investor_organization_id: input.investorOrganizationId },
      select: { available_amount: true },
    });
    const available = row ? prismaDecimal(row.available_amount) : 0;
    throw new AppError(
      422,
      "INSUFFICIENT_INVESTOR_BALANCE",
      `Insufficient available balance (available ${available.toFixed(2)}, required ${input.amount.toFixed(2)})`
    );
  }

  try {
    return await tx.investorBalanceTransaction.create({
      data: {
        investor_organization_id: input.investorOrganizationId,
        direction: InvestorBalanceTransactionDirection.OUT,
        amount: amountDecimal,
        source: InvestorBalanceTransactionSource.NOTE_INVESTMENT_COMMIT,
        note_id: input.noteId,
        note_investment_id: input.noteInvestmentId,
        idempotency_key: input.idempotencyKey,
        posted_at: input.postedAt ?? new Date(),
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error, "investor_balance_transactions_idempotency_key_key")) {
      const duplicate = await tx.investorBalanceTransaction.findUnique({
        where: { idempotency_key: input.idempotencyKey },
      });
      if (duplicate) return duplicate;
    }
    throw error;
  }
}

export async function debitInvestorBalanceForWithdrawal(
  tx: Prisma.TransactionClient,
  input: {
    investorOrganizationId: string;
    amount: number;
    idempotencyKey: string;
    metadata?: Prisma.InputJsonValue | null;
    postedAt?: Date;
  }
) {
  return debitInvestorBalanceOut(tx, {
    ...input,
    source: InvestorBalanceTransactionSource.INVESTOR_WITHDRAWAL_REQUEST,
  });
}

/**
 * Permanent wallet reversal for a confirmed Curlec refund of a gateway deposit.
 * Idempotent via idempotencyKey (typically gateway-deposit:refund:<paymentId>).
 */
export async function debitInvestorBalanceForGatewayRefund(
  tx: Prisma.TransactionClient,
  input: {
    investorOrganizationId: string;
    amount: number;
    idempotencyKey: string;
    metadata?: Prisma.InputJsonValue | null;
    postedAt?: Date;
  }
) {
  return debitInvestorBalanceOut(tx, {
    ...input,
    source: InvestorBalanceTransactionSource.GATEWAY_DEPOSIT_REFUND,
  });
}

/**
 * Immediately remove up to `maxAmount` from available balance while a full refund
 * reversal cannot complete (e.g. funds already partly spent). Idempotent for the
 * same key; use a new key for top-ups when more cash becomes available.
 * Returns how much was blocked (0 if nothing available).
 */
export async function blockInvestorBalanceForGatewayRefundHold(
  tx: Prisma.TransactionClient,
  input: {
    investorOrganizationId: string;
    maxAmount: number;
    idempotencyKey: string;
    metadata?: Prisma.InputJsonValue | null;
    postedAt?: Date;
  }
): Promise<{ blockedAmount: number; availableBefore: number }> {
  const existing = await tx.investorBalanceTransaction.findUnique({
    where: { idempotency_key: input.idempotencyKey },
  });
  if (existing) {
    return {
      blockedAmount: prismaDecimal(existing.amount),
      availableBefore: prismaDecimal(existing.amount),
    };
  }

  await ensureInvestorBalanceRow(tx, input.investorOrganizationId);
  const row = await tx.investorBalance.findUnique({
    where: { investor_organization_id: input.investorOrganizationId },
    select: { available_amount: true },
  });
  const availableBefore = row ? prismaDecimal(row.available_amount) : 0;
  const blockedAmount = Math.min(availableBefore, input.maxAmount);
  if (blockedAmount <= 0) {
    return { blockedAmount: 0, availableBefore };
  }

  await debitInvestorBalanceOut(tx, {
    investorOrganizationId: input.investorOrganizationId,
    amount: blockedAmount,
    idempotencyKey: input.idempotencyKey,
    source: InvestorBalanceTransactionSource.GATEWAY_DEPOSIT_REFUND_HOLD,
    metadata: input.metadata ?? undefined,
    postedAt: input.postedAt,
  });

  return { blockedAmount, availableBefore };
}

/**
 * Credit back a temporary GATEWAY_DEPOSIT_REFUND_HOLD so a permanent refund debit
 * can replace it in the same transaction. Idempotent via releaseIdempotencyKey.
 */
export async function releaseInvestorBalanceGatewayRefundHold(
  tx: Prisma.TransactionClient,
  input: {
    investorOrganizationId: string;
    holdIdempotencyKey: string;
    releaseIdempotencyKey: string;
    metadata?: Prisma.InputJsonValue | null;
    postedAt?: Date;
  }
) {
  const hold = await tx.investorBalanceTransaction.findUnique({
    where: { idempotency_key: input.holdIdempotencyKey },
  });
  if (!hold) return null;
  if (hold.direction !== InvestorBalanceTransactionDirection.OUT) return hold;

  return creditInvestorBalance(tx, {
    investorOrganizationId: input.investorOrganizationId,
    amount: prismaDecimal(hold.amount),
    source: InvestorBalanceTransactionSource.GATEWAY_DEPOSIT_REFUND_HOLD,
    idempotencyKey: input.releaseIdempotencyKey,
    metadata: input.metadata ?? { releasedHoldKey: input.holdIdempotencyKey },
    postedAt: input.postedAt,
  });
}

async function debitInvestorBalanceOut(
  tx: Prisma.TransactionClient,
  input: {
    investorOrganizationId: string;
    amount: number;
    idempotencyKey: string;
    source: InvestorBalanceTransactionSource;
    metadata?: Prisma.InputJsonValue | null;
    postedAt?: Date;
    noteId?: string;
    noteInvestmentId?: string;
  }
) {
  const existing = await tx.investorBalanceTransaction.findUnique({
    where: { idempotency_key: input.idempotencyKey },
  });
  if (existing) return existing;

  const amountDecimal = money(input.amount);
  await ensureInvestorBalanceRow(tx, input.investorOrganizationId);

  const updated = await tx.investorBalance.updateMany({
    where: {
      investor_organization_id: input.investorOrganizationId,
      available_amount: { gte: amountDecimal },
    },
    data: { available_amount: { decrement: amountDecimal } },
  });

  if (updated.count !== 1) {
    const row = await tx.investorBalance.findUnique({
      where: { investor_organization_id: input.investorOrganizationId },
      select: { available_amount: true },
    });
    const available = row ? prismaDecimal(row.available_amount) : 0;
    throw new AppError(
      422,
      "INSUFFICIENT_INVESTOR_BALANCE",
      `Insufficient available balance (available ${available.toFixed(2)}, required ${input.amount.toFixed(2)})`
    );
  }

  try {
    return await tx.investorBalanceTransaction.create({
      data: {
        investor_organization_id: input.investorOrganizationId,
        direction: InvestorBalanceTransactionDirection.OUT,
        amount: amountDecimal,
        source: input.source,
        note_id: input.noteId,
        note_investment_id: input.noteInvestmentId,
        idempotency_key: input.idempotencyKey,
        metadata: input.metadata ?? undefined,
        posted_at: input.postedAt ?? new Date(),
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error, "investor_balance_transactions_idempotency_key_key")) {
      const duplicate = await tx.investorBalanceTransaction.findUnique({
        where: { idempotency_key: input.idempotencyKey },
      });
      if (duplicate) return duplicate;
    }
    throw error;
  }
}

export async function creditInvestorBalance(
  tx: Prisma.TransactionClient,
  input: {
    investorOrganizationId: string;
    amount: number;
    source: InvestorBalanceTransactionSource;
    noteId?: string | null;
    noteInvestmentId?: string | null;
    metadata?: Prisma.InputJsonValue | null;
    idempotencyKey: string;
    postedAt?: Date;
  }
) {
  const existing = await tx.investorBalanceTransaction.findUnique({
    where: { idempotency_key: input.idempotencyKey },
  });
  if (existing) return existing;

  const amountDecimal = money(input.amount);
  await ensureInvestorBalanceRow(tx, input.investorOrganizationId);

  await tx.investorBalance.update({
    where: { investor_organization_id: input.investorOrganizationId },
    data: { available_amount: { increment: amountDecimal } },
  });

  try {
    return await tx.investorBalanceTransaction.create({
      data: {
        investor_organization_id: input.investorOrganizationId,
        direction: InvestorBalanceTransactionDirection.IN,
        amount: amountDecimal,
        source: input.source,
        note_id: input.noteId ?? undefined,
        note_investment_id: input.noteInvestmentId ?? undefined,
        idempotency_key: input.idempotencyKey,
        metadata: input.metadata ?? undefined,
        posted_at: input.postedAt ?? new Date(),
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error, "investor_balance_transactions_idempotency_key_key")) {
      const duplicate = await tx.investorBalanceTransaction.findUnique({
        where: { idempotency_key: input.idempotencyKey },
      });
      if (duplicate) return duplicate;
    }
    throw error;
  }
}
