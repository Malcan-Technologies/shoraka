import {
  CurlecGatewayAccount,
  GatewayPayment,
  GatewayPaymentEventType,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  NameCheckResult,
  NoteLedgerDirection,
  OrganizationType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { ZodError } from "zod";
import { getCurlecConfig } from "../../config/curlec";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { postLedgerEntry } from "../notes/ledger";
import {
  creditCompletedDeposit,
  pendNameCheckReview,
  resolveInvestorExpectedNameVariants,
} from "./deposit-service";
import { verifyCurlecWebhookSignature } from "./curlec-signature";
import { createCurlecClient } from "./curlec-client";
import { assertGatewayAccountMatch } from "./gateway-account";
import { recordGatewayPaymentEvent } from "./gateway-events";
import {
  extractBankCodeFromPayment,
  extractPayerNameFromPayment,
  type CurlecPayment,
} from "./curlec-schemas";
import { myrDecimalToSen } from "./money";
import { runNameCheck } from "./name-check";
import {
  completeInvestorDepositRefund,
  failInvestorDepositRefund,
  initiateInvestorDepositRefund,
} from "./refund-service";
import { assertTransition, TERMINAL_GATEWAY_STATUSES } from "./state";
import {
  curlecWebhookPayloadSchema,
  extractDepositCaptureRefs,
  extractPaymentFailedRefs,
  extractRefundRefs,
  type CurlecWebhookPayload,
} from "./webhook-schemas";

export type IngestCurlecWebhookInput = {
  rawBody: string;
  signature: string | undefined;
  eventId: string | undefined;
  gatewayAccount?: CurlecGatewayAccount;
};

export type IngestCurlecWebhookResult = {
  eventId: string;
  eventType: string;
  duplicate: boolean;
  gatewayAccount: CurlecGatewayAccount;
};

const DEPOSIT_CAPTURE_EVENTS = new Set(["payment.captured", "order.paid"]);
const AMOUNT_MISMATCH_ERROR = "Curlec captured amount does not match internal payment amount";
const CURRENCY_MISMATCH_ERROR = "Curlec captured currency does not match internal payment currency";
const ORDER_MISMATCH_ERROR = "Curlec captured payment order does not match webhook order";
const PAYMENT_ID_CONFLICT_ERROR = "Curlec payment is already linked to another gateway payment";

const CAPTURE_SKIP_STATUSES: ReadonlySet<GatewayPaymentStatus> = new Set([
  GatewayPaymentStatus.COMPLETED,
  GatewayPaymentStatus.HELD,
  GatewayPaymentStatus.NAME_CHECK_PENDING,
  GatewayPaymentStatus.REFUNDED,
  GatewayPaymentStatus.FAILED,
]);

function getAmountMismatch(
  payment: Pick<GatewayPayment, "amount">,
  curlecPayment: Pick<CurlecPayment, "amount">
) {
  const expectedSen = myrDecimalToSen(payment.amount);
  const actualSen = curlecPayment.amount;
  if (expectedSen === actualSen) return null;
  return { expectedSen, actualSen };
}

function getCurrencyMismatch(
  payment: Pick<GatewayPayment, "currency">,
  curlecPayment: Pick<CurlecPayment, "currency">
) {
  if (payment.currency === curlecPayment.currency) return null;
  return { expected: payment.currency, actual: curlecPayment.currency };
}

function withAmountMismatchMetadata(
  payment: Pick<GatewayPayment, "metadata">,
  mismatch: { expectedSen: number; actualSen: number },
  curlecPayment: Pick<CurlecPayment, "id">
): Prisma.InputJsonValue {
  const base =
    payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata)
      ? payment.metadata
      : {};

  return {
    ...base,
    amountMismatch: {
      expectedSen: mismatch.expectedSen,
      actualSen: mismatch.actualSen,
      curlecPaymentId: curlecPayment.id,
      detectedAt: new Date().toISOString(),
    },
  } as Prisma.InputJsonValue;
}

async function markWebhookProcessed(
  db: PrismaClient,
  eventId: string,
  error?: string | null,
  gatewayAccount?: CurlecGatewayAccount
) {
  // Sync-from-Curlec paths do not ingest a webhook row first.
  if (eventId.startsWith("sync:")) {
    return;
  }

  await db.gatewayWebhookEvent.updateMany({
    where: {
      event_id: eventId,
      ...(gatewayAccount ? { gatewayAccount } : {}),
    },
    data: {
      processed_at: new Date(),
      error: error ?? null,
    },
  });
}

