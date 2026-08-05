/**
 * Reconcile signing envelopes stuck without stored PDFs and stale trust-return sessions.
 */
import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";
import { logger } from "../logger";
import { signingService } from "../../modules/signing/service";

export type SigningReconcileResult = {
  syncedEnvelopeIds: string[];
  pdfStoredDocumentIds: string[];
  staleTrustReturnRecipientIds: string[];
  errors: string[];
};

const TRUST_RETURN_SESSION_MAX_MS = 2 * 60 * 60 * 1000;

function readTrustReturnStartedAt(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const session = (metadata as Record<string, unknown>).last_signing_session;
  if (!session || typeof session !== "object") return null;
  const startedAt = (session as Record<string, unknown>).startedAt;
  if (typeof startedAt !== "string" || !startedAt.trim()) return null;
  const ms = Date.parse(startedAt);
  return Number.isFinite(ms) ? ms : null;
}

export async function runSigningReconcileJob(): Promise<SigningReconcileResult> {
  const result: SigningReconcileResult = {
    syncedEnvelopeIds: [],
    pdfStoredDocumentIds: [],
    staleTrustReturnRecipientIds: [],
    errors: [],
  };

  const completedWithoutPdf = await prisma.signingEnvelope.findMany({
    where: {
      status: "COMPLETED",
      documents: {
        some: {
          provider_contract_ref: { not: null },
          signed_s3_key: null,
          status: "COMPLETED",
        },
      },
    },
    select: { id: true },
  });

  for (const row of completedWithoutPdf) {
    try {
      await signingService.syncEnvelopeFromProvider(row.id);
      result.syncedEnvelopeIds.push(row.id);
    } catch (err) {
      result.errors.push(
        `sync ${row.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  const staleTrustReturns = await prisma.signingRecipient.findMany({
    where: {
      status: { in: ["SENT", "VIEWED"] },
      NOT: { metadata: { equals: Prisma.DbNull } },
    },
    select: { id: true, metadata: true, envelope_id: true },
  });

  const now = Date.now();
  for (const recipient of staleTrustReturns) {
    const startedAtMs = readTrustReturnStartedAt(recipient.metadata);
    if (startedAtMs == null) continue;
    if (now - startedAtMs <= TRUST_RETURN_SESSION_MAX_MS) continue;

    try {
      await signingService.syncEnvelopeFromProvider(recipient.envelope_id);
      result.staleTrustReturnRecipientIds.push(recipient.id);
    } catch (err) {
      result.errors.push(
        `trust-return ${recipient.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (
    result.syncedEnvelopeIds.length > 0 ||
    result.staleTrustReturnRecipientIds.length > 0 ||
    result.errors.length > 0
  ) {
    logger.info(result, "Signing reconcile job completed");
  }

  return result;
}
