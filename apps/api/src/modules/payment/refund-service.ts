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
import { getCurlecConfig } from "../../config/curlec";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { debitInvestorBalanceForWithdrawal } from "../notes/investor-balance";
import { postLedgerEntry } from "../notes/ledger";
import { createCurlecClient } from "./curlec-client";
import { recordGatewayPaymentEvent } from "./gateway-events";
import { myrDecimalToSen, senToMyrDecimal } from "./money";
import { markGatewayPaymentReceiptRefunded } from "./receipt/receipt-service";
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
      return "Auto refund: bank payer name does not match the investor profile.";
    case "NAME_UNAVAILABLE":
      return "Auto refund: bank did not return a payer name.";
    case "AMOUNT_MISMATCH":
      return "Auto refund: paid amount does not match the expected amount.";
    case "ADMIN_INITIATED":
      return "Admin started this refund.";
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

export type InitiateGatewayRefundInput = {
  reason: AutoRefundReason;
  curlecPaymentId: string;
  actorUserId?: string;
  adminReason?: string;
  nameCheckResult?: NameCheckResult | null;
  claimFromCreated?: boolean;
  /** Integer sen to refund. For amount mismatch must be the captured amount. */
  amountSen?: number;
};

/**
 * Request a Curlec refund for any gateway payment purpose.
 * Idempotent via Curlec idempotency key = gateway payment id.
 * On API failure → HELD (Needs attention). On success → REFUND_INITIATED (Refund pending).
 */
export async function initiateGatewayPaymentRefund(
  payment: GatewayPayment,
  input: InitiateGatewayRefundInput,
  db: PrismaClient = defaultPrisma
): Promise<GatewayPaymentStatus> {
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

  const refundAmountSen =
    input.amountSen !== undefined ? input.amountSen : myrDecimalToSen(payment.amount);

  if (!Number.isInteger(refundAmountSen) || refundAmountSen <= 0) {
    throw new AppError(
      422,
      "INVALID_REFUND_AMOUNT",
      "Refund amount must be a positive integer sen value"
    );
  }

  try {
    getCurlecConfig(payment.gatewayAccount);
  } catch {
    throw new AppError(
      500,
      "CURLEC_ACCOUNT_CONFIG_ERROR",
      `Curlec credentials are not configured for gateway account ${payment.gatewayAccount}`
    );
  }

  const curlecClient = createCurlecClient({ gatewayAccount: payment.gatewayAccount });
  const notes = input.adminReason?.trim() || refundReasonLabel(input.reason);
  const resolvedNameCheckResult =
    payment.purpose === GatewayPaymentPurpose.INVESTOR_DEPOSIT
      ? input.nameCheckResult !== undefined
        ? input.nameCheckResult
        : nameCheckResultForReason(input.reason)
      : null;

  let refund;
  try {
    refund = await curlecClient.refundPayment(input.curlecPaymentId, {
      amountSen: refundAmountSen,
      idempotencyKey: payment.id,
      notes,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(
      {
        gatewayPaymentId: payment.id,
        gatewayAccount: payment.gatewayAccount,
        purpose: payment.purpose,
        curlecPaymentId: input.curlecPaymentId,
        reason: input.reason,
        refundAmountSen,
        error: errorMessage,
      },
      "Curlec refund API call failed — payment moved to HELD"
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

    const baseMetadata =
      current.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata)
        ? (current.metadata as Record<string, unknown>)
        : {};

    await tx.gatewayPayment.update({
      where: { id: payment.id },
      data: {
        status: GatewayPaymentStatus.REFUND_INITIATED,
        refund_reference: refund.id,
        refund_initiated_by: input.actorUserId ?? null,
        refund_notes: notes,
        name_check_result: resolvedNameCheckResult ?? current.name_check_result,
        name_check_at: resolvedNameCheckResult ? new Date() : current.name_check_at,
        metadata: {
          ...baseMetadata,
          refundAttempt: {
            amountSen: refundAmountSen,
            currency: current.currency,
            reason: input.reason,
            auto: !input.actorUserId,
            curlecRefundId: refund.id,
            requestedAt: new Date().toISOString(),
            source: input.actorUserId ? "admin_retry" : "automatic",
          },
        } as Prisma.InputJsonValue,
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
        gatewayAccount: payment.gatewayAccount,
        purpose: payment.purpose,
        amountSen: refundAmountSen,
        source: input.actorUserId ? "admin_retry" : "automatic",
      },
    });
  });

  return GatewayPaymentStatus.REFUND_INITIATED;
}

/** @deprecated Prefer initiateGatewayPaymentRefund — kept for deposit call sites. */
export async function initiateInvestorDepositRefund(
  payment: GatewayPayment,
  input: InitiateGatewayRefundInput,
  db: PrismaClient = defaultPrisma
): Promise<GatewayPaymentStatus> {
  if (payment.purpose !== GatewayPaymentPurpose.INVESTOR_DEPOSIT) {
    throw new AppError(
      422,
      "INVALID_GATEWAY_PAYMENT",
      "initiateInvestorDepositRefund only supports investor deposits"
    );
  }
  return initiateGatewayPaymentRefund(payment, input, db);
}

/**
 * Curlec has already confirmed the refund. Local wallet debit failed (usually
 * insufficient available balance). Do not leave the row in REFUND_INITIATED —
 * move to HELD with recovery metadata so admin can retry wallet reversal only.
 */
async function holdForWalletReversalFailure(
  db: PrismaClient,
  paymentId: string,
  input: {
    refundId?: string;
    actorUserId?: string;
    errorMessage: string;
    errorCode?: string;
    gatewayAccount: GatewayPayment["gatewayAccount"];
  }
): Promise<void> {
  await db.$transaction(async (tx) => {
    const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: paymentId } });
    if (current.status !== GatewayPaymentStatus.REFUND_INITIATED) {
      return;
    }

    assertTransition(current.status, GatewayPaymentStatus.HELD);

    const baseMetadata =
      current.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata)
        ? current.metadata
        : {};

    await tx.gatewayPayment.update({
      where: { id: paymentId },
      data: {
        status: GatewayPaymentStatus.HELD,
        refund_reference: input.refundId ?? current.refund_reference,
        metadata: {
          ...baseMetadata,
          refundConfirmedWalletReversalFailed: {
            refundId: input.refundId ?? current.refund_reference ?? null,
            error: input.errorMessage,
            errorCode: input.errorCode ?? null,
            gatewayAccount: input.gatewayAccount,
            at: new Date().toISOString(),
          },
        } as Prisma.InputJsonValue,
      },
    });

    await recordGatewayPaymentEvent(tx, {
      gatewayPaymentId: paymentId,
      type: GatewayPaymentEventType.REFUND_WALLET_REVERSAL_FAILED,
      actorUserId: input.actorUserId,
      fromStatus: GatewayPaymentStatus.REFUND_INITIATED,
      toStatus: GatewayPaymentStatus.HELD,
      reason: input.errorMessage,
      metadata: {
        refundId: input.refundId ?? current.refund_reference,
        gatewayAccount: input.gatewayAccount,
        errorCode: input.errorCode ?? null,
      },
    });
  });
}