async function claimCaptureToPaid(
  tx: Prisma.TransactionClient,
  gatewayPaymentId: string
): Promise<GatewayPaymentStatus | null> {
  const claimedFromCreated = await tx.gatewayPayment.updateMany({
    where: { id: gatewayPaymentId, status: GatewayPaymentStatus.CREATED },
    data: { status: GatewayPaymentStatus.PAID },
  });

  if (claimedFromCreated.count === 1) {
    return GatewayPaymentStatus.PAID;
  }

  const claimedFromExpired = await tx.gatewayPayment.updateMany({
    where: { id: gatewayPaymentId, status: GatewayPaymentStatus.EXPIRED },
    data: { status: GatewayPaymentStatus.PAID },
  });

  if (claimedFromExpired.count === 1) {
    return GatewayPaymentStatus.PAID;
  }

  const current = await tx.gatewayPayment.findUnique({
    where: { id: gatewayPaymentId },
    select: { status: true },
  });
  return current?.status ?? null;
}

function isCaptureSkippableStatus(status: GatewayPaymentStatus): boolean {
  return CAPTURE_SKIP_STATUSES.has(status);
}

type CaptureValidationFailure = {
  ok: false;
  mismatchType: "ORDER_MISMATCH" | "CURRENCY_MISMATCH" | "PAYMENT_ID_CONFLICT";
  reason: string;
  expectedCurrency?: string;
  actualCurrency?: string;
};

type CaptureValidationResult = { ok: true } | CaptureValidationFailure;

async function validateCapturedPayment(
  db: PrismaClient,
  payment: Pick<GatewayPayment, "id" | "currency" | "gatewayAccount">,
  curlecPayment: Pick<CurlecPayment, "id" | "order_id" | "currency">,
  orderId: string,
  eventId: string,
  routeGatewayAccount: CurlecGatewayAccount
): Promise<CaptureValidationResult> {
  assertGatewayAccountMatch(routeGatewayAccount, payment.gatewayAccount, "capture-validation");

  if (curlecPayment.order_id && curlecPayment.order_id !== orderId) {
    await markWebhookProcessed(db, eventId, ORDER_MISMATCH_ERROR, routeGatewayAccount);
    logger.warn(
      {
        eventId,
        gatewayPaymentId: payment.id,
        webhookOrderId: orderId,
        curlecOrderId: curlecPayment.order_id,
        curlecPaymentId: curlecPayment.id,
      },
      "Skipping Curlec capture due to order mismatch"
    );
    return {
      ok: false,
      mismatchType: "ORDER_MISMATCH",
      reason: ORDER_MISMATCH_ERROR,
    };
  }

  const currencyMismatch = getCurrencyMismatch(payment, curlecPayment);
  if (currencyMismatch) {
    await markWebhookProcessed(db, eventId, CURRENCY_MISMATCH_ERROR, routeGatewayAccount);
    logger.warn(
      {
        eventId,
        gatewayPaymentId: payment.id,
        expectedCurrency: currencyMismatch.expected,
        actualCurrency: currencyMismatch.actual,
        curlecPaymentId: curlecPayment.id,
      },
      "Skipping Curlec capture due to currency mismatch"
    );
    return {
      ok: false,
      mismatchType: "CURRENCY_MISMATCH",
      reason: CURRENCY_MISMATCH_ERROR,
      expectedCurrency: currencyMismatch.expected,
      actualCurrency: currencyMismatch.actual,
    };
  }

  const conflictingPayment = await db.gatewayPayment.findFirst({
    where: {
      curlec_payment_id: curlecPayment.id,
      gatewayAccount: payment.gatewayAccount,
      id: { not: payment.id },
    },
    select: { id: true },
  });

  if (conflictingPayment) {
    await markWebhookProcessed(db, eventId, PAYMENT_ID_CONFLICT_ERROR, routeGatewayAccount);
    logger.warn(
      {
        eventId,
        gatewayPaymentId: payment.id,
        conflictingGatewayPaymentId: conflictingPayment.id,
        curlecPaymentId: curlecPayment.id,
      },
      "Skipping Curlec capture because payment id is already linked to another row"
    );
    return {
      ok: false,
      mismatchType: "PAYMENT_ID_CONFLICT",
      reason: PAYMENT_ID_CONFLICT_ERROR,
    };
  }

  return { ok: true };
}

/**
 * Issuer fee money was captured at Curlec but failed local validation.
 * Claim CREATED/EXPIRED → PAID, then move to HELD with auditable metadata.
 * Never COMPLETED or FAILED — FAILED would allow a second fee order.
 */
