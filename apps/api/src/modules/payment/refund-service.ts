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
import type { AuditRequestContext } from "../../lib/audit";
import { logger } from "../../lib/logger";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { debitInvestorBalanceForGatewayRefund, blockInvestorBalanceForGatewayRefundHold, releaseInvestorBalanceGatewayRefundHold } from "../notes/investor-balance";
import { postLedgerEntry } from "../notes/ledger";
import { createCurlecClient } from "./curlec-client";
import { recordGatewayPaymentEvent } from "./gateway-events";
import { myrDecimalToSen, senToMyrDecimal } from "./money";
import { markGatewayPaymentReceiptRefunded } from "./receipt/receipt-service";
import {
  notifyDepositRefundInitiated,
  notifyDepositRefunded,
} from "../notification/gateway-payment-notifications";
import { assertTransition } from "./state";
import {
  clearIssuerOnboardingFeePaidAt,
  restoreIssuerOnboardingFeePaidAt,
} from "./onboarding-fee-service";

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
  context?: AuditRequestContext | null;
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

    if (
      current.purpose === GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE &&
      current.issuer_organization_id
    ) {
      await clearIssuerOnboardingFeePaidAt(tx, current.issuer_organization_id);
    }

    await recordGatewayPaymentEvent(tx, {
      gatewayPaymentId: payment.id,
      type: GatewayPaymentEventType.REFUND_INITIATED,
      actorUserId: input.actorUserId,
      context: input.context,
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

  await notifyDepositRefundInitiated(payment);

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
 * insufficient available balance). Immediately block whatever is still available,
 * move to HELD with recovery metadata, and leave the row for automatic/admin retry.
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
    context?: AuditRequestContext | null;
  }
): Promise<void> {
  await db.$transaction(async (tx) => {
    const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: paymentId } });
    if (current.status === GatewayPaymentStatus.REFUNDED) {
      return;
    }
    if (
      current.status !== GatewayPaymentStatus.REFUND_INITIATED &&
      current.status !== GatewayPaymentStatus.HELD
    ) {
      return;
    }

    const existingRefundDebit = await tx.investorBalanceTransaction.findUnique({
      where: { idempotency_key: refundWalletDebitKey(current.id) },
    });
    if (existingRefundDebit) {
      // Lost-response recovery: permanent debit already exists — finish as REFUNDED.
      assertTransition(current.status, GatewayPaymentStatus.REFUNDED);
      const baseMetadata = asMetadataObject(current.metadata);
      const { refundConfirmedWalletReversalFailed: _drop, ...rest } = baseMetadata;
      await tx.gatewayPayment.update({
        where: { id: paymentId },
        data: {
          status: GatewayPaymentStatus.REFUNDED,
          refunded_at: new Date(),
          refund_reference: input.refundId ?? current.refund_reference,
          metadata: rest as Prisma.InputJsonValue,
        },
      });
      await recordGatewayPaymentEvent(tx, {
        gatewayPaymentId: paymentId,
        type: GatewayPaymentEventType.REFUNDED,
        actorUserId: input.actorUserId,
        context: input.context,
        fromStatus: current.status,
        toStatus: GatewayPaymentStatus.REFUNDED,
        reason: "Wallet reversal already present — completed after prior failure path",
        metadata: {
          refundId: input.refundId ?? current.refund_reference,
          purpose: current.purpose,
        },
      });
      return;
    }

    if (current.status === GatewayPaymentStatus.REFUND_INITIATED) {
      assertTransition(current.status, GatewayPaymentStatus.HELD);
    }

    const baseMetadata = asMetadataObject(current.metadata);
    const prior = readWalletReversalFailureMarker(baseMetadata);
    const external = readExternalCurlecRefundMarker(baseMetadata);
    const intendedAmount = current.amount.toNumber();
    const credit = current.investor_organization_id
      ? await tx.investorBalanceTransaction.findFirst({
          where: {
            investor_organization_id: current.investor_organization_id,
            source: "GATEWAY_DEPOSIT",
            idempotency_key: `gateway-deposit:balance:${current.id}`,
          },
        })
      : null;

    const priorKeys = uniqueStrings([
      ...(prior?.holdIdempotencyKeys ?? []),
      ...(external?.holdIdempotencyKeys ?? []),
    ]);
    const blockedSoFar = await sumHoldAmounts(tx, priorKeys);
    const shortfall = Math.max(0, intendedAmount - blockedSoFar);
    const holdKeys = [...priorKeys];
    let newlyBlocked = 0;

    if (
      shortfall > 0 &&
      current.investor_organization_id &&
      current.purpose === GatewayPaymentPurpose.INVESTOR_DEPOSIT
    ) {
      const holdKey =
        holdKeys.length === 0
          ? refundWalletHoldKey(current.id)
          : refundWalletHoldKey(current.id, holdKeys.length + 1);
      const blockResult = await blockInvestorBalanceForGatewayRefundHold(tx, {
        investorOrganizationId: current.investor_organization_id,
        maxAmount: shortfall,
        idempotencyKey: holdKey,
        metadata: {
          gatewayPaymentId: current.id,
          refundReference: input.refundId ?? current.refund_reference,
          kind: "gateway_deposit_refund_hold",
        },
      });
      newlyBlocked = blockResult.blockedAmount;
      if (newlyBlocked > 0 && !holdKeys.includes(holdKey)) {
        holdKeys.push(holdKey);
      }
      if (newlyBlocked > 0) {
        await recordGatewayPaymentEvent(tx, {
          gatewayPaymentId: paymentId,
          type: GatewayPaymentEventType.REFUND_WALLET_REVERSAL_FAILED,
          actorUserId: input.actorUserId,
          context: input.context,
          fromStatus: current.status,
          toStatus:
            current.status === GatewayPaymentStatus.REFUND_INITIATED
              ? GatewayPaymentStatus.HELD
              : current.status,
          reason: "Wallet funds blocked pending refund reversal retry",
          metadata: {
            event: "wallet_funds_blocked",
            blockedAmount: newlyBlocked,
            holdIdempotencyKey: holdKey,
            refundId: input.refundId ?? current.refund_reference,
          },
        });
      }
    }

    const totalBlocked = blockedSoFar + newlyBlocked;
    const failureCategory = failureCategoryFromCode(input.errorCode);
    const marker: WalletReversalFailureMarker = {
      refundId: input.refundId ?? current.refund_reference ?? null,
      gatewayPaymentId: current.id,
      originalWalletCreditId: credit?.id ?? prior?.originalWalletCreditId ?? null,
      originalWalletCreditKey: `gateway-deposit:balance:${current.id}`,
      intendedReversalAmount: intendedAmount,
      currency: current.currency,
      failureCode: input.errorCode ?? null,
      failureCategory,
      lastAttemptAt: new Date().toISOString(),
      attemptCount: (prior?.attemptCount ?? 0) + 1,
      fundsBlocked: totalBlocked > 0,
      fundsProtected: totalBlocked + 1e-9 >= intendedAmount,
      blockedAmount: totalBlocked,
      holdIdempotencyKeys: holdKeys,
      gatewayAccount: input.gatewayAccount,
      error: sanitizeFailureMessage(input.errorMessage),
    };

    await tx.gatewayPayment.update({
      where: { id: paymentId },
      data: {
        status: GatewayPaymentStatus.HELD,
        refund_reference: input.refundId ?? current.refund_reference,
        metadata: {
          ...baseMetadata,
          refundConfirmedWalletReversalFailed: marker,
        } as Prisma.InputJsonValue,
      },
    });

    await recordGatewayPaymentEvent(tx, {
      gatewayPaymentId: paymentId,
      type: GatewayPaymentEventType.REFUND_WALLET_REVERSAL_FAILED,
      actorUserId: input.actorUserId,
      context: input.context,
      fromStatus: current.status,
      toStatus: GatewayPaymentStatus.HELD,
      reason: marker.error,
      metadata: {
        event: "wallet_reversal_failed",
        refundId: marker.refundId,
        gatewayAccount: input.gatewayAccount,
        failureCode: marker.failureCode,
        failureCategory: marker.failureCategory,
        blockedAmount: marker.blockedAmount,
        fundsProtected: marker.fundsProtected,
        attemptCount: marker.attemptCount,
      },
    });
  });
}