export async function completeGatewayPaymentRefund(
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

  try {
    await db.$transaction(async (tx) => {
      const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
      if (current.status === GatewayPaymentStatus.REFUNDED) {
        return;
      }
      if (current.status !== GatewayPaymentStatus.REFUND_INITIATED) {
        return;
      }

      assertTransition(current.status, GatewayPaymentStatus.REFUNDED);

      if (
        current.purpose === GatewayPaymentPurpose.INVESTOR_DEPOSIT &&
        current.investor_organization_id
      ) {
        const hadPriorCredit = await tx.investorBalanceTransaction.findFirst({
          where: {
            investor_organization_id: current.investor_organization_id,
            source: "GATEWAY_DEPOSIT",
            idempotency_key: `gateway-deposit:balance:${current.id}`,
          },
        });

        if (hadPriorCredit) {
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
        metadata: {
          refundId: input.refundId ?? current.refund_reference,
          purpose: current.purpose,
        },
      });
    });

    const metadata =
      payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata)
        ? (payment.metadata as Record<string, unknown>)
        : {};
    const attempt = metadata.refundAttempt as { amountSen?: number } | undefined;
    const refundAmount =
      typeof attempt?.amountSen === "number"
        ? senToMyrDecimal(attempt.amountSen)
        : payment.amount;

    await markGatewayPaymentReceiptRefunded(
      payment.id,
      {
        refundReference: input.refundId ?? payment.refund_reference,
        refundAmount,
        refundedAt: new Date(),
      },
      db
    );
  } catch (error) {
    // Wallet reversal only applies to investor deposits that were credited.
    if (payment.purpose !== GatewayPaymentPurpose.INVESTOR_DEPOSIT) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode =
      error instanceof AppError
        ? error.code
        : error && typeof error === "object" && "code" in error
          ? String((error as { code: unknown }).code)
          : undefined;

    logger.error(
      {
        gatewayPaymentId: payment.id,
        gatewayAccount: payment.gatewayAccount,
        refundId: input.refundId,
        error: errorMessage,
        errorCode,
      },
      "Investor deposit refund confirmed remotely but wallet reversal failed — moved to HELD"
    );

    await holdForWalletReversalFailure(db, payment.id, {
      refundId: input.refundId,
      actorUserId: input.actorUserId,
      errorMessage,
      errorCode,
      gatewayAccount: payment.gatewayAccount,
    });
  }
}