async function holdIssuerFeeCaptureMismatch(
  db: PrismaClient,
  payment: GatewayPayment,
  input: {
    reason: string;
    mismatchType: string;
    curlecPaymentId?: string | null;
    curlecOrderId?: string | null;
    expectedSen?: number;
    actualSen?: number;
    expectedCurrency?: string;
    actualCurrency?: string;
  }
): Promise<void> {
  await db.$transaction(async (tx) => {
    const current = await tx.gatewayPayment.findUnique({ where: { id: payment.id } });
    if (!current) return;

    if (
      current.status !== GatewayPaymentStatus.CREATED &&
      current.status !== GatewayPaymentStatus.EXPIRED &&
      current.status !== GatewayPaymentStatus.PAID
    ) {
      return;
    }

    let fromStatus = current.status;
    if (
      current.status === GatewayPaymentStatus.CREATED ||
      current.status === GatewayPaymentStatus.EXPIRED
    ) {
      const claimedStatus = await claimCaptureToPaid(tx, payment.id);
      if (claimedStatus !== GatewayPaymentStatus.PAID) {
        return;
      }
      fromStatus = GatewayPaymentStatus.PAID;
    }

    const claimed = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    if (claimed.status === GatewayPaymentStatus.HELD) {
      return;
    }
    if (claimed.status !== GatewayPaymentStatus.PAID) {
      return;
    }

    assertTransition(claimed.status, GatewayPaymentStatus.HELD);

    const baseMetadata =
      claimed.metadata && typeof claimed.metadata === "object" && !Array.isArray(claimed.metadata)
        ? claimed.metadata
        : {};

    await tx.gatewayPayment.update({
      where: { id: payment.id },
      data: {
        status: GatewayPaymentStatus.HELD,
        curlec_payment_id: input.curlecPaymentId ?? claimed.curlec_payment_id,
        metadata: {
          ...baseMetadata,
          captureMismatch: {
            mismatchType: input.mismatchType,
            reason: input.reason,
            gatewayPaymentId: payment.id,
            curlecOrderId: input.curlecOrderId ?? claimed.curlec_order_id,
            curlecPaymentId: input.curlecPaymentId ?? claimed.curlec_payment_id,
            gatewayAccount: claimed.gatewayAccount,
            expectedSen: input.expectedSen ?? null,
            actualSen: input.actualSen ?? null,
            expectedCurrency: input.expectedCurrency ?? null,
            actualCurrency: input.actualCurrency ?? null,
            detectedAt: new Date().toISOString(),
          },
        } as Prisma.InputJsonValue,
      },
    });

    await recordGatewayPaymentEvent(tx, {
      gatewayPaymentId: payment.id,
      type: GatewayPaymentEventType.CAPTURE_MISMATCH,
      fromStatus,
      toStatus: GatewayPaymentStatus.HELD,
      reason: input.reason,
      metadata: {
        mismatchType: input.mismatchType,
        gatewayAccount: claimed.gatewayAccount,
        curlecOrderId: input.curlecOrderId ?? claimed.curlec_order_id,
        curlecPaymentId: input.curlecPaymentId ?? claimed.curlec_payment_id,
      },
    });
  });
}

