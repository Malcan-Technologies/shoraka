import {
  GatewayPayment,
  GatewayPaymentEventType,
  GatewayPaymentStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { logger } from "../../lib/logger";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { recordGatewayPaymentEvent } from "./gateway-events";
import { initiateGatewayPaymentRefund } from "./refund-service";

export type AmountMismatchInput = {
  expectedSen: number;
  actualSen: number;
  curlecPaymentId: string;
  curlecOrderId?: string | null;
  actorUserId?: string;
  /** When set, claim CREATED/EXPIRED → PAID before refund (fee late-capture paths). */
  claimCapture?: boolean;
};

function asObjectMetadata(metadata: GatewayPayment["metadata"]): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

/**
 * Shared amount-mismatch path for deposits and issuer fees:
 * record mismatch → block completion → auto full refund of captured amount.
 * Reuses REFUND_INITIATED as "Refund pending"; HELD only if Curlec refund fails.
 */
export async function handleGatewayPaymentAmountMismatch(
  payment: GatewayPayment,
  input: AmountMismatchInput,
  db: PrismaClient = defaultPrisma
): Promise<GatewayPaymentStatus> {
  if (
    payment.status === GatewayPaymentStatus.REFUND_INITIATED ||
    payment.status === GatewayPaymentStatus.REFUNDED
  ) {
    return payment.status;
  }

  if (input.expectedSen === input.actualSen) {
    throw new Error("handleGatewayPaymentAmountMismatch called without a mismatch");
  }

  if (!Number.isInteger(input.expectedSen) || !Number.isInteger(input.actualSen)) {
    throw new Error("Amount mismatch sen values must be integers");
  }

  if (input.actualSen <= 0) {
    throw new Error("Captured amount must be a positive integer sen value");
  }

  let working = payment;

  await db.$transaction(async (tx) => {
    const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });

    if (
      current.status === GatewayPaymentStatus.REFUND_INITIATED ||
      current.status === GatewayPaymentStatus.REFUNDED
    ) {
      working = current;
      return;
    }

    let fromStatus = current.status;

    if (input.claimCapture) {
      if (
        current.status === GatewayPaymentStatus.CREATED ||
        current.status === GatewayPaymentStatus.EXPIRED
      ) {
        const claimed = await tx.gatewayPayment.updateMany({
          where: {
            id: current.id,
            status: { in: [GatewayPaymentStatus.CREATED, GatewayPaymentStatus.EXPIRED] },
          },
          data: {
            status: GatewayPaymentStatus.PAID,
            curlec_payment_id: input.curlecPaymentId,
          },
        });
        if (claimed.count !== 1) {
          const refreshed = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: current.id } });
          working = refreshed;
          return;
        }
        fromStatus = GatewayPaymentStatus.PAID;
      } else if (current.status === GatewayPaymentStatus.PAID) {
        fromStatus = GatewayPaymentStatus.PAID;
      } else if (current.status === GatewayPaymentStatus.HELD) {
        fromStatus = GatewayPaymentStatus.HELD;
      } else {
        working = current;
        return;
      }
    } else if (current.status !== GatewayPaymentStatus.PAID && current.status !== GatewayPaymentStatus.HELD) {
      working = current;
      return;
    }

    const latest = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: current.id } });
    const baseMetadata = asObjectMetadata(latest.metadata);

    // Idempotent: keep first mismatch snapshot; refresh retry bookkeeping only.
    const priorMismatch =
      (baseMetadata.amountMismatch as Record<string, unknown> | undefined) ??
      (baseMetadata.captureMismatch as Record<string, unknown> | undefined);

    const mismatchPayload = {
      mismatchType: "AMOUNT_MISMATCH",
      expectedSen: input.expectedSen,
      actualSen: input.actualSen,
      currency: latest.currency,
      purpose: latest.purpose,
      gatewayPaymentId: latest.id,
      curlecOrderId: input.curlecOrderId ?? latest.curlec_order_id,
      curlecPaymentId: input.curlecPaymentId,
      gatewayAccount: latest.gatewayAccount,
      detectedAt:
        typeof priorMismatch?.detectedAt === "string"
          ? priorMismatch.detectedAt
          : new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };

    await tx.gatewayPayment.update({
      where: { id: latest.id },
      data: {
        curlec_payment_id: input.curlecPaymentId,
        metadata: {
          ...baseMetadata,
          amountMismatch: mismatchPayload,
          // Keep captureMismatch key so existing fee "held mismatch" guards still match.
          captureMismatch: mismatchPayload,
        } as Prisma.InputJsonValue,
      },
    });

    if (!priorMismatch) {
      await recordGatewayPaymentEvent(tx, {
        gatewayPaymentId: latest.id,
        type: GatewayPaymentEventType.CAPTURE_MISMATCH,
        actorUserId: input.actorUserId,
        fromStatus,
        toStatus: fromStatus,
        reason: `Amount mismatch detected: expected ${input.expectedSen} sen, captured ${input.actualSen} sen`,
        metadata: {
          expectedSen: input.expectedSen,
          actualSen: input.actualSen,
          currency: latest.currency,
          purpose: latest.purpose,
          curlecPaymentId: input.curlecPaymentId,
          source: "automatic",
        },
      });
    }

    working = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: latest.id } });
  });

  if (
    working.status === GatewayPaymentStatus.REFUND_INITIATED ||
    working.status === GatewayPaymentStatus.REFUNDED
  ) {
    return working.status;
  }

  if (
    working.status !== GatewayPaymentStatus.PAID &&
    working.status !== GatewayPaymentStatus.HELD
  ) {
    logger.warn(
      {
        gatewayPaymentId: working.id,
        status: working.status,
        purpose: working.purpose,
      },
      "Amount mismatch recorded but payment not in refundable status"
    );
    return working.status;
  }

  const status = await initiateGatewayPaymentRefund(
    working,
    {
      reason: "AMOUNT_MISMATCH",
      curlecPaymentId: input.curlecPaymentId,
      actorUserId: input.actorUserId,
      amountSen: input.actualSen,
      adminReason: `Automatic full refund of captured amount (${input.actualSen} sen) after amount mismatch`,
    },
    db
  );

  logger.warn(
    {
      gatewayPaymentId: working.id,
      purpose: working.purpose,
      expectedSen: input.expectedSen,
      actualSen: input.actualSen,
      status,
    },
    "Gateway payment amount mismatch — automatic refund requested"
  );

  return status;
}

