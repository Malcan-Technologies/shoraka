/**
 * Signing envelope expiry job: closes active envelopes whose expires_at has passed.
 * This keeps stale packages and external signing links from remaining operational.
 */
import { prisma } from "../prisma";
import { logger } from "../logger";
import { systemAuditContext } from "../audit";
import { signingService } from "../../modules/signing/service";
import { OpsAlertSeverity, OpsAlertType } from "@prisma/client";
import { raiseOpsAlert } from "../../modules/ops-alerts/service";

export type SigningEnvelopeExpiryResult = {
  expiredEnvelopeIds: string[];
};

const ACTIVE_ENVELOPE_STATUSES = ["DRAFT", "SENT", "IN_PROGRESS"] as const;
const EXPIRY_CORRELATION_ID = "cron:signing-envelope-expiry";

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

  const context = systemAuditContext({ correlationId: EXPIRY_CORRELATION_ID });
  const expiredEnvelopeIds: string[] = [];
  for (const envelope of expired) {
    const closed = await signingService.expireEnvelope(envelope.id, { context });
    if (closed) {
      expiredEnvelopeIds.push(envelope.id);
      await raiseOpsAlert({
        type: OpsAlertType.SIGNING_EXPIRY,
        severity: OpsAlertSeverity.MEDIUM,
        dedupeKey: `signing-expiry:${envelope.id}`,
        title: "Signing package expired",
        summary: "An active signing envelope reached its expiry timestamp",
        entityType: "signing_envelope",
        entityId: envelope.id,
      });
    }
  }

  logger.info({ expiredEnvelopeCount: expiredEnvelopeIds.length }, "Expired signing envelopes");
  return { expiredEnvelopeIds };
}