export async function processInvestorDepositCapture(
  input: {
    orderId: string;
    paymentId: string;
    eventId: string;
    routeGatewayAccount?: CurlecGatewayAccount;
  },
  db: PrismaClient = defaultPrisma
): Promise<void> {
  const routeGatewayAccount = input.routeGatewayAccount ?? CurlecGatewayAccount.LEGACY_DEFAULT;

  const payment = await db.gatewayPayment.findFirst({
    where: { curlec_order_id: input.orderId, gatewayAccount: routeGatewayAccount },
    include: { investor_organization: true },
  });

  if (!payment) {
    const paymentDifferentAccount = await db.gatewayPayment.findFirst({
      where: { curlec_order_id: input.orderId },
      select: { id: true, gatewayAccount: true },
    });
    if (paymentDifferentAccount) {
      await markWebhookProcessed(
        db,
        input.eventId,
        "Gateway account mismatch for order",
        input.routeGatewayAccount
      );
      logger.warn(
        {
          eventId: input.eventId,
          routeGatewayAccount: input.routeGatewayAccount,
          paymentGatewayAccount: paymentDifferentAccount.gatewayAccount,
          gatewayPaymentId: paymentDifferentAccount.id,
          orderId: input.orderId,
        },
        "Skipped webhook due to gateway account mismatch"
      );
      return;
    }

    await markWebhookProcessed(
      db,
      input.eventId,
      "Gateway payment not found for order in route account",
      routeGatewayAccount
    );
    return;
  }

  assertGatewayAccountMatch(routeGatewayAccount, payment.gatewayAccount, "investor-deposit-capture");

  if (isCaptureSkippableStatus(payment.status)) {
    await markWebhookProcessed(db, input.eventId, null, routeGatewayAccount);
    return;
  }

  const curlecClient = createCurlecClient({ gatewayAccount: payment.gatewayAccount });
  const curlecPayment = await curlecClient.fetchPayment(input.paymentId);
  const isCaptureValid = await validateCapturedPayment(
    db,
    { id: payment.id, currency: payment.currency, gatewayAccount: payment.gatewayAccount },
    { id: curlecPayment.id, order_id: curlecPayment.order_id, currency: curlecPayment.currency },
    input.orderId,
    input.eventId,
    routeGatewayAccount
  );
  if (!isCaptureValid.ok) {
    return;
  }
  const payerName = extractPayerNameFromPayment(curlecPayment);
  const bankCode = extractBankCodeFromPayment(curlecPayment);
  const amountMismatch = getAmountMismatch(payment, curlecPayment);

  await db.gatewayPayment.update({
    where: { id: payment.id },
    data: {
      curlec_payment_id: curlecPayment.id,
      method: curlecPayment.method,
      bank_code: bankCode,
      payer_name: payerName,
    },
  });

  if (amountMismatch) {
    await db.$transaction(async (tx) => {
      const statusAfterClaim = await claimCaptureToPaid(tx, payment.id);
      if (!statusAfterClaim || isCaptureSkippableStatus(statusAfterClaim)) {
        return;
      }
      if (statusAfterClaim !== GatewayPaymentStatus.PAID) {
        return;
      }
    });

    const refreshed = await db.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    if (refreshed.status === GatewayPaymentStatus.PAID) {
      await db.gatewayPayment.update({
        where: { id: payment.id },
        data: {
          metadata: withAmountMismatchMetadata(payment, amountMismatch, curlecPayment),
        },
      });

      await initiateInvestorDepositRefund(
        refreshed,
        {
          reason: "AMOUNT_MISMATCH",
          curlecPaymentId: curlecPayment.id,
        },
        db
      );
    }

    await markWebhookProcessed(db, input.eventId, AMOUNT_MISMATCH_ERROR, routeGatewayAccount);
    logger.warn(
      {
        eventId: input.eventId,
        gatewayPaymentId: payment.id,
        gatewayAccount: payment.gatewayAccount,
        orderId: input.orderId,
        expectedSen: amountMismatch.expectedSen,
        actualSen: amountMismatch.actualSen,
      },
      "Investor deposit auto-refund triggered due to Curlec amount mismatch"
    );
    return;
  }

  const org = payment.investor_organization;
  const expectedVariants = org ? resolveInvestorExpectedNameVariants(org) : [];
  const nameCheck = runNameCheck({
    expectedVariants,
    payerName,
    isCompany: org?.type === OrganizationType.COMPANY,
  });
  const nameCheckResult = nameCheck.decision;

  if (nameCheckResult === NameCheckResult.PASS) {
    await db.$transaction(async (tx) => {
      const statusAfterClaim = await claimCaptureToPaid(tx, payment.id);
      if (!statusAfterClaim) {
        return;
      }

      if (isCaptureSkippableStatus(statusAfterClaim)) {
        return;
      }

      if (statusAfterClaim !== GatewayPaymentStatus.PAID) {
        return;
      }

      const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
      await creditCompletedDeposit(tx, current, { nameCheckResult: NameCheckResult.PASS });
    });
  } else if (nameCheckResult === NameCheckResult.FAIL) {
    await db.$transaction(async (tx) => {
      await claimCaptureToPaid(tx, payment.id);
    });

    const refreshed = await db.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    if (refreshed.status === GatewayPaymentStatus.PAID) {
      await initiateInvestorDepositRefund(
        refreshed,
        {
          reason: "NAME_MISMATCH",
          curlecPaymentId: curlecPayment.id,
          nameCheckResult,
        },
        db
      );
    }
  } else {
    await db.$transaction(async (tx) => {
      const statusAfterClaim = await claimCaptureToPaid(tx, payment.id);
      if (!statusAfterClaim || isCaptureSkippableStatus(statusAfterClaim)) {
        return;
      }
      if (statusAfterClaim !== GatewayPaymentStatus.PAID) {
        return;
      }

      const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
      await pendNameCheckReview(tx, current, nameCheckResult, {
        score: nameCheck.score,
        matchedVariant: nameCheck.matchedVariant,
      });
    });
  }

  await markWebhookProcessed(db, input.eventId, null, routeGatewayAccount);

  logger.info(
    {
      eventId: input.eventId,
      gatewayPaymentId: payment.id,
      gatewayAccount: payment.gatewayAccount,
      nameCheckResult,
      nameCheckScore: nameCheck.score,
      matchedVariant: nameCheck.matchedVariant,
      orderId: input.orderId,
    },
    "Investor deposit webhook processed"
  );
}

