import {
  GatewayPayment,
  GatewayPaymentEventType,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  NameCheckResult,
  NoteLedgerDirection,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { debitInvestorBalanceForWithdrawal } from "../notes/investor-balance";
import { postLedgerEntry } from "../notes/ledger";
import { createCurlecClient } from "./curlec-client";
import { recordGatewayPaymentEvent } from "./gateway-events";
import { myrDecimalToSen } from "./money";
import { assertTransition, TERMINAL_GATEWAY_STATUSES } from "./state";

export type AutoRefundReason =
  | "NAME_MISMATCH"
  | "NAME_UNAVAILABLE"
  | "AMOUNT_MISMATCH"
  | "ADMIN_INITIATED";

const REFUND_ELIGIBLE_STATUSES: ReadonlySet<GatewayPaymentStatus> = new Set([
  GatewayPaymentStatus.PAID,
  GatewayPaymentStatus.HELD,
  GatewayPaymentStatus.NAME_CHECK_PENDING,
  GatewayPaymentStatus.COMPLETED,
]);

function refundReasonLabel(reason: AutoRefundReason): string {
  switch (reason) {
    case "NAME_MISMATCH":
      return "Investor deposit auto-refund: payer name mismatch";
    case "NAME_UNAVAILABLE":
      return "Investor deposit auto-refund: payer name unavailable";
    case "AMOUNT_MISMATCH":
      return "Investor deposit auto-refund: captured amount mismatch";
    case "ADMIN_INITIATED":
      return "Investor deposit admin-initiated refund";
  }
}

function nameCheckResultForReason(reason: AutoRefundReason): NameCheckResult | null {
  switch (reason) {
    case "NAME_MISMATCH":
      return NameCheckResult.FAIL;
    case "NAME_UNAVAILABLE":
      return NameCheckResult.NAME_UNAVAILABLE;
    default:
      return null;
  }
}

async function markRefundHeldFallback(
  tx: Prisma.TransactionClient,
  payment: GatewayPayment,
  input: {
    reason: AutoRefundReason;
    nameCheckResult?: NameCheckResult | null;
    errorMessage: string;
  }
) {
  if (payment.status === GatewayPaymentStatus.HELD) {
    return payment;
  }

  assertTransition(payment.status, GatewayPaymentStatus.HELD);

  const baseMetadata =
    payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata)
      ? payment.metadata
      : {};

  return tx.gatewayPayment.update({
    where: { id: payment.id },
    data: {
      status: GatewayPaymentStatus.HELD,
      name_check_result: input.nameCheckResult ?? payment.name_check_result,
      name_check_at: input.nameCheckResult ? new Date() : payment.name_check_at,
      metadata: {
        ...baseMetadata,
        autoRefundFailed: {
          reason: input.reason,
          error: input.errorMessage,
          at: new Date().toISOString(),
        },
      } as Prisma.InputJsonValue,
    },
  });
}

