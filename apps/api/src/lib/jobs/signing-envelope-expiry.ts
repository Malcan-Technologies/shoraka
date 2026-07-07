/**
 * Signing envelope expiry job: closes active envelopes whose expires_at has passed.
 * This keeps stale packages and external signing links from remaining operational.
 */
import { prisma } from "../prisma";
import { logger } from "../logger";

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
    select: { id: true },
  });

  if (expired.length === 0) return { expiredEnvelopeIds: [] };

  const ids = expired.map((envelope) => envelope.id);
  await prisma.signingEnvelope.updateMany({
    where: { id: { in: ids } },
    data: { status: "EXPIRED" },
  });

  logger.info({ expiredEnvelopeCount: ids.length }, "Expired signing envelopes");
  return { expiredEnvelopeIds: ids };
}
