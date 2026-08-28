/**
 * Reconcile signing envelopes stuck without stored PDFs and stale trust-return sessions.
 */
import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";
import { logger } from "../logger";
import { systemAuditContext } from "../audit";
import { signingService } from "../../modules/signing/service";
import { OpsAlertSeverity, OpsAlertType } from "@prisma/client";
import { raiseOpsAlert } from "../../modules/ops-alerts/service";

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

  const jobContext = systemAuditContext({ correlationId: "cron:signing-reconcile" });

  for (const row of completedWithoutPdf) {
    try {
      await signingService.syncEnvelopeFromProvider(row.id, { context: jobContext });
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
    result.staleTrustReturnRecipientIds.length > 0 ||
    result.errors.length > 0
  ) {
    logger.info(result, "Signing reconcile job completed");
  }

  if (result.errors.length > 0) {
    await raiseOpsAlert({
      type: OpsAlertType.PROVIDER_FAILURE,
      severity: OpsAlertSeverity.HIGH,
      dedupeKey: "signing-reconcile:errors",
      title: "Signing provider reconcile errors",
      summary: result.errors[0],
      entityType: "job",
      entityId: "signing-reconcile",
      details: { errors: result.errors },
    });
  }

  await raiseMissingGuarantorAcceptanceAlerts();

  return result;
}

async function raiseMissingGuarantorAcceptanceAlerts(): Promise<void> {
  const completed = await prisma.signingEnvelope.findMany({
    where: {
      status: "COMPLETED",
      recipients: { some: { role_key: "guarantor" } },
    },
    select: {
      id: true,
      application_id: true,
      recipients: { where: { role_key: "guarantor" }, select: { id: true } },
    },
    take: 50,
    orderBy: { completed_at: "desc" },
  });

  for (const envelope of completed) {
    for (const recipient of envelope.recipients) {
      const accepted = await prisma.legalExternalAcceptance.findFirst({
        where: {
          source_type: "SIGNING_RECIPIENT",
          source_id: recipient.id,
          status: "ACCEPTED",
        },
        select: { id: true },
      });
      if (accepted) continue;
      await raiseOpsAlert({
        type: OpsAlertType.MISSING_LEGAL_EVIDENCE,
        severity: OpsAlertSeverity.HIGH,
        dedupeKey: `missing-legal:${recipient.id}`,
        title: "Completed envelope missing guarantor legal acceptance",
        summary: "A guarantor signed without a stored legal_external_acceptances ACCEPTED row",
        entityType: "signing_envelope",
        entityId: envelope.id,
        details: { recipientId: recipient.id, applicationId: envelope.application_id },
      });
    }
  }
}