/** @deprecated Prefer completeGatewayPaymentRefund */
export async function completeInvestorDepositRefund(
  payment: GatewayPayment,
  input: { refundId?: string; actorUserId?: string },
  db: PrismaClient = defaultPrisma
): Promise<void> {
  return completeGatewayPaymentRefund(payment, input, db);
}

/**
 * Admin recovery when Curlec refund already succeeded but wallet debit failed.
 * Never calls Curlec again. Idempotent via gateway-deposit:refund:<id>.
 */
export async function retryWalletReversalForConfirmedRefund(
  payment: GatewayPayment,
  input: { actorUserId?: string },
  db: PrismaClient = defaultPrisma
): Promise<GatewayPaymentStatus> {
  if (payment.status === GatewayPaymentStatus.REFUNDED) {
    return GatewayPaymentStatus.REFUNDED;
  }

  if (payment.status !== GatewayPaymentStatus.HELD) {
    throw new AppError(
      422,
      "INVALID_GATEWAY_STATUS",
      `Cannot retry wallet reversal for gateway payment in status ${payment.status}`
    );
  }

  const metadata =
    payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata)
      ? (payment.metadata as Record<string, unknown>)
      : {};
  const reversalFailure = metadata.refundConfirmedWalletReversalFailed as
    | { refundId?: string | null }
    | undefined;

  if (!reversalFailure) {
    throw new AppError(
      422,
      "GATEWAY_PAYMENT_INVALID",
      "Held payment is not marked as confirmed-refund wallet reversal failure"
    );
  }

  const refundId = reversalFailure.refundId ?? payment.refund_reference ?? undefined;

  await db.$transaction(async (tx) => {
    const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    if (current.status !== GatewayPaymentStatus.HELD) {
      return;
    }
    assertTransition(current.status, GatewayPaymentStatus.REFUND_INITIATED);
    await tx.gatewayPayment.update({
      where: { id: payment.id },
      data: { status: GatewayPaymentStatus.REFUND_INITIATED },
    });
  });

  const refreshed = await db.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
  await completeGatewayPaymentRefund(refreshed, { refundId, actorUserId: input.actorUserId }, db);

  const final = await db.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
  return final.status;
}

