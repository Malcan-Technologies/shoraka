import {
  GatewayPayment,
  GatewayPaymentEventType,
  GatewayPaymentStatus,
  PrismaClient,
} from "@prisma/client";
import { prisma as defaultPrisma } from "../prisma";
import { logger } from "../logger";
import { recordGatewayPaymentEvent } from "../../modules/payment/gateway-events";
import { assertTransition } from "../../modules/payment/state";
import { syncGatewayPaymentFromCurlec } from "../../modules/payment/webhook-service";

const STALE_CREATED_MINUTES = 60;
const CRON_CORRELATION_ID = "cron:gateway-stuck-order-poller";

export type GatewayStuckOrderPollerResult = {
  scanned: number;
  recovered: number;
  expired: number;
  errors: Array<{ gatewayPaymentId: string; error: string }>;
};

export type StaleGatewayPaymentOutcome = "recovered" | "expired" | "unchanged";

export async function processStaleGatewayPayment(
  payment: GatewayPayment,
  db: PrismaClient = defaultPrisma
): Promise<StaleGatewayPaymentOutcome> {
  const beforeStatus = payment.status;
  const synced = await syncGatewayPaymentFromCurlec(payment, db);

  if (synced.status !== GatewayPaymentStatus.CREATED) {
    logger.info(
      {
        gatewayPaymentId: payment.id,
        fromStatus: beforeStatus,
        toStatus: synced.status,
        correlationId: CRON_CORRELATION_ID,
      },
      "Stuck-order poller recovered gateway payment from Curlec"
    );
    return "recovered";
  }

  let expired = false;
  await db.$transaction(async (tx) => {
    const current = await tx.gatewayPayment.findUnique({ where: { id: payment.id } });
    if (!current || current.status !== GatewayPaymentStatus.CREATED) {
      return;
    }

    assertTransition(current.status, GatewayPaymentStatus.EXPIRED);
    await tx.gatewayPayment.update({
      where: { id: payment.id },
      data: { status: GatewayPaymentStatus.EXPIRED },
    });
    await recordGatewayPaymentEvent(tx, {
      gatewayPaymentId: payment.id,
      type: GatewayPaymentEventType.EXPIRED,
      fromStatus: GatewayPaymentStatus.CREATED,
      toStatus: GatewayPaymentStatus.EXPIRED,
      reason: `Abandoned checkout — no Curlec capture after ${STALE_CREATED_MINUTES} minutes`,
    });
    expired = true;
  });

  if (expired) {
    logger.info(
      { gatewayPaymentId: payment.id, correlationId: CRON_CORRELATION_ID },
      "Stuck-order poller expired abandoned gateway payment"
    );
    return "expired";
  }

  return "unchanged";
}

export async function runGatewayStuckOrderPollerJob(
  db: PrismaClient = defaultPrisma
): Promise<GatewayStuckOrderPollerResult> {
  const result: GatewayStuckOrderPollerResult = {
    scanned: 0,
    recovered: 0,
    expired: 0,
    errors: [],
  };

  const cutoff = new Date(Date.now() - STALE_CREATED_MINUTES * 60 * 1000);

  const stalePayments = await db.gatewayPayment.findMany({
    where: {
      status: GatewayPaymentStatus.CREATED,
      created_at: { lte: cutoff },
    },
    orderBy: { created_at: "asc" },
    take: 100,
  });

  result.scanned = stalePayments.length;

  for (const payment of stalePayments) {
    try {
      const outcome = await processStaleGatewayPayment(payment, db);
      if (outcome === "recovered") {
        result.recovered += 1;
      } else if (outcome === "expired") {
        result.expired += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push({ gatewayPaymentId: payment.id, error: message });
      logger.error(
        { gatewayPaymentId: payment.id, error: message, correlationId: CRON_CORRELATION_ID },
        "Stuck-order poller failed for gateway payment"
      );
    }
  }

  if (result.scanned > 0) {
    logger.info(
      {
        scanned: result.scanned,
        recovered: result.recovered,
        expired: result.expired,
        errors: result.errors.length,
        correlationId: CRON_CORRELATION_ID,
      },
      "Gateway stuck-order poller completed"
    );
  }

  return result;
}