function refundWalletDebitKey(paymentId: string) {
  return `gateway-deposit:refund:${paymentId}`;
}

function refundWalletHoldKey(paymentId: string, index?: number) {
  return index && index > 1
    ? `gateway-deposit:refund-hold:${paymentId}:${index}`
    : `gateway-deposit:refund-hold:${paymentId}`;
}

function refundWalletHoldReleaseKey(holdKey: string) {
  return `gateway-deposit:refund-hold-release:${holdKey}`;
}

export type WalletReversalFailureMarker = {
  refundId: string | null;
  gatewayPaymentId: string;
  originalWalletCreditId: string | null;
  originalWalletCreditKey: string;
  intendedReversalAmount: number;
  currency: string;
  failureCode: string | null;
  failureCategory: "INSUFFICIENT_BALANCE" | "ACCOUNTING_CONFLICT" | "UNKNOWN";
  lastAttemptAt: string;
  attemptCount: number;
  fundsBlocked: boolean;
  fundsProtected: boolean;
  blockedAmount: number;
  holdIdempotencyKeys: string[];
  gatewayAccount: GatewayPayment["gatewayAccount"] | string;
  error: string;
};

function readWalletReversalFailureMarker(
  metadata: Record<string, unknown>
): WalletReversalFailureMarker | null {
  const raw = metadata.refundConfirmedWalletReversalFailed;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  const holdKeys = Array.isArray(m.holdIdempotencyKeys)
    ? m.holdIdempotencyKeys.filter((k): k is string => typeof k === "string")
    : typeof m.holdIdempotencyKey === "string"
      ? [m.holdIdempotencyKey]
      : [];
  return {
    refundId: typeof m.refundId === "string" ? m.refundId : null,
    gatewayPaymentId: typeof m.gatewayPaymentId === "string" ? m.gatewayPaymentId : "",
    originalWalletCreditId:
      typeof m.originalWalletCreditId === "string" ? m.originalWalletCreditId : null,
    originalWalletCreditKey:
      typeof m.originalWalletCreditKey === "string"
        ? m.originalWalletCreditKey
        : "",
    intendedReversalAmount:
      typeof m.intendedReversalAmount === "number" ? m.intendedReversalAmount : 0,
    currency: typeof m.currency === "string" ? m.currency : "MYR",
    failureCode: typeof m.failureCode === "string" ? m.failureCode : null,
    failureCategory:
      m.failureCategory === "INSUFFICIENT_BALANCE" ||
      m.failureCategory === "ACCOUNTING_CONFLICT" ||
      m.failureCategory === "UNKNOWN"
        ? m.failureCategory
        : "UNKNOWN",
    lastAttemptAt: typeof m.lastAttemptAt === "string" ? m.lastAttemptAt : "",
    attemptCount: typeof m.attemptCount === "number" ? m.attemptCount : 0,
    fundsBlocked: Boolean(m.fundsBlocked),
    fundsProtected: Boolean(m.fundsProtected),
    blockedAmount: typeof m.blockedAmount === "number" ? m.blockedAmount : 0,
    holdIdempotencyKeys: holdKeys,
    gatewayAccount: (m.gatewayAccount as GatewayPayment["gatewayAccount"]) ?? "INVESTOR_POOL",
    error: typeof m.error === "string" ? m.error : "Wallet reversal failed",
  };
}

