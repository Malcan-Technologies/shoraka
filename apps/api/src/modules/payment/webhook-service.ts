import { Prisma, PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import { getCurlecConfig } from "../../config/curlec";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { verifyCurlecWebhookSignature } from "./curlec-signature";
import { curlecWebhookPayloadSchema } from "./webhook-schemas";

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

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

/**
 * Record-only Curlec webhook ingress (M3): verify signature, parse payload, dedupe by event_id.
 * No payment status changes or wallet effects — those land in M5+.
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
    await db.gatewayWebhookEvent.create({
      data: {
        event_id: normalizedEventId,
        event_type: payload.event,
        payload: payload as Prisma.InputJsonValue,
        signature_valid: true,
      },
    });

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
    if (isUniqueConstraintError(error)) {
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