/**
 * Recover HELD amount-mismatch rows that never got a Curlec refund attempt.
 * Does not touch pending REFUND_INITIATED rows.
 */
export async function recoverHeldAmountMismatchRefunds(
  db: PrismaClient = defaultPrisma,
  limit = 50
): Promise<{ scanned: number; recovered: number; errors: Array<{ id: string; error: string }> }> {
  const held = await db.gatewayPayment.findMany({
    where: {
      status: GatewayPaymentStatus.HELD,
      refund_reference: null,
    },
    orderBy: { updated_at: "asc" },
    take: limit,
  });

  let recovered = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const payment of held) {
    const metadata = asObjectMetadata(payment.metadata);
    const mismatch =
      (metadata.amountMismatch as
        | { expectedSen?: number; actualSen?: number; curlecPaymentId?: string }
        | undefined) ??
      (metadata.captureMismatch as
        | { expectedSen?: number; actualSen?: number; curlecPaymentId?: string }
        | undefined);

    if (
      !mismatch ||
      typeof mismatch.expectedSen !== "number" ||
      typeof mismatch.actualSen !== "number" ||
      mismatch.expectedSen === mismatch.actualSen
    ) {
      continue;
    }

    const curlecPaymentId =
      (typeof mismatch.curlecPaymentId === "string" && mismatch.curlecPaymentId) ||
      payment.curlec_payment_id;

    if (!curlecPaymentId) {
      continue;
    }

    try {
      // Refund service handles HELD → REFUND_INITIATED transition.
      const status = await handleGatewayPaymentAmountMismatch(
        payment,
        {
          expectedSen: mismatch.expectedSen,
          actualSen: mismatch.actualSen,
          curlecPaymentId,
        },
        db
      );
      if (status === GatewayPaymentStatus.REFUND_INITIATED || status === GatewayPaymentStatus.REFUNDED) {
        recovered += 1;
      }
    } catch (error) {
      errors.push({
        id: payment.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { scanned: held.length, recovered, errors };
}
