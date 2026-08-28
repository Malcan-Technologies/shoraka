import {
  GatewayPayment,
  GatewayPaymentEventType,
  GatewayPaymentStatus,
  PrismaClient,
} from "@prisma/client";
import { prisma as defaultPrisma } from "../prisma";
import { logger } from "../logger";
import { systemAuditContext } from "../audit";
import { recordGatewayPaymentEvent } from "../../modules/payment/gateway-events";
import { assertTransition } from "../../modules/payment/state";
import { syncGatewayPaymentFromCurlec } from "../../modules/payment/webhook-service";
import { recoverHeldAmountMismatchRefunds } from "../../modules/payment/amount-mismatch-service";
import {
  reconcilePendingGatewayRefunds,
  recoverFailedWalletReversals,
} from "../../modules/payment/refund-service";

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
  db: PrismaClient = defaultPrisma,
  context = systemAuditContext({ correlationId: CRON_CORRELATION_ID })
): Promise<StaleGatewayPaymentOutcome> {
  const beforeStatus = payment.status;
  const synced = await syncGatewayPaymentFromCurlec(payment, db, context);

  if (synced.status !== GatewayPaymentStatus.CREATED) {
    logger.info(
      {
        gatewayPaymentId: payment.id,
        gatewayAccount: payment.gatewayAccount,
        curlecOrderId: payment.curlec_order_id,
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
      context,
    });
    expired = true;
  });

  if (expired) {
    logger.info(
      {
        gatewayPaymentId: payment.id,
        gatewayAccount: payment.gatewayAccount,
        curlecOrderId: payment.curlec_order_id,
        correlationId: CRON_CORRELATION_ID,
      },
      "Stuck-order poller expired abandoned gateway payment"
    );
    return "expired";
  }

  return "unchanged";
}

export async function runGatewayStuckOrderPollerJob(
  db: PrismaClient = defaultPrisma
): Promise<GatewayStuckOrderPollerResult> {
  const pollerContext = systemAuditContext({ correlationId: CRON_CORRELATION_ID });
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
      const outcome = await processStaleGatewayPayment(payment, db, pollerContext);
      if (outcome === "recovered") {
        result.recovered += 1;
      } else if (outcome === "expired") {
        result.expired += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push({ gatewayPaymentId: payment.id, error: message });
      logger.error(
        {
          gatewayPaymentId: payment.id,
          gatewayAccount: payment.gatewayAccount,
          curlecOrderId: payment.curlec_order_id,
          error: message,
          correlationId: CRON_CORRELATION_ID,
        },
        "Stuck-order poller failed for gateway payment"
      );
    }
  }

  try {
    const mismatchRecovery = await recoverHeldAmountMismatchRefunds(db, 50, pollerContext);
    result.scanned += mismatchRecovery.scanned;
    result.recovered += mismatchRecovery.recovered;
    for (const err of mismatchRecovery.errors) {
      result.errors.push({ gatewayPaymentId: err.id, error: err.error });
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        correlationId: CRON_CORRELATION_ID,
      },
      "Stuck-order poller failed recovering held amount-mismatch refunds"
    );
  }

  try {
    const refundRecon = await reconcilePendingGatewayRefunds(db, 50, pollerContext);
    result.scanned += refundRecon.scanned;
    result.recovered += refundRecon.refunded;
    for (const err of refundRecon.errors) {
      result.errors.push({ gatewayPaymentId: err.id, error: err.error });
    }
    if (refundRecon.scanned > 0) {
      logger.info(
        {
          scanned: refundRecon.scanned,
          refunded: refundRecon.refunded,
          held: refundRecon.held,
          pending: refundRecon.pending,
          errors: refundRecon.errors.length,
          correlationId: CRON_CORRELATION_ID,
        },
        "Reconciled pending gateway refunds against Curlec"
      );
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        correlationId: CRON_CORRELATION_ID,
      },
      "Stuck-order poller failed reconciling pending gateway refunds"
    );
  }

  try {
    const walletRecovery = await recoverFailedWalletReversals(db, 50, pollerContext);
    result.scanned += walletRecovery.scanned;
    result.recovered += walletRecovery.recovered;
    for (const err of walletRecovery.errors) {
      result.errors.push({ gatewayPaymentId: err.id, error: err.error });
    }
    if (walletRecovery.scanned > 0) {
      logger.info(
        {
          scanned: walletRecovery.scanned,
          recovered: walletRecovery.recovered,
          stillHeld: walletRecovery.stillHeld,
          errors: walletRecovery.errors.length,
          correlationId: CRON_CORRELATION_ID,
        },
        "Recovered failed wallet reversals after confirmed Curlec refunds"
      );
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        correlationId: CRON_CORRELATION_ID,
      },
      "Stuck-order poller failed recovering wallet reversals"
    );
  }

  if (result.scanned > 0 || result.errors.length > 0) {
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