function failureCategoryFromCode(
  code: string | undefined
): WalletReversalFailureMarker["failureCategory"] {
  if (code === "INSUFFICIENT_INVESTOR_BALANCE") return "INSUFFICIENT_BALANCE";
  if (code === "INVALID_GATEWAY_TRANSITION" || code === "ACCOUNTING_CONFLICT") {
    return "ACCOUNTING_CONFLICT";
  }
  return "UNKNOWN";
}

function sanitizeFailureMessage(message: string): string {
  const trimmed = message.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 240) return trimmed;
  return `${trimmed.slice(0, 237)}...`;
}

async function sumHoldAmounts(
  tx: Prisma.TransactionClient,
  holdKeys: string[]
): Promise<number> {
  if (holdKeys.length === 0) return 0;
  const rows = await tx.investorBalanceTransaction.findMany({
    where: {
      idempotency_key: { in: holdKeys },
      direction: "OUT",
      source: "GATEWAY_DEPOSIT_REFUND_HOLD",
    },
    select: { amount: true },
  });
  return rows.reduce((sum, row) => sum + row.amount.toNumber(), 0);
}

/**
 * Release temporary holds then post the permanent refund debit (idempotent).
 * Must run inside an open transaction.
 */
async function applyInvestorDepositWalletReversal(
  tx: Prisma.TransactionClient,
  current: GatewayPayment,
  input: { refundId?: string }
): Promise<{ didReverse: boolean }> {
  if (
    current.purpose !== GatewayPaymentPurpose.INVESTOR_DEPOSIT ||
    !current.investor_organization_id
  ) {
    return { didReverse: false };
  }

  const hadPriorCredit = await tx.investorBalanceTransaction.findFirst({
    where: {
      investor_organization_id: current.investor_organization_id,
      source: "GATEWAY_DEPOSIT",
      idempotency_key: `gateway-deposit:balance:${current.id}`,
    },
  });
  if (!hadPriorCredit) {
    return { didReverse: false };
  }

  const existingDebit = await tx.investorBalanceTransaction.findUnique({
    where: { idempotency_key: refundWalletDebitKey(current.id) },
  });

  const metadata = asMetadataObject(current.metadata);
  const marker = readWalletReversalFailureMarker(metadata);
  const external = readExternalCurlecRefundMarker(metadata);
  const holdKeys = uniqueStrings([
    ...(marker?.holdIdempotencyKeys ?? []),
    ...(external?.holdIdempotencyKeys ?? []),
  ]);

  if (!existingDebit) {
    for (const holdKey of holdKeys) {
      await releaseInvestorBalanceGatewayRefundHold(tx, {
        investorOrganizationId: current.investor_organization_id,
        holdIdempotencyKey: holdKey,
        releaseIdempotencyKey: refundWalletHoldReleaseKey(holdKey),
        metadata: {
          gatewayPaymentId: current.id,
          event: "wallet_funds_released_from_block",
        },
      });
    }

    const amount = current.amount.toNumber();
    await debitInvestorBalanceForGatewayRefund(tx, {
      investorOrganizationId: current.investor_organization_id,
      amount,
      idempotencyKey: refundWalletDebitKey(current.id),
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

  return { didReverse: true };
}

function canCompleteConfirmedRefund(payment: GatewayPayment): boolean {
  if (payment.status === GatewayPaymentStatus.REFUND_INITIATED) return true;
  if (payment.status !== GatewayPaymentStatus.HELD) return false;
  return "refundConfirmedWalletReversalFailed" in asMetadataObject(payment.metadata);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export type ExternalCurlecRefundMarker = {
  source: "CURLEC_PROVIDER";
  refundId: string;
  gatewayPaymentId: string;
  detectedAt: string;
  detectedOnEvent: "refund.created" | "refund.processed" | "refund.failed";
  holdIdempotencyKeys?: string[];
  blockedAmount?: number;
  fundsProtected?: boolean;
  intendedAmount?: number;
  /** Snapshot so refund.failed can restore issuer fee-paid access. */
  previousOnboardingFeePaidAt?: string | null;
};

function readExternalCurlecRefundMarker(
  metadata: Record<string, unknown>
): ExternalCurlecRefundMarker | null {
  const raw = metadata.externalCurlecRefund;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  if (m.source !== "CURLEC_PROVIDER") return null;
  if (typeof m.refundId !== "string" || !m.refundId) return null;
  return {
    source: "CURLEC_PROVIDER",
    refundId: m.refundId,
    gatewayPaymentId: typeof m.gatewayPaymentId === "string" ? m.gatewayPaymentId : "",
    detectedAt: typeof m.detectedAt === "string" ? m.detectedAt : "",
    detectedOnEvent:
      m.detectedOnEvent === "refund.created" ||
      m.detectedOnEvent === "refund.processed" ||
      m.detectedOnEvent === "refund.failed"
        ? m.detectedOnEvent
        : "refund.created",
    holdIdempotencyKeys: Array.isArray(m.holdIdempotencyKeys)
      ? m.holdIdempotencyKeys.filter((k): k is string => typeof k === "string")
      : [],
    blockedAmount: typeof m.blockedAmount === "number" ? m.blockedAmount : undefined,
    fundsProtected: typeof m.fundsProtected === "boolean" ? m.fundsProtected : undefined,
    intendedAmount: typeof m.intendedAmount === "number" ? m.intendedAmount : undefined,
    previousOnboardingFeePaidAt:
      typeof m.previousOnboardingFeePaidAt === "string" || m.previousOnboardingFeePaidAt === null
        ? (m.previousOnboardingFeePaidAt as string | null)
        : undefined,
  };
}

/**
 * Provider-side (Curlec dashboard) refund detected while payment is still COMPLETED.
 * Adopts refund id, marks external source, and for deposits immediately blocks wallet cash.
 */
async function adoptExternalCurlecRefundFromCompleted(
  payment: GatewayPayment,
  input: {
    refundId: string;
    detectedOnEvent: "refund.created" | "refund.processed";
    actorUserId?: string;
    context?: AuditRequestContext | null;
  },
  db: PrismaClient
): Promise<GatewayPayment> {
  if (payment.status !== GatewayPaymentStatus.COMPLETED) {
    return payment;
  }

  await db.$transaction(async (tx) => {
    const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    if (current.status !== GatewayPaymentStatus.COMPLETED) {
      return;
    }

    if (current.refund_reference && current.refund_reference !== input.refundId) {
      logger.warn(
        {
          gatewayPaymentId: current.id,
          existingRefundReference: current.refund_reference,
          incomingRefundId: input.refundId,
        },
        "External Curlec refund ignored — existing refund_reference differs"
      );
      return;
    }

    assertTransition(current.status, GatewayPaymentStatus.REFUND_INITIATED);

    const baseMetadata = asMetadataObject(current.metadata);
    const intendedAmount = current.amount.toNumber();
    const holdKeys: string[] = [];
    let blockedAmount = 0;

    if (
      current.purpose === GatewayPaymentPurpose.INVESTOR_DEPOSIT &&
      current.investor_organization_id
    ) {
      const holdKey = refundWalletHoldKey(current.id);
      const blockResult = await blockInvestorBalanceForGatewayRefundHold(tx, {
        investorOrganizationId: current.investor_organization_id,
        maxAmount: intendedAmount,
        idempotencyKey: holdKey,
        metadata: {
          gatewayPaymentId: current.id,
          refundReference: input.refundId,
          kind: "gateway_deposit_refund_hold",
          source: "external_curlec_refund",
        },
      });
      blockedAmount = blockResult.blockedAmount;
      if (blockedAmount > 0) {
        holdKeys.push(holdKey);
        await recordGatewayPaymentEvent(tx, {
          gatewayPaymentId: current.id,
          type: GatewayPaymentEventType.REFUND_INITIATED,
          actorUserId: input.actorUserId,
          context: input.context,
          fromStatus: GatewayPaymentStatus.COMPLETED,
          toStatus: GatewayPaymentStatus.REFUND_INITIATED,
          reason: "Wallet funds blocked after external Curlec refund detected",
          metadata: {
            event: "wallet_funds_blocked",
            blockedAmount,
            holdIdempotencyKey: holdKey,
            refundId: input.refundId,
          },
        });
      }
    }

    const previousOnboardingFeePaidAt =
      current.purpose === GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE &&
      current.issuer_organization_id
        ? (
            await tx.issuerOrganization.findUnique({
              where: { id: current.issuer_organization_id },
              select: { onboarding_fee_paid_at: true },
            })
          )?.onboarding_fee_paid_at?.toISOString() ?? null
        : undefined;

    const externalMarker: ExternalCurlecRefundMarker = {
      source: "CURLEC_PROVIDER",
      refundId: input.refundId,
      gatewayPaymentId: current.id,
      detectedAt: new Date().toISOString(),
      detectedOnEvent: input.detectedOnEvent,
      holdIdempotencyKeys: holdKeys,
      blockedAmount,
      fundsProtected:
        current.purpose !== GatewayPaymentPurpose.INVESTOR_DEPOSIT
          ? true
          : blockedAmount + 1e-9 >= intendedAmount,
      intendedAmount,
      previousOnboardingFeePaidAt,
    };

    await tx.gatewayPayment.update({
      where: { id: current.id },
      data: {
        status: GatewayPaymentStatus.REFUND_INITIATED,
        refund_reference: current.refund_reference ?? input.refundId,
        metadata: {
          ...baseMetadata,
          externalCurlecRefund: externalMarker,
        } as Prisma.InputJsonValue,
      },
    });

    if (
      current.purpose === GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE &&
      current.issuer_organization_id
    ) {
      await clearIssuerOnboardingFeePaidAt(tx, current.issuer_organization_id);
    }

    await recordGatewayPaymentEvent(tx, {
      gatewayPaymentId: current.id,
      type: GatewayPaymentEventType.REFUND_INITIATED,
      actorUserId: input.actorUserId,
      context: input.context,
      fromStatus: GatewayPaymentStatus.COMPLETED,
      toStatus: GatewayPaymentStatus.REFUND_INITIATED,
      reason: "External Curlec refund detected on completed payment",
      metadata: {
        event: "external_curlec_refund_detected",
        refundId: input.refundId,
        purpose: current.purpose,
        detectedOnEvent: input.detectedOnEvent,
        fundsProtected: externalMarker.fundsProtected ?? null,
        blockedAmount,
      },
    });
  });

  return db.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
}

export async function completeGatewayPaymentRefund(
  payment: GatewayPayment,
  input: { refundId?: string; actorUserId?: string; context?: AuditRequestContext | null },
  db: PrismaClient = defaultPrisma
): Promise<void> {
  if (payment.status === GatewayPaymentStatus.REFUNDED) {
    return;
  }

  let working = payment;

  // Provider refund confirmed while still COMPLETED — adopt + protect first.
  if (working.status === GatewayPaymentStatus.COMPLETED && input.refundId) {
    working = await adoptExternalCurlecRefundFromCompleted(
      working,
      {
        refundId: input.refundId,
        detectedOnEvent: "refund.processed",
        actorUserId: input.actorUserId,
        context: input.context,
      },
      db
    );
  }

  if (!canCompleteConfirmedRefund(working)) {
    return;
  }

  try {
    let completed = false;
    await db.$transaction(async (tx) => {
      const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: working.id } });
      if (current.status === GatewayPaymentStatus.REFUNDED) {
        return;
      }
      if (!canCompleteConfirmedRefund(current)) {
        return;
      }

      assertTransition(current.status, GatewayPaymentStatus.REFUNDED);

      await applyInvestorDepositWalletReversal(tx, current, input);

      const baseMetadata = asMetadataObject(current.metadata);
      const {
        refundConfirmedWalletReversalFailed: _drop,
        ...restMetadata
      } = baseMetadata;

      await tx.gatewayPayment.update({
        where: { id: working.id },
        data: {
          status: GatewayPaymentStatus.REFUNDED,
          refunded_at: new Date(),
          refund_reference: input.refundId ?? current.refund_reference,
          metadata: restMetadata as Prisma.InputJsonValue,
        },
      });

      if (
        current.purpose === GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE &&
        current.issuer_organization_id
      ) {
        await clearIssuerOnboardingFeePaidAt(tx, current.issuer_organization_id);
      }

      await recordGatewayPaymentEvent(tx, {
        gatewayPaymentId: working.id,
        type: GatewayPaymentEventType.REFUNDED,
        actorUserId: input.actorUserId,
        context: input.context,
        fromStatus: current.status,
        toStatus: GatewayPaymentStatus.REFUNDED,
        metadata: {
          refundId: input.refundId ?? current.refund_reference,
          purpose: current.purpose,
          event: "wallet_reversal_completed",
          externalCurlecRefund: Boolean(readExternalCurlecRefundMarker(baseMetadata)),
        },
      });
      completed = true;
    });

    if (!completed) {
      return;
    }

    await notifyDepositRefunded(working);

    const refreshed = await db.gatewayPayment.findUniqueOrThrow({ where: { id: working.id } });
    const metadata = asMetadataObject(refreshed.metadata);
    const attempt = metadata.refundAttempt as { amountSen?: number } | undefined;
    const refundAmount =
      typeof attempt?.amountSen === "number"
        ? senToMyrDecimal(attempt.amountSen)
        : refreshed.amount;

    await markGatewayPaymentReceiptRefunded(
      refreshed.id,
      {
        refundReference: input.refundId ?? refreshed.refund_reference,
        refundAmount,
        refundedAt: refreshed.refunded_at ?? new Date(),
      },
      db
    );
  } catch (error) {
    if (working.purpose !== GatewayPaymentPurpose.INVESTOR_DEPOSIT) {
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
        gatewayPaymentId: working.id,
        gatewayAccount: working.gatewayAccount,
        refundId: input.refundId,
        error: errorMessage,
        errorCode,
      },
      "Investor deposit refund confirmed remotely but wallet reversal failed — moved to HELD"
    );

    await holdForWalletReversalFailure(db, working.id, {
      refundId: input.refundId,
      actorUserId: input.actorUserId,
      errorMessage,
      errorCode,
      gatewayAccount: working.gatewayAccount,
      context: input.context,
    });
  }
}