export async function initiateInvestorDepositRefund(
  payment: GatewayPayment,
  input: {
    reason: AutoRefundReason;
    curlecPaymentId: string;
    actorUserId?: string;
    adminReason?: string;
    nameCheckResult?: NameCheckResult | null;
    claimFromCreated?: boolean;
  },
  db: PrismaClient = defaultPrisma
): Promise<GatewayPaymentStatus> {
  if (payment.purpose !== GatewayPaymentPurpose.INVESTOR_DEPOSIT) {
    throw new AppError(
      422,
      "INVALID_GATEWAY_PAYMENT",
      "Refunds are only supported for investor deposits"
    );
  }

  if (!REFUND_ELIGIBLE_STATUSES.has(payment.status)) {
    if (
      payment.status === GatewayPaymentStatus.REFUND_INITIATED ||
      payment.status === GatewayPaymentStatus.REFUNDED
    ) {
      return payment.status;
    }
    throw new AppError(
      422,
      "INVALID_GATEWAY_STATUS",
      `Cannot refund gateway payment in status ${payment.status}`
    );
  }

  if (input.claimFromCreated && payment.status === GatewayPaymentStatus.CREATED) {
    const claimed = await db.gatewayPayment.updateMany({
      where: { id: payment.id, status: GatewayPaymentStatus.CREATED },
      data: { status: GatewayPaymentStatus.PAID },
    });
    if (claimed.count === 1) {
      payment = { ...payment, status: GatewayPaymentStatus.PAID };
    } else {
      const current = await db.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
      payment = current;
    }
  }

  if (
    payment.status === GatewayPaymentStatus.REFUND_INITIATED ||
    payment.status === GatewayPaymentStatus.REFUNDED
  ) {
    return payment.status;
  }

  if (!REFUND_ELIGIBLE_STATUSES.has(payment.status)) {
    throw new AppError(
      422,
      "INVALID_GATEWAY_STATUS",
      `Cannot refund gateway payment in status ${payment.status}`
    );
  }

  const curlecClient = createCurlecClient();
  const notes = input.adminReason?.trim() || refundReasonLabel(input.reason);
  const resolvedNameCheckResult =
    input.nameCheckResult !== undefined
      ? input.nameCheckResult
      : nameCheckResultForReason(input.reason);

  let refund;
  try {
    refund = await curlecClient.refundPayment(input.curlecPaymentId, {
      amountSen: myrDecimalToSen(payment.amount),
      idempotencyKey: payment.id,
      notes,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(
      {
        gatewayPaymentId: payment.id,
        curlecPaymentId: input.curlecPaymentId,
        reason: input.reason,
        error: errorMessage,
      },
      "Curlec auto-refund API call failed — deposit moved to HELD"
    );

    await db.$transaction(async (tx) => {
      const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
      if (
        current.status === GatewayPaymentStatus.REFUND_INITIATED ||
        current.status === GatewayPaymentStatus.REFUNDED
      ) {
        return;
      }
      await markRefundHeldFallback(tx, current, {
        reason: input.reason,
        nameCheckResult: resolvedNameCheckResult,
        errorMessage,
      });
    });

    return GatewayPaymentStatus.HELD;
  }

  await db.$transaction(async (tx) => {
    const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    if (
      current.status === GatewayPaymentStatus.REFUND_INITIATED ||
      current.status === GatewayPaymentStatus.REFUNDED
    ) {
      return;
    }

    assertTransition(current.status, GatewayPaymentStatus.REFUND_INITIATED);

    await tx.gatewayPayment.update({
      where: { id: payment.id },
      data: {
        status: GatewayPaymentStatus.REFUND_INITIATED,
        refund_reference: refund.id,
        refund_initiated_by: input.actorUserId ?? null,
        refund_notes: notes,
        name_check_result: resolvedNameCheckResult ?? current.name_check_result,
        name_check_at: resolvedNameCheckResult ? new Date() : current.name_check_at,
      },
    });

    await recordGatewayPaymentEvent(tx, {
      gatewayPaymentId: payment.id,
      type: GatewayPaymentEventType.REFUND_INITIATED,
      actorUserId: input.actorUserId,
      fromStatus: current.status,
      toStatus: GatewayPaymentStatus.REFUND_INITIATED,
      reason: notes,
      metadata: {
        auto: !input.actorUserId,
        refundId: refund.id,
        reason: input.reason,
      },
    });
  });

  return GatewayPaymentStatus.REFUND_INITIATED;
}

export async function completeInvestorDepositRefund(
  payment: GatewayPayment,
  input: { refundId?: string; actorUserId?: string },
  db: PrismaClient = defaultPrisma
): Promise<void> {
  if (payment.status === GatewayPaymentStatus.REFUNDED) {
    return;
  }

  if (payment.status !== GatewayPaymentStatus.REFUND_INITIATED) {
    return;
  }

  await db.$transaction(async (tx) => {
    const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    if (current.status === GatewayPaymentStatus.REFUNDED) {
      return;
    }
    if (current.status !== GatewayPaymentStatus.REFUND_INITIATED) {
      return;
    }

    assertTransition(current.status, GatewayPaymentStatus.REFUNDED);

    const hadPriorCredit = await tx.investorBalanceTransaction.findFirst({
      where: {
        investor_organization_id: current.investor_organization_id ?? undefined,
        source: "GATEWAY_DEPOSIT",
        idempotency_key: `gateway-deposit:balance:${current.id}`,
      },
    });

    if (hadPriorCredit && current.investor_organization_id) {
      const amount = current.amount.toNumber();
      await debitInvestorBalanceForWithdrawal(tx, {
        investorOrganizationId: current.investor_organization_id,
        amount,
        idempotencyKey: `gateway-deposit:refund:${current.id}`,
        metadata: {
          gatewayPaymentId: current.id,
          refundReference: input.refundId ?? current.refund_reference,
        },
      });

      await postLedgerEntry(tx, {
        accountCode: "INVESTOR_POOL",
        direction: NoteLedgerDirection.DEBIT,
        amount,
        description: "Investor gateway deposit refunded from investor pool",
        idempotencyKey: `gateway-deposit:refund-ledger:${current.id}`,
        gatewayPaymentId: current.id,
        metadata: {
          gatewayPaymentId: current.id,
          refundReference: input.refundId ?? current.refund_reference,
        },
      });
    }

    await tx.gatewayPayment.update({
      where: { id: payment.id },
      data: {
        status: GatewayPaymentStatus.REFUNDED,
        refunded_at: new Date(),
        refund_reference: input.refundId ?? current.refund_reference,
      },
    });

    await recordGatewayPaymentEvent(tx, {
      gatewayPaymentId: payment.id,
      type: GatewayPaymentEventType.REFUNDED,
      actorUserId: input.actorUserId,
      fromStatus: GatewayPaymentStatus.REFUND_INITIATED,
      toStatus: GatewayPaymentStatus.REFUNDED,
      metadata: input.refundId ? { refundId: input.refundId } : undefined,
    });
  });
}

export async function failInvestorDepositRefund(
  payment: GatewayPayment,
  input: { refundId?: string; errorMessage?: string },
  db: PrismaClient = defaultPrisma
): Promise<void> {
  if (TERMINAL_GATEWAY_STATUSES.has(payment.status) && payment.status !== GatewayPaymentStatus.REFUND_INITIATED) {
    return;
  }

  await db.$transaction(async (tx) => {
    const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    if (current.status !== GatewayPaymentStatus.REFUND_INITIATED) {
      return;
    }

    assertTransition(current.status, GatewayPaymentStatus.HELD);

    const baseMetadata =
      current.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata)
        ? current.metadata
        : {};

    await tx.gatewayPayment.update({
      where: { id: payment.id },
      data: {
        status: GatewayPaymentStatus.HELD,
        metadata: {
          ...baseMetadata,
          refundFailed: {
            refundId: input.refundId ?? null,
            error: input.errorMessage ?? "Curlec refund.failed webhook",
            at: new Date().toISOString(),
          },
        } as Prisma.InputJsonValue,
      },
    });
  });
}
