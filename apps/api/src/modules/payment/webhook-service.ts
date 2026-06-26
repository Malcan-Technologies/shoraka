import {
  GatewayPayment,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  NameCheckResult,
  NoteLedgerDirection,
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
  resolveInvestorExpectedName,
} from "./deposit-service";
import { verifyCurlecWebhookSignature } from "./curlec-signature";
import { createCurlecClient } from "./curlec-client";
import {
  extractBankCodeFromPayment,
  extractPayerNameFromPayment,
} from "./curlec-schemas";
import { runNameCheck } from "./name-check";
import { assertTransition, TERMINAL_GATEWAY_STATUSES } from "./state";
import {
  curlecWebhookPayloadSchema,
  extractDepositCaptureRefs,
  extractPaymentFailedRefs,
  type CurlecWebhookPayload,
} from "./webhook-schemas";

export type IngestCurlecWebhookInput = {
  rawBody: string;
  signature: string | undefined;
  eventId: string | undefined;
};

export type IngestCurlecWebhookResult = {
  eventId: string;
  eventType: string;
  duplicate: boolean;
};

const DEPOSIT_CAPTURE_EVENTS = new Set(["payment.captured", "order.paid"]);

async function markWebhookProcessed(
  db: PrismaClient,
  eventId: string,
  error?: string | null
) {
  // Sync-from-Curlec paths do not ingest a webhook row first.
  if (eventId.startsWith("sync:")) {
    return;
  }

  await db.gatewayWebhookEvent.update({
    where: { event_id: eventId },
    data: {
      processed_at: new Date(),
      error: error ?? null,
    },
  });
}

async function claimCreatedToPaid(
  tx: Prisma.TransactionClient,
  gatewayPaymentId: string
): Promise<GatewayPaymentStatus | null> {
  const claimed = await tx.gatewayPayment.updateMany({
    where: { id: gatewayPaymentId, status: GatewayPaymentStatus.CREATED },
    data: { status: GatewayPaymentStatus.PAID },
  });

  if (claimed.count === 1) {
    return GatewayPaymentStatus.PAID;
  }

  const current = await tx.gatewayPayment.findUnique({
    where: { id: gatewayPaymentId },
    select: { status: true },
  });
  return current?.status ?? null;
}

export async function processInvestorDepositCapture(
  input: { orderId: string; paymentId: string; eventId: string },
  db: PrismaClient = defaultPrisma
): Promise<void> {
  const payment = await db.gatewayPayment.findUnique({
    where: { curlec_order_id: input.orderId },
    include: { investor_organization: true },
  });

  if (!payment) {
    await markWebhookProcessed(db, input.eventId);
    return;
  }

  if (TERMINAL_GATEWAY_STATUSES.has(payment.status)) {
    await markWebhookProcessed(db, input.eventId);
    return;
  }

  const curlecClient = createCurlecClient();
  const curlecPayment = await curlecClient.fetchPayment(input.paymentId);
  const payerName = extractPayerNameFromPayment(curlecPayment);
  const bankCode = extractBankCodeFromPayment(curlecPayment);

  await db.gatewayPayment.update({
    where: { id: payment.id },
    data: {
      curlec_payment_id: curlecPayment.id,
      method: curlecPayment.method,
      bank_code: bankCode,
      payer_name: payerName,
    },
  });

  const expectedName = payment.investor_organization
    ? resolveInvestorExpectedName(payment.investor_organization)
    : null;
  const nameCheckResult = runNameCheck({ expectedName, payerName });

  await db.$transaction(async (tx) => {
    const statusAfterClaim = await claimCreatedToPaid(tx, payment.id);
    if (!statusAfterClaim) {
      return;
    }

    if (TERMINAL_GATEWAY_STATUSES.has(statusAfterClaim)) {
      return;
    }

    if (statusAfterClaim !== GatewayPaymentStatus.PAID) {
      return;
    }

    const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });

    if (nameCheckResult === NameCheckResult.PASS) {
      await creditCompletedDeposit(tx, current, { nameCheckResult: NameCheckResult.PASS });
      return;
    }

    if (nameCheckResult === NameCheckResult.FAIL) {
      assertTransition(GatewayPaymentStatus.PAID, GatewayPaymentStatus.HELD);
      await tx.gatewayPayment.update({
        where: { id: payment.id },
        data: {
          status: GatewayPaymentStatus.HELD,
          name_check_result: NameCheckResult.FAIL,
          name_check_at: new Date(),
        },
      });
      return;
    }

    assertTransition(GatewayPaymentStatus.PAID, GatewayPaymentStatus.NAME_CHECK_PENDING);
    await tx.gatewayPayment.update({
      where: { id: payment.id },
      data: {
        status: GatewayPaymentStatus.NAME_CHECK_PENDING,
        name_check_result: NameCheckResult.NAME_UNAVAILABLE,
        name_check_at: new Date(),
      },
    });
  });

  await markWebhookProcessed(db, input.eventId);

  logger.info(
    {
      eventId: input.eventId,
      gatewayPaymentId: payment.id,
      nameCheckResult,
      orderId: input.orderId,
    },
    "Investor deposit webhook processed"
  );
}

