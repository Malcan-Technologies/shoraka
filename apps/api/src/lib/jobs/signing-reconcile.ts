/**
 * Reconcile signing envelopes stuck without stored PDFs, completed envelopes
 * still linked to an OFFER_SENT contract/invoice, and stale trust-return sessions.
 */
import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";
import { logger } from "../logger";
import { systemAuditContext } from "../audit";
import { signingService } from "../../modules/signing/service";

export type SigningReconcileResult = {
  /** COMPLETED envelopes missing a signed PDF that were synced. */
  syncedEnvelopeIds: string[];
  /** OFFER_SENT candidates whose linked contract/invoice left OFFER_SENT after sync. */
  finalizedEnvelopeIds: string[];
  pdfStoredDocumentIds: string[];
  staleTrustReturnRecipientIds: string[];
  errors: string[];
};

const OFFER_SENT_RELATION: Prisma.SigningEnvelopeWhereInput = {
  OR: [{ contract: { status: "OFFER_SENT" } }, { invoice: { status: "OFFER_SENT" } }],
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

function uniqueEnvelopeRows(...groups: Array<Array<{ id: string }>>): Array<{ id: string }> {
  const seen = new Set<string>();
  const rows: Array<{ id: string }> = [];
  for (const group of groups) {
    for (const row of group) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
  }
  return rows;
}

export async function runSigningReconcileJob(): Promise<SigningReconcileResult> {
  const result: SigningReconcileResult = {
    syncedEnvelopeIds: [],
    finalizedEnvelopeIds: [],
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

  const completedOfferSent = await prisma.signingEnvelope.findMany({
    where: {
      status: "COMPLETED",
      ...OFFER_SENT_RELATION,
    },
    select: { id: true },
  });

  const missingPdfIds = new Set(completedWithoutPdf.map((row) => row.id));
  const offerSentIds = new Set(completedOfferSent.map((row) => row.id));
  const rows = uniqueEnvelopeRows(completedWithoutPdf, completedOfferSent);

  const jobContext = systemAuditContext({ correlationId: "cron:signing-reconcile" });

  for (const row of rows) {
    try {
      await signingService.syncEnvelopeFromProvider(row.id, { context: jobContext });
      if (missingPdfIds.has(row.id)) result.syncedEnvelopeIds.push(row.id);
      if (offerSentIds.has(row.id)) {
        const stillOfferSent = await prisma.signingEnvelope.findFirst({
          where: { id: row.id, ...OFFER_SENT_RELATION },
          select: { id: true },
        });
        if (stillOfferSent) {
          result.errors.push(`finalize ${row.id}: offer still OFFER_SENT after sync`);
        } else {
          result.finalizedEnvelopeIds.push(row.id);
        }
      }
    } catch (err) {
      result.errors.push(`sync ${row.id}: ${err instanceof Error ? err.message : String(err)}`);
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
      await signingService.syncEnvelopeFromProvider(recipient.envelope_id, {
        context: jobContext,
      });
      result.staleTrustReturnRecipientIds.push(recipient.id);
    } catch (err) {
      result.errors.push(
        `trust-return ${recipient.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (
    result.syncedEnvelopeIds.length > 0 ||
    result.finalizedEnvelopeIds.length > 0 ||
    result.staleTrustReturnRecipientIds.length > 0 ||
    result.errors.length > 0
  ) {
    logger.info(result, "Signing reconcile job completed");
  }

  return result;
}