export async function processStoredCurlecWebhook(
  eventId: string,
  db: PrismaClient = defaultPrisma,
  routeGatewayAccount: CurlecGatewayAccount = CurlecGatewayAccount.LEGACY_DEFAULT
): Promise<void> {
  const stored = await db.gatewayWebhookEvent.findFirst({
    where: { event_id: eventId, gatewayAccount: routeGatewayAccount },
  });
  if (!stored) {
    throw new AppError(404, "WEBHOOK_NOT_FOUND", "Stored webhook event not found");
  }

  if (stored.processed_at) {
    return;
  }

  let payload: CurlecWebhookPayload;
  try {
    payload = curlecWebhookPayloadSchema.parse(stored.payload);
  } catch (error) {
    if (error instanceof ZodError) {
      await markWebhookProcessed(db, eventId, "Invalid stored payload", routeGatewayAccount);
      return;
    }
    throw error;
  }

  if (payload.event === "refund.processed" || payload.event === "refund.failed") {
    const refund = extractRefundRefs(payload);
    if (!refund) {
      await markWebhookProcessed(db, eventId, "Missing refund references", routeGatewayAccount);
      return;
    }

    const payment = await db.gatewayPayment.findFirst({
      where: { curlec_payment_id: refund.paymentId, gatewayAccount: routeGatewayAccount },
    });

    if (!payment) {
      const paymentDifferentAccount = await db.gatewayPayment.findFirst({
        where: { curlec_payment_id: refund.paymentId },
        select: { id: true, gatewayAccount: true },
      });
      if (paymentDifferentAccount) {
        await markWebhookProcessed(db, eventId, "Gateway account mismatch for refund", routeGatewayAccount);
        logger.warn(
          {
            eventId,
            routeGatewayAccount,
            paymentGatewayAccount: paymentDifferentAccount.gatewayAccount,
            gatewayPaymentId: paymentDifferentAccount.id,
            curlecPaymentId: refund.paymentId,
            refundId: refund.refundId,
          },
          "Skipped refund webhook due to gateway account mismatch"
        );
        return;
      }

      await markWebhookProcessed(
        db,
        eventId,
        "Gateway payment not found for refund in route account",
        routeGatewayAccount
      );
      return;
    }

    if (payment.purpose === GatewayPaymentPurpose.INVESTOR_DEPOSIT) {
      if (payload.event === "refund.processed") {
        await completeInvestorDepositRefund(payment, { refundId: refund.refundId }, db);
      } else {
        await failInvestorDepositRefund(payment, { refundId: refund.refundId }, db);
      }
    }

    await markWebhookProcessed(db, eventId, null, routeGatewayAccount);
    return;
  }

  if (!DEPOSIT_CAPTURE_EVENTS.has(payload.event)) {
    if (payload.event === "payment.failed") {
      const failed = extractPaymentFailedRefs(payload);
      if (failed) {
        await markGatewayPaymentFailedByOrderId(
          db,
          failed.orderId,
          routeGatewayAccount,
          failed.paymentId
        );
      }
      await markWebhookProcessed(
        db,
        eventId,
        failed ? null : "Missing payment references",
        routeGatewayAccount
      );
      return;
    }

    await markWebhookProcessed(db, eventId, null, routeGatewayAccount);
    return;
  }

  const capture = extractDepositCaptureRefs(payload);
  if (!capture) {
    await markWebhookProcessed(
      db,
      eventId,
      "Missing order/payment references",
      routeGatewayAccount
    );
    return;
  }

  let paymentId = capture.paymentId;
  if (!paymentId) {
    const curlecClient = createCurlecClient({ gatewayAccount: routeGatewayAccount });
    const payments = await curlecClient.fetchOrderPayments(capture.orderId);
    const captured =
      payments.find((payment) => payment.status === "captured") ?? payments.at(0);
    if (!captured) {
      await markWebhookProcessed(
        db,
        eventId,
        "No payments found for paid order",
        routeGatewayAccount
      );
      return;
    }
    paymentId = captured.id;
  }

  await processGatewayPaymentCapture(
    { orderId: capture.orderId, paymentId, eventId, routeGatewayAccount },
    db
  );
}

async function processGatewayPaymentCapture(
  input: {
    orderId: string;
    paymentId: string;
    eventId: string;
    routeGatewayAccount: CurlecGatewayAccount;
  },
  db: PrismaClient
): Promise<void> {
  const payment = await db.gatewayPayment.findFirst({
    where: { curlec_order_id: input.orderId, gatewayAccount: input.routeGatewayAccount },
    select: { purpose: true },
  });

  if (!payment) {
    await markWebhookProcessed(
      db,
      input.eventId,
      "Gateway payment not found for order in route account",
      input.routeGatewayAccount
    );
    return;
  }

  switch (payment.purpose) {
    case GatewayPaymentPurpose.INVESTOR_DEPOSIT:
      await processInvestorDepositCapture(input, db);
      return;
    case GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE:
      await processOnboardingFeeCapture(input, db);
      return;
    case GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE:
      await processProcessingFeeCapture(input, db);
      return;
    default:
      await markWebhookProcessed(db, input.eventId, null, input.routeGatewayAccount);
  }
}