export async function processStoredCurlecWebhook(
  eventId: string,
  db: PrismaClient = defaultPrisma
): Promise<void> {
  const stored = await db.gatewayWebhookEvent.findUnique({ where: { event_id: eventId } });
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
      await markWebhookProcessed(db, eventId, "Invalid stored payload");
      return;
    }
    throw error;
  }

  if (!DEPOSIT_CAPTURE_EVENTS.has(payload.event)) {
    if (payload.event === "payment.failed") {
      const failed = extractPaymentFailedRefs(payload);
      if (failed) {
        await markGatewayPaymentFailedByOrderId(
          db,
          failed.orderId,
          failed.paymentId
        );
      }
      await markWebhookProcessed(
        db,
        eventId,
        failed ? null : "Missing payment references"
      );
      return;
    }

    await markWebhookProcessed(db, eventId);
    return;
  }

  const capture = extractDepositCaptureRefs(payload);
  if (!capture) {
    await markWebhookProcessed(db, eventId, "Missing order/payment references");
    return;
  }

  let paymentId = capture.paymentId;
  if (!paymentId) {
    const curlecClient = createCurlecClient();
    const payments = await curlecClient.fetchOrderPayments(capture.orderId);
    const captured =
      payments.find((payment) => payment.status === "captured") ?? payments.at(0);
    if (!captured) {
      await markWebhookProcessed(db, eventId, "No payments found for paid order");
      return;
    }
    paymentId = captured.id;
  }

  await processGatewayPaymentCapture(
    { orderId: capture.orderId, paymentId, eventId },
    db
  );
}

async function processGatewayPaymentCapture(
  input: { orderId: string; paymentId: string; eventId: string },
  db: PrismaClient
): Promise<void> {
  const payment = await db.gatewayPayment.findUnique({
    where: { curlec_order_id: input.orderId },
    select: { purpose: true },
  });

  if (!payment) {
    await markWebhookProcessed(db, input.eventId, "Gateway payment not found for order");
    return;
  }

  switch (payment.purpose) {
    case GatewayPaymentPurpose.INVESTOR_DEPOSIT:
      await processInvestorDepositCapture(input, db);
      return;
    case GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE:
      await processOnboardingFeeCapture(input, db);
      return;
    default:
      await markWebhookProcessed(db, input.eventId);
  }
}

export async function processOnboardingFeeCapture(
  input: { orderId: string; paymentId: string; eventId: string },
  db: PrismaClient = defaultPrisma
): Promise<void> {
  const payment = await db.gatewayPayment.findUnique({
    where: { curlec_order_id: input.orderId },
  });

  if (!payment) {
    await markWebhookProcessed(db, input.eventId);
    return;
  }

  if (TERMINAL_GATEWAY_STATUSES.has(payment.status)) {
    await markWebhookProcessed(db, input.eventId);
    return;
  }

  const curlecClient = createCurlecClient();
  const curlecPayment = await curlecClient.fetchPayment(input.paymentId);

  await db.gatewayPayment.update({
    where: { id: payment.id },
    data: {
      curlec_payment_id: curlecPayment.id,
      method: curlecPayment.method,
    },
  });

  await db.$transaction(async (tx) => {
    const statusAfterClaim = await claimCreatedToPaid(tx, payment.id);
    if (!statusAfterClaim || statusAfterClaim !== GatewayPaymentStatus.PAID) {
      return;
    }

    const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    await completeOnboardingFeePayment(tx, current);
  });

  await markWebhookProcessed(db, input.eventId);

  logger.info(
    {
      eventId: input.eventId,
      gatewayPaymentId: payment.id,
      orderId: input.orderId,
    },
    "Issuer onboarding fee webhook processed"
  );
}

async function markGatewayPaymentFailedByOrderId(
  db: PrismaClient,
  orderId: string,
  curlecPaymentId?: string,
  method?: string | null
): Promise<GatewayPayment | null> {
  const payment = await db.gatewayPayment.findUnique({
    where: { curlec_order_id: orderId },
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
  if (TERMINAL_GATEWAY_STATUSES.has(payment.status)) {
    return payment;
  }

  const curlecClient = createCurlecClient();
  let orderPayments;
  try {
    orderPayments = await curlecClient.fetchOrderPayments(payment.curlec_order_id);
  } catch (error) {
    logger.warn(
      {
        gatewayPaymentId: payment.id,
        orderId: payment.curlec_order_id,
        error: error instanceof Error ? error.message : String(error),
      },
      "Curlec order payments sync failed"
    );
    return payment;
  }

  if (orderPayments.length === 0) {
    return payment;
  }

  const latest = [...orderPayments].sort(
    (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
  )[0];

  if (latest.status === "failed") {
    const updated = await markGatewayPaymentFailedByOrderId(
      db,
      payment.curlec_order_id,
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

/**
 * Record-only Curlec webhook ingress (M3): verify signature, parse payload, dedupe by event_id.
 * Business processing (M5+) runs separately via processStoredCurlecWebhook.
 */
export async function ingestCurlecWebhook(
  input: IngestCurlecWebhookInput,
  db: PrismaClient = defaultPrisma
): Promise<IngestCurlecWebhookResult> {
  const { rawBody, signature, eventId } = input;

  if (!eventId?.trim()) {
    throw new AppError(400, "INVALID_WEBHOOK", "Missing X-Razorpay-Event-Id header");
  }

  const config = getCurlecConfig();
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
          payload: payload as Prisma.InputJsonValue,
          signature_valid: true,
        },
      ],
      skipDuplicates: true,
    });

    if (inserted.count === 0) {
      logger.info(
        { eventId: normalizedEventId, eventType: payload.event },
        "Curlec webhook duplicate ignored"
      );

      return {
        eventId: normalizedEventId,
        eventType: payload.event,
        duplicate: true,
      };
    }

    logger.info(
      { eventId: normalizedEventId, eventType: payload.event },
      "Curlec webhook event stored"
    );

    return {
      eventId: normalizedEventId,
      eventType: payload.event,
      duplicate: false,
    };
  } catch (error) {
    logger.error(
      {
        eventId: normalizedEventId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to persist Curlec webhook event"
    );
    throw new AppError(500, "WEBHOOK_STORE_FAILED", "Failed to store webhook event");
  }
}