/** @deprecated Prefer completeGatewayPaymentRefund */
export async function completeInvestorDepositRefund(
  payment: GatewayPayment,
  input: { refundId?: string; actorUserId?: string; context?: AuditRequestContext | null },
  db: PrismaClient = defaultPrisma
): Promise<void> {
  return completeGatewayPaymentRefund(payment, input, db);
}

/**
 * Admin or automatic recovery when Curlec refund already succeeded but wallet debit failed.
 * Never calls Curlec again. Idempotent via gateway-deposit:refund:<id>.
 */
export async function retryWalletReversalForConfirmedRefund(
  payment: GatewayPayment,
  input: {
    actorUserId?: string;
    source?: "admin" | "automatic";
    context?: AuditRequestContext | null;
  },
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

  const metadata = asMetadataObject(payment.metadata);
  const reversalFailure = readWalletReversalFailureMarker(metadata);

  if (!reversalFailure) {
    throw new AppError(
      422,
      "GATEWAY_PAYMENT_INVALID",
      "Held payment is not marked as confirmed-refund wallet reversal failure"
    );
  }

  const refundId = reversalFailure.refundId ?? payment.refund_reference ?? undefined;

  // Confirm Curlec still shows processed when we have a refund id (best-effort; do not re-refund).
  if (refundId) {
    try {
      const curlecClient = createCurlecClient({ gatewayAccount: payment.gatewayAccount });
      const remote = await curlecClient.fetchRefund(refundId);
      if (normalizeCurlecRefundStatus(remote.status) !== "processed") {
        throw new AppError(
          422,
          "GATEWAY_REFUND_NOT_PROCESSED",
          `Curlec refund ${refundId} is not processed (status: ${remote.status ?? "unknown"})`
        );
      }
    } catch (error) {
      if (error instanceof AppError && error.code === "GATEWAY_REFUND_NOT_PROCESSED") {
        throw error;
      }
      // If Curlec lookup fails, still allow retry of local wallet only — refund was already confirmed.
      logger.warn(
        {
          gatewayPaymentId: payment.id,
          refundId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Could not re-check Curlec refund status before wallet reversal retry — proceeding with local retry"
      );
    }
  }

  await db.$transaction(async (tx) => {
    await recordGatewayPaymentEvent(tx, {
      gatewayPaymentId: payment.id,
      type: GatewayPaymentEventType.REFUND_WALLET_REVERSAL_FAILED,
      actorUserId: input.actorUserId,
      context: input.context,
      fromStatus: GatewayPaymentStatus.HELD,
      toStatus: GatewayPaymentStatus.HELD,
      reason:
        input.source === "automatic"
          ? "Automatic wallet reversal retry started"
          : "Admin wallet reversal retry started",
      metadata: {
        event:
          input.source === "automatic"
            ? "automatic_wallet_reversal_retry_started"
            : "admin_wallet_reversal_retry_started",
        refundId: refundId ?? null,
      },
    });
  });

  await completeGatewayPaymentRefund(
    payment,
    { refundId, actorUserId: input.actorUserId, context: input.context },
    db
  );

  const final = await db.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
  return final.status;
}

/**
 * Automatic recovery for HELD payments where Curlec refund is confirmed but wallet
 * reversal failed. Runs on the existing gateway stuck-order poller schedule (15 min).
 * No invented retry limit — keeps trying while the marker remains.
 */
export async function recoverFailedWalletReversals(
  db: PrismaClient = defaultPrisma,
  limit = 50,
  context?: AuditRequestContext | null
): Promise<{
  scanned: number;
  recovered: number;
  stillHeld: number;
  errors: Array<{ id: string; error: string }>;
}> {
  const heldRows = await db.gatewayPayment.findMany({
    where: {
      status: GatewayPaymentStatus.HELD,
      purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
    },
    orderBy: { updated_at: "asc" },
    take: limit * 3,
  });

  const eligible = heldRows
    .filter((row) => "refundConfirmedWalletReversalFailed" in asMetadataObject(row.metadata))
    .slice(0, limit);

  let recovered = 0;
  let stillHeld = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const payment of eligible) {
    try {
      const metadata = asMetadataObject(payment.metadata);
      // Currency-mismatch holds must never enter this path (different marker).
      const captureMismatch = metadata.captureMismatch as { mismatchType?: string } | undefined;
      if (captureMismatch?.mismatchType === "CURRENCY_MISMATCH") {
        continue;
      }

      const status = await retryWalletReversalForConfirmedRefund(
        payment,
        { source: "automatic", context },
        db
      );
      if (status === GatewayPaymentStatus.REFUNDED) {
        recovered += 1;
      } else {
        stillHeld += 1;
      }
    } catch (error) {
      errors.push({
        id: payment.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    scanned: eligible.length,
    recovered,
    stillHeld,
    errors,
  };
}

export async function failGatewayPaymentRefund(
  payment: GatewayPayment,
  input: { refundId?: string; errorMessage?: string; context?: AuditRequestContext | null },
  db: PrismaClient = defaultPrisma
): Promise<void> {
  if (payment.status === GatewayPaymentStatus.REFUNDED) {
    return;
  }

  // Provider refund failed while Cashsouk still shows COMPLETED — record only, no wallet change.
  if (payment.status === GatewayPaymentStatus.COMPLETED) {
    await db.$transaction(async (tx) => {
      const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
      if (current.status !== GatewayPaymentStatus.COMPLETED) {
        return;
      }
      const baseMetadata = asMetadataObject(current.metadata);
      await tx.gatewayPayment.update({
        where: { id: payment.id },
        data: {
          metadata: {
            ...baseMetadata,
            externalCurlecRefundFailed: {
              source: "CURLEC_PROVIDER",
              refundId: input.refundId ?? null,
              error: sanitizeFailureMessage(
                input.errorMessage ?? "Curlec refund.failed webhook"
              ),
              at: new Date().toISOString(),
            },
          } as Prisma.InputJsonValue,
        },
      });
      await recordGatewayPaymentEvent(tx, {
        gatewayPaymentId: payment.id,
        type: GatewayPaymentEventType.REFUND_WALLET_REVERSAL_FAILED,
        context: input.context,
        fromStatus: GatewayPaymentStatus.COMPLETED,
        toStatus: GatewayPaymentStatus.COMPLETED,
        reason: "External Curlec refund failed — completed payment unchanged",
        metadata: {
          event: "external_curlec_refund_failed",
          refundId: input.refundId ?? null,
          purpose: current.purpose,
        },
      });
    });
    return;
  }

  if (payment.status !== GatewayPaymentStatus.REFUND_INITIATED) {
    return;
  }

  await db.$transaction(async (tx) => {
    const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    if (current.status !== GatewayPaymentStatus.REFUND_INITIATED) {
      return;
    }

    const baseMetadata = asMetadataObject(current.metadata);
    const external = readExternalCurlecRefundMarker(baseMetadata);

    // External dashboard refund cancelled/failed after local adoption — restore COMPLETED
    // and release any temporary wallet holds. Do not leave funds blocked.
    if (external) {
      assertTransition(current.status, GatewayPaymentStatus.COMPLETED);

      if (
        current.purpose === GatewayPaymentPurpose.INVESTOR_DEPOSIT &&
        current.investor_organization_id
      ) {
        for (const holdKey of external.holdIdempotencyKeys ?? []) {
          await releaseInvestorBalanceGatewayRefundHold(tx, {
            investorOrganizationId: current.investor_organization_id,
            holdIdempotencyKey: holdKey,
            releaseIdempotencyKey: refundWalletHoldReleaseKey(holdKey),
            metadata: {
              gatewayPaymentId: current.id,
              event: "wallet_funds_released_from_block",
              reason: "external_curlec_refund_failed",
            },
          });
        }
      }

      const {
        externalCurlecRefund: _dropExternal,
        refundConfirmedWalletReversalFailed: _dropFailure,
        ...rest
      } = baseMetadata;

      await tx.gatewayPayment.update({
        where: { id: payment.id },
        data: {
          status: GatewayPaymentStatus.COMPLETED,
          refund_reference: null,
          metadata: {
            ...rest,
            externalCurlecRefundFailed: {
              source: "CURLEC_PROVIDER",
              refundId: input.refundId ?? external.refundId,
              error: sanitizeFailureMessage(
                input.errorMessage ?? "Curlec refund.failed webhook"
              ),
              at: new Date().toISOString(),
            },
          } as Prisma.InputJsonValue,
        },
      });

      if (
        current.purpose === GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE &&
        current.issuer_organization_id
      ) {
        await restoreIssuerOnboardingFeePaidAt(
          tx,
          current.issuer_organization_id,
          external.previousOnboardingFeePaidAt ?? current.created_at
        );
      }

      await recordGatewayPaymentEvent(tx, {
        gatewayPaymentId: payment.id,
        type: GatewayPaymentEventType.REFUND_INITIATED,
        context: input.context,
        fromStatus: GatewayPaymentStatus.REFUND_INITIATED,
        toStatus: GatewayPaymentStatus.COMPLETED,
        reason: "External Curlec refund failed — restored completed payment and released holds",
        metadata: {
          event: "external_curlec_refund_failed_restored",
          refundId: input.refundId ?? external.refundId,
          purpose: current.purpose,
        },
      });
      return;
    }

    assertTransition(current.status, GatewayPaymentStatus.HELD);

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
  input: { refundId?: string; errorMessage?: string; context?: AuditRequestContext | null },
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
 *
 * COMPLETED → REFUND_INITIATED for external Curlec dashboard refunds, with immediate
 * wallet protection for investor deposits.
 */
export async function adoptGatewayRefundCreated(
  payment: GatewayPayment,
  input: { refundId: string; context?: AuditRequestContext | null },
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

  if (payment.status === GatewayPaymentStatus.COMPLETED) {
    const adopted = await adoptExternalCurlecRefundFromCompleted(
      payment,
      { refundId: input.refundId, detectedOnEvent: "refund.created", context: input.context },
      db
    );
    return adopted.status;
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
      context: input.context,
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
  limit = 50,
  context?: AuditRequestContext | null
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
        await completeGatewayPaymentRefund(payment, { refundId, context }, db);
        refunded += 1;
        continue;
      }

      if (remoteStatus === "failed") {
        await failGatewayPaymentRefund(
          payment,
          { refundId, errorMessage: "Curlec refund status is failed", context },
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