export async function processOnboardingFeeCapture(
  input: {
    orderId: string;
    paymentId: string;
    eventId: string;
    routeGatewayAccount?: CurlecGatewayAccount;
  },
  db: PrismaClient = defaultPrisma
): Promise<void> {
  const routeGatewayAccount = input.routeGatewayAccount ?? CurlecGatewayAccount.LEGACY_DEFAULT;
  const payment = await db.gatewayPayment.findFirst({
    where: { curlec_order_id: input.orderId, gatewayAccount: routeGatewayAccount },
  });

  if (!payment) {
    await markWebhookProcessed(
      db,
      input.eventId,
      "Gateway payment not found for order in route account",
      routeGatewayAccount
    );
    return;
  }

  assertGatewayAccountMatch(routeGatewayAccount, payment.gatewayAccount, "onboarding-fee-capture");

  if (isCaptureSkippableStatus(payment.status)) {
    await markWebhookProcessed(db, input.eventId, null, routeGatewayAccount);
    return;
  }

  const curlecClient = createCurlecClient({ gatewayAccount: payment.gatewayAccount });
  const curlecPayment = await curlecClient.fetchPayment(input.paymentId);
  const captureValidation = await validateCapturedPayment(
    db,
    { id: payment.id, currency: payment.currency, gatewayAccount: payment.gatewayAccount },
    { id: curlecPayment.id, order_id: curlecPayment.order_id, currency: curlecPayment.currency },
    input.orderId,
    input.eventId,
    routeGatewayAccount
  );
  if (!captureValidation.ok) {
    await holdIssuerFeeCaptureMismatch(db, payment, {
      mismatchType: captureValidation.mismatchType,
      reason: captureValidation.reason,
      curlecPaymentId: curlecPayment.id,
      curlecOrderId: input.orderId,
      expectedCurrency: captureValidation.expectedCurrency,
      actualCurrency: captureValidation.actualCurrency,
    });
    return;
  }
  const amountMismatch = getAmountMismatch(payment, curlecPayment);

  await db.gatewayPayment.update({
    where: { id: payment.id },
    data: {
      curlec_payment_id: curlecPayment.id,
      method: curlecPayment.method,
    },
  });

  if (amountMismatch) {
    await holdIssuerFeeCaptureMismatch(db, payment, {
      mismatchType: "AMOUNT_MISMATCH",
      reason: `${AMOUNT_MISMATCH_ERROR}: expected ${amountMismatch.expectedSen} sen, got ${amountMismatch.actualSen} sen`,
      curlecPaymentId: curlecPayment.id,
      curlecOrderId: input.orderId,
      expectedSen: amountMismatch.expectedSen,
      actualSen: amountMismatch.actualSen,
    });
    await markWebhookProcessed(db, input.eventId, AMOUNT_MISMATCH_ERROR, routeGatewayAccount);
    logger.warn(
      {
        eventId: input.eventId,
        gatewayPaymentId: payment.id,
        orderId: input.orderId,
        expectedSen: amountMismatch.expectedSen,
        actualSen: amountMismatch.actualSen,
      },
      "Issuer onboarding fee held due to Curlec amount mismatch"
    );
    return;
  }

  await db.$transaction(async (tx) => {
    const statusAfterClaim = await claimCaptureToPaid(tx, payment.id);
    if (!statusAfterClaim || statusAfterClaim !== GatewayPaymentStatus.PAID) {
      return;
    }

    const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    await completeOnboardingFeePayment(tx, current);
  });

  await markWebhookProcessed(db, input.eventId, null, routeGatewayAccount);

  logger.info(
    {
      eventId: input.eventId,
      gatewayPaymentId: payment.id,
      gatewayAccount: payment.gatewayAccount,
      orderId: input.orderId,
    },
    "Issuer onboarding fee webhook processed"
  );
}

export async function processProcessingFeeCapture(
  input: {
    orderId: string;
    paymentId: string;
    eventId: string;
    routeGatewayAccount?: CurlecGatewayAccount;
  },
  db: PrismaClient = defaultPrisma
): Promise<void> {
  const routeGatewayAccount = input.routeGatewayAccount ?? CurlecGatewayAccount.LEGACY_DEFAULT;
  const payment = await db.gatewayPayment.findFirst({
    where: { curlec_order_id: input.orderId, gatewayAccount: routeGatewayAccount },
  });

  if (!payment) {
    await markWebhookProcessed(
      db,
      input.eventId,
      "Gateway payment not found for order in route account",
      routeGatewayAccount
    );
    return;
  }

  assertGatewayAccountMatch(routeGatewayAccount, payment.gatewayAccount, "processing-fee-capture");

  if (isCaptureSkippableStatus(payment.status)) {
    await markWebhookProcessed(db, input.eventId, null, routeGatewayAccount);
    return;
  }

  const curlecClient = createCurlecClient({ gatewayAccount: payment.gatewayAccount });
  const curlecPayment = await curlecClient.fetchPayment(input.paymentId);
  const captureValidation = await validateCapturedPayment(
    db,
    { id: payment.id, currency: payment.currency, gatewayAccount: payment.gatewayAccount },
    { id: curlecPayment.id, order_id: curlecPayment.order_id, currency: curlecPayment.currency },
    input.orderId,
    input.eventId,
    routeGatewayAccount
  );
  if (!captureValidation.ok) {
    await holdIssuerFeeCaptureMismatch(db, payment, {
      mismatchType: captureValidation.mismatchType,
      reason: captureValidation.reason,
      curlecPaymentId: curlecPayment.id,
      curlecOrderId: input.orderId,
      expectedCurrency: captureValidation.expectedCurrency,
      actualCurrency: captureValidation.actualCurrency,
    });
    return;
  }
  const amountMismatch = getAmountMismatch(payment, curlecPayment);

  await db.gatewayPayment.update({
    where: { id: payment.id },
    data: {
      curlec_payment_id: curlecPayment.id,
      method: curlecPayment.method,
    },
  });

  if (amountMismatch) {
    await holdIssuerFeeCaptureMismatch(db, payment, {
      mismatchType: "AMOUNT_MISMATCH",
      reason: `${AMOUNT_MISMATCH_ERROR}: expected ${amountMismatch.expectedSen} sen, got ${amountMismatch.actualSen} sen`,
      curlecPaymentId: curlecPayment.id,
      curlecOrderId: input.orderId,
      expectedSen: amountMismatch.expectedSen,
      actualSen: amountMismatch.actualSen,
    });
    await markWebhookProcessed(db, input.eventId, AMOUNT_MISMATCH_ERROR, routeGatewayAccount);
    logger.warn(
      {
        eventId: input.eventId,
        gatewayPaymentId: payment.id,
        orderId: input.orderId,
        expectedSen: amountMismatch.expectedSen,
        actualSen: amountMismatch.actualSen,
      },
      "Application processing fee held due to Curlec amount mismatch"
    );
    return;
  }

  await db.$transaction(async (tx) => {
    const statusAfterClaim = await claimCaptureToPaid(tx, payment.id);
    if (!statusAfterClaim || statusAfterClaim !== GatewayPaymentStatus.PAID) {
      return;
    }

    const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    await completeProcessingFeePayment(tx, current);
  });

  await markWebhookProcessed(db, input.eventId, null, routeGatewayAccount);

  logger.info(
    {
      eventId: input.eventId,
      gatewayPaymentId: payment.id,
      gatewayAccount: payment.gatewayAccount,
      orderId: input.orderId,
    },
    "Application processing fee webhook processed"
  );
}