export async function failGatewayPaymentRefund(
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

/** @deprecated Prefer failGatewayPaymentRefund */
export async function failInvestorDepositRefund(
  payment: GatewayPayment,
  input: { refundId?: string; errorMessage?: string },
  db: PrismaClient = defaultPrisma
): Promise<void> {
  return failGatewayPaymentRefund(payment, input, db);
}

function normalizeCurlecRefundStatus(
  status: string | undefined | null
): "processed" | "failed" | "pending" {
  const value = (status ?? "").toLowerCase();
  if (value === "processed") return "processed";
  if (value === "failed") return "failed";
  return "pending";
}

/**
 * Attach a Curlec refund id from refund.created (or recovery).
 * Keeps Curlec as source of truth — does not invent timeouts.
 *
 * HELD → REFUND_INITIATED only for an allowlisted recoverable hold:
 * local Curlec refund-create API failure (`metadata.autoRefundFailed`), where the
 * remote refund may still have been created. Currency mismatch and wallet-reversal
 * failure holds must stay HELD.
 */
export async function adoptGatewayRefundCreated(
  payment: GatewayPayment,
  input: { refundId: string },
  db: PrismaClient = defaultPrisma
): Promise<GatewayPaymentStatus> {
  if (payment.status === GatewayPaymentStatus.REFUNDED) {
    return GatewayPaymentStatus.REFUNDED;
  }

  if (payment.status === GatewayPaymentStatus.REFUND_INITIATED) {
    if (!payment.refund_reference) {
      await db.gatewayPayment.update({
        where: { id: payment.id },
        data: { refund_reference: input.refundId },
      });
    }
    // Never overwrite an existing different refund reference.
    return GatewayPaymentStatus.REFUND_INITIATED;
  }

  if (payment.status !== GatewayPaymentStatus.HELD) {
    return payment.status;
  }

  const metadata = asMetadataObject(payment.metadata);

  if (!isRecoverableRefundCreationHold(metadata)) {
    logger.info(
      {
        gatewayPaymentId: payment.id,
        purpose: payment.purpose,
        refundId: input.refundId,
        holdKind: describeHeldKind(metadata),
      },
      "refund.created ignored for non-recoverable HELD payment — status unchanged"
    );
    return GatewayPaymentStatus.HELD;
  }

  await db.$transaction(async (tx) => {
    const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    if (current.status !== GatewayPaymentStatus.HELD) {
      return;
    }

    const currentMeta = asMetadataObject(current.metadata);
    if (!isRecoverableRefundCreationHold(currentMeta)) {
      return;
    }

    // Do not overwrite a different existing refund reference.
    if (current.refund_reference && current.refund_reference !== input.refundId) {
      logger.warn(
        {
          gatewayPaymentId: current.id,
          existingRefundReference: current.refund_reference,
          incomingRefundId: input.refundId,
        },
        "refund.created ignored — existing refund_reference differs"
      );
      return;
    }

    assertTransition(current.status, GatewayPaymentStatus.REFUND_INITIATED);
    await tx.gatewayPayment.update({
      where: { id: payment.id },
      data: {
        status: GatewayPaymentStatus.REFUND_INITIATED,
        refund_reference: current.refund_reference ?? input.refundId,
      },
    });
    await recordGatewayPaymentEvent(tx, {
      gatewayPaymentId: payment.id,
      type: GatewayPaymentEventType.REFUND_INITIATED,
      fromStatus: GatewayPaymentStatus.HELD,
      toStatus: GatewayPaymentStatus.REFUND_INITIATED,
      reason: "Curlec refund.created recovered pending refund",
      metadata: {
        refundId: input.refundId,
        purpose: current.purpose,
        source: "refund_created_webhook",
        recoverableHold: "autoRefundFailed",
      },
    });
  });

  const refreshed = await db.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
  return refreshed.status;
}

function asMetadataObject(metadata: GatewayPayment["metadata"]): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

/**
 * Explicit allowlist: only holds caused by a failed/uncertain local refund-create call.
 * Do not infer from free-text error messages.
 */
export function isRecoverableRefundCreationHold(metadata: Record<string, unknown>): boolean {
  if ("refundConfirmedWalletReversalFailed" in metadata) {
    return false;
  }

  const captureMismatch = metadata.captureMismatch as { mismatchType?: string } | undefined;
  if (captureMismatch?.mismatchType === "CURRENCY_MISMATCH") {
    return false;
  }

  // Structured marker written by markRefundHeldFallback when Curlec refund API throws.
  return "autoRefundFailed" in metadata;
}

function describeHeldKind(metadata: Record<string, unknown>): string {
  if ("refundConfirmedWalletReversalFailed" in metadata) {
    return "wallet_reversal_failed";
  }
  const captureMismatch = metadata.captureMismatch as { mismatchType?: string } | undefined;
  if (captureMismatch?.mismatchType === "CURRENCY_MISMATCH") {
    return "currency_mismatch";
  }
  if ("autoRefundFailed" in metadata) {
    return "auto_refund_failed";
  }
  if ("refundFailed" in metadata) {
    return "refund_failed_webhook";
  }
  if (captureMismatch?.mismatchType) {
    return `capture_mismatch:${captureMismatch.mismatchType}`;
  }
  return "unknown_held";
}

/**
 * Reconcile REFUND_INITIATED rows against Curlec refund status.
 * Curlec pending → stay pending. No duration-based failure.
 */
export async function reconcilePendingGatewayRefunds(
  db: PrismaClient = defaultPrisma,
  limit = 50
): Promise<{
  scanned: number;
  refunded: number;
  held: number;
  pending: number;
  errors: Array<{ id: string; error: string }>;
}> {
  const pendingRows = await db.gatewayPayment.findMany({
    where: { status: GatewayPaymentStatus.REFUND_INITIATED },
    orderBy: { updated_at: "asc" },
    take: limit,
  });

  let refunded = 0;
  let held = 0;
  let stillPending = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const payment of pendingRows) {
    try {
      const curlecClient = createCurlecClient({ gatewayAccount: payment.gatewayAccount });
      let refundId = payment.refund_reference;

      if (!refundId && payment.curlec_payment_id) {
        const remoteRefunds = await curlecClient.fetchPaymentRefunds(payment.curlec_payment_id);
        const match = remoteRefunds[0] ?? null;
        if (match) {
          refundId = match.id;
          await db.gatewayPayment.update({
            where: { id: payment.id },
            data: { refund_reference: match.id },
          });
        }
      }

      if (!refundId) {
        stillPending += 1;
        continue;
      }

      const remote = await curlecClient.fetchRefund(refundId);
      const remoteStatus = normalizeCurlecRefundStatus(remote.status);

      if (remoteStatus === "processed") {
        await completeGatewayPaymentRefund(payment, { refundId }, db);
        refunded += 1;
        continue;
      }

      if (remoteStatus === "failed") {
        await failGatewayPaymentRefund(
          payment,
          { refundId, errorMessage: "Curlec refund status is failed" },
          db
        );
        held += 1;
        continue;
      }

      stillPending += 1;
    } catch (error) {
      errors.push({
        id: payment.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    scanned: pendingRows.length,
    refunded,
    held,
    pending: stillPending,
    errors,
  };
}
