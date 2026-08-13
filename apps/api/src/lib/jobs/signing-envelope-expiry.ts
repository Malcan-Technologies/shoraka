/**
 * Signing envelope expiry job: closes active envelopes whose expires_at has passed.
 * This keeps stale packages and external signing links from remaining operational.
 */
import { prisma } from "../prisma";
import { logger } from "../logger";
import {
  expireSigningEnvelopeInTx,
  SIGNING_EXPIRY_TRIGGER,
} from "../../modules/signing/expire-envelope";

export type SigningEnvelopeExpiryResult = {
  expiredEnvelopeIds: string[];
};

const ACTIVE_ENVELOPE_STATUSES = ["DRAFT", "SENT", "IN_PROGRESS"] as const;

export async function runSigningEnvelopeExpiryJob(): Promise<SigningEnvelopeExpiryResult> {
  const now = new Date();
  const expired = await prisma.signingEnvelope.findMany({
    where: {
      expires_at: { lte: now },
      status: { in: [...ACTIVE_ENVELOPE_STATUSES] },
    },
    select: {
      id: true,
      status: true,
      expires_at: true,
      application_id: true,
    },
  });

  const expiredEnvelopeIds: string[] = [];
  for (const envelope of expired) {
    const won = await prisma.$transaction(async (tx) =>
      expireSigningEnvelopeInTx(tx, {
        envelopeId: envelope.id,
        previousStatus: envelope.status,
        expiresAt: envelope.expires_at,
        trigger: SIGNING_EXPIRY_TRIGGER.ENVELOPE_CLOCK,
        applicationId: envelope.application_id,
      })
    );
    if (won) expiredEnvelopeIds.push(envelope.id);
  }

  if (expiredEnvelopeIds.length > 0) {
    logger.info({ expiredEnvelopeCount: expiredEnvelopeIds.length }, "Expired signing envelopes");
  }
  return { expiredEnvelopeIds };
}