async function markGatewayPaymentFailedByOrderId(
  db: PrismaClient,
  orderId: string,
  gatewayAccount: CurlecGatewayAccount,
  curlecPaymentId?: string,
  method?: string | null
): Promise<GatewayPayment | null> {
  const payment = await db.gatewayPayment.findFirst({
    where: { curlec_order_id: orderId, gatewayAccount },
  });

  if (!payment || TERMINAL_GATEWAY_STATUSES.has(payment.status)) {
    return payment;
  }

  if (payment.status !== GatewayPaymentStatus.CREATED) {
    return payment;
  }

  assertTransition(payment.status, GatewayPaymentStatus.FAILED);

  return db.gatewayPayment.update({
    where: { id: payment.id },
    data: {
      status: GatewayPaymentStatus.FAILED,
      curlec_payment_id: curlecPaymentId ?? payment.curlec_payment_id,
      method: method ?? payment.method,
    },
  });
}

/**
 * Reconcile a non-terminal gateway payment with Curlec order payments.
 * Used when the user returns from FPX before webhooks arrive.
 */
export async function syncGatewayPaymentFromCurlec(
  payment: GatewayPayment,
  db: PrismaClient = defaultPrisma
): Promise<GatewayPayment> {
  if (isCaptureSkippableStatus(payment.status)) {
    return payment;
  }

  const curlecClient = createCurlecClient({ gatewayAccount: payment.gatewayAccount });
  let orderPayments;
  try {
    orderPayments = await curlecClient.fetchOrderPayments(payment.curlec_order_id);
  } catch (error) {
    logger.warn(
      {
        gatewayPaymentId: payment.id,
        gatewayAccount: payment.gatewayAccount,
        orderId: payment.curlec_order_id,
        error: error instanceof Error ? error.message : String(error),
      },
      "Curlec order payments sync failed"
    );
    return payment;
  }

  const payments = Array.isArray(orderPayments) ? orderPayments : [];

  if (payments.length === 0) {
    return payment;
  }

  const latest = [...payments].sort(
    (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
  )[0];

  if (latest.status === "failed") {
    const updated = await markGatewayPaymentFailedByOrderId(
      db,
      payment.curlec_order_id,
      payment.gatewayAccount,
      latest.id,
      latest.method
    );
    return updated ?? payment;
  }

  if (latest.status === "captured") {
    await processGatewayPaymentCapture(
      {
        orderId: payment.curlec_order_id,
        paymentId: latest.id,
        eventId: `sync:${payment.id}:${latest.id}`,
        routeGatewayAccount: payment.gatewayAccount,
      },
      db
    );
    return db.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
  }

  return payment;
}

async function completeOnboardingFeePayment(
  tx: Prisma.TransactionClient,
  gatewayPayment: GatewayPayment
) {
  assertTransition(gatewayPayment.status, GatewayPaymentStatus.COMPLETED);

  if (!gatewayPayment.issuer_organization_id) {
    throw new AppError(
      500,
      "GATEWAY_PAYMENT_INVALID",
      "Issuer onboarding fee is missing organization"
    );
  }

  const amount = gatewayPayment.amount.toNumber();
  const orgId = gatewayPayment.issuer_organization_id;

  await tx.issuerOrganization.update({
    where: { id: orgId },
    data: { onboarding_fee_paid_at: new Date() },
  });

  await postLedgerEntry(tx, {
    accountCode: "OPERATING_ACCOUNT",
    direction: NoteLedgerDirection.CREDIT,
    amount,
    description: "Issuer onboarding fee received into operating account",
    idempotencyKey: `gateway-onboarding-fee:ledger:${gatewayPayment.id}`,
    gatewayPaymentId: gatewayPayment.id,
    metadata: {
      gatewayPaymentId: gatewayPayment.id,
      issuerOrganizationId: orgId,
      curlecOrderId: gatewayPayment.curlec_order_id,
      curlecPaymentId: gatewayPayment.curlec_payment_id,
    },
  });

  await tx.gatewayPayment.update({
    where: { id: gatewayPayment.id },
    data: { status: GatewayPaymentStatus.COMPLETED },
  });
}

async function completeProcessingFeePayment(
  tx: Prisma.TransactionClient,
  gatewayPayment: GatewayPayment
) {
  assertTransition(gatewayPayment.status, GatewayPaymentStatus.COMPLETED);

  if (!gatewayPayment.application_id) {
    throw new AppError(
      500,
      "GATEWAY_PAYMENT_INVALID",
      "Application processing fee is missing application"
    );
  }

  const amount = gatewayPayment.amount.toNumber();

  await postLedgerEntry(tx, {
    accountCode: "OPERATING_ACCOUNT",
    direction: NoteLedgerDirection.CREDIT,
    amount,
    description: "Application processing fee received into operating account",
    idempotencyKey: `gateway-processing-fee:ledger:${gatewayPayment.id}`,
    gatewayPaymentId: gatewayPayment.id,
    metadata: {
      gatewayPaymentId: gatewayPayment.id,
      applicationId: gatewayPayment.application_id,
      issuerOrganizationId: gatewayPayment.issuer_organization_id,
      curlecOrderId: gatewayPayment.curlec_order_id,
      curlecPaymentId: gatewayPayment.curlec_payment_id,
    },
  });

  await tx.gatewayPayment.update({
    where: { id: gatewayPayment.id },
    data: { status: GatewayPaymentStatus.COMPLETED },
  });
}

/**
 * Record-only Curlec webhook ingress (M3): verify signature, parse payload, dedupe by event_id.
 * Business processing (M5+) runs separately via processStoredCurlecWebhook.
 */
export async function ingestCurlecWebhook(
  input: IngestCurlecWebhookInput,
  db: PrismaClient = defaultPrisma
): Promise<IngestCurlecWebhookResult> {
  const {
    rawBody,
    signature,
    eventId,
    gatewayAccount = CurlecGatewayAccount.LEGACY_DEFAULT,
  } = input;

  if (!eventId?.trim()) {
    throw new AppError(400, "INVALID_WEBHOOK", "Missing X-Razorpay-Event-Id header");
  }

  const config = getCurlecConfig(gatewayAccount);
  if (!config.webhookSecret) {
    throw new AppError(
      401,
      "INVALID_SIGNATURE",
      "Curlec webhook secret is not configured"
    );
  }

  if (!signature?.trim()) {
    throw new AppError(401, "INVALID_SIGNATURE", "Missing X-Razorpay-Signature header");
  }

  const signatureValid = verifyCurlecWebhookSignature(
    rawBody,
    signature.trim(),
    config.webhookSecret
  );

  if (!signatureValid) {
    throw new AppError(401, "INVALID_SIGNATURE", "Invalid Curlec webhook signature");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new AppError(400, "INVALID_WEBHOOK", "Webhook body must be valid JSON");
  }

  const payload = (() => {
    try {
      return curlecWebhookPayloadSchema.parse(parsed);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AppError(400, "INVALID_WEBHOOK", "Webhook payload failed validation");
      }
      throw error;
    }
  })();
  const normalizedEventId = eventId.trim();

  try {
    const inserted = await db.gatewayWebhookEvent.createMany({
      data: [
        {
          event_id: normalizedEventId,
          event_type: payload.event,
          gatewayAccount,
          payload: payload as Prisma.InputJsonValue,
          signature_valid: true,
        },
      ],
      skipDuplicates: true,
    });

    if (inserted.count === 0) {
      logger.info(
        { eventId: normalizedEventId, eventType: payload.event, gatewayAccount },
        "Curlec webhook duplicate ignored"
      );

      return {
        eventId: normalizedEventId,
        eventType: payload.event,
        duplicate: true,
        gatewayAccount,
      };
    }

    logger.info(
      { eventId: normalizedEventId, eventType: payload.event, gatewayAccount },
      "Curlec webhook event stored"
    );

    return {
      eventId: normalizedEventId,
      eventType: payload.event,
      duplicate: false,
      gatewayAccount,
    };
  } catch (error) {
    logger.error(
      {
        eventId: normalizedEventId,
        gatewayAccount,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to persist Curlec webhook event"
    );
    throw new AppError(500, "WEBHOOK_STORE_FAILED", "Failed to store webhook event");
  }
}
