/**
 * Rebuilds missing Ops Alert rows from durable business state.
 *
 * Ops alerts are a secondary action queue. Primary evidence lives on payments,
 * receipts, webhook events, recon exceptions, envelopes, and legal acceptances.
 * This job is idempotent via the same dedupe keys as the live writers and never
 * raises an alert about its own persist failure.
 */
import {
  GatewayPaymentReceiptStatus,
  GatewayPaymentStatus,
  GatewayReconExceptionType,
  GatewayReconRunStatus,
  OpsAlertSeverity,
  OpsAlertStatus,
  OpsAlertType,
} from "@prisma/client";
import { prisma } from "../prisma";
import { logger } from "../logger";
import { raiseOpsAlert, type RaiseOpsAlertInput } from "../../modules/ops-alerts/service";
import { STALE_CREATED_MINUTES } from "./gateway-stuck-order-poller";

const SIGNING_EXPIRY_LOOKBACK_DAYS = 14;
const RECONSTRUCTION_CORRELATION = "cron:ops-alert-reconstruction";

export type OpsAlertReconstructionResult = {
  raised: number;
  resolved: number;
};

type ReconstructPolicy = "reopen_if_resolved" | "create_if_absent";

function asObjectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hasAmountMismatchMetadata(metadata: Record<string, unknown>): boolean {
  const mismatch =
    (metadata.amountMismatch as { expectedSen?: number; actualSen?: number } | undefined) ??
    (metadata.captureMismatch as { expectedSen?: number; actualSen?: number } | undefined);
  return Boolean(
    mismatch &&
      typeof mismatch.expectedSen === "number" &&
      typeof mismatch.actualSen === "number" &&
      mismatch.expectedSen !== mismatch.actualSen
  );
}

async function ensureReconstructedAlert(
  input: RaiseOpsAlertInput,
  policy: ReconstructPolicy
): Promise<boolean> {
  const existing = await prisma.opsAlert.findUnique({
    where: { dedupe_key: input.dedupeKey },
    select: { status: true },
  });

  if (existing) {
    if (existing.status === OpsAlertStatus.CLOSED) return false;
    if (existing.status === OpsAlertStatus.OPEN || existing.status === OpsAlertStatus.ACKNOWLEDGED) {
      return false;
    }
    if (existing.status === OpsAlertStatus.RESOLVED && policy === "create_if_absent") {
      return false;
    }
  }

  await raiseOpsAlert(input);
  return true;
}

async function resolveAlertIfOpen(id: string): Promise<void> {
  await prisma.opsAlert.update({
    where: { id },
    data: {
      status: OpsAlertStatus.RESOLVED,
      resolved_at: new Date(),
    },
  });
}

export async function runOpsAlertReconstructionJob(): Promise<OpsAlertReconstructionResult> {
  let raised = 0;
  let resolved = 0;

  const staleCutoff = new Date(Date.now() - STALE_CREATED_MINUTES * 60 * 1000);
  const staleCreated = await prisma.gatewayPayment.findMany({
    where: { status: GatewayPaymentStatus.CREATED, created_at: { lte: staleCutoff } },
    select: { id: true, gatewayAccount: true, curlec_order_id: true },
    take: 200,
  });
  for (const payment of staleCreated) {
    const didRaise = await ensureReconstructedAlert(
      {
        type: OpsAlertType.STUCK_PAYMENT,
        severity: OpsAlertSeverity.HIGH,
        dedupeKey: `stuck-payment:${payment.id}`,
        title: "Stuck gateway payment failed to recover",
        summary: "Payment is still CREATED after the stuck-order window",
        entityType: "gateway_payment",
        entityId: payment.id,
        details: { gatewayAccount: payment.gatewayAccount, curlecOrderId: payment.curlec_order_id },
      },
      "reopen_if_resolved"
    );
    if (didRaise) raised += 1;
  }

  const heldMismatch = await prisma.gatewayPayment.findMany({
    where: { status: GatewayPaymentStatus.HELD, refund_reference: null },
    select: { id: true, metadata: true },
    take: 200,
  });
  for (const payment of heldMismatch) {
    if (!hasAmountMismatchMetadata(asObjectMetadata(payment.metadata))) continue;
    const didRaise = await ensureReconstructedAlert(
      {
        type: OpsAlertType.GATEWAY_LEDGER_MISMATCH,
        severity: OpsAlertSeverity.HIGH,
        dedupeKey: `gateway-ledger-mismatch:${payment.id}`,
        title: "Gateway/ledger mismatch refund recovery failed",
        summary: "Held amount-mismatch payment still has no refund reference",
        entityType: "gateway_payment",
        entityId: payment.id,
      },
      "reopen_if_resolved"
    );
    if (didRaise) raised += 1;
  }

  const failedReceipts = await prisma.gatewayPaymentReceipt.count({
    where: { status: GatewayPaymentReceiptStatus.FAILED },
  });
  if (failedReceipts > 0) {
    const didRaise = await ensureReconstructedAlert(
      {
        type: OpsAlertType.RECEIPT_FAILURE,
        severity: OpsAlertSeverity.MEDIUM,
        dedupeKey: "receipt-failure:retry-job",
        title: "Gateway payment receipts still failing",
        summary: `${failedReceipts} receipt(s) remain FAILED`,
        entityType: "job",
        entityId: "gateway-receipt-retry",
        details: { failed: failedReceipts },
      },
      "reopen_if_resolved"
    );
    if (didRaise) raised += 1;
  }

  const invalidWebhooks = await prisma.gatewayWebhookEvent.findMany({
    where: { error: "Invalid stored payload" },
    select: { event_id: true },
    take: 100,
  });
  for (const row of invalidWebhooks) {
    const didRaise = await ensureReconstructedAlert(
      {
        type: OpsAlertType.WEBHOOK_FAILURE,
        severity: OpsAlertSeverity.HIGH,
        dedupeKey: `webhook-failure:${row.event_id}`,
        title: "Curlec webhook payload failed validation",
        summary: "Stored webhook event could not be parsed",
        entityType: "gateway_webhook_event",
        entityId: row.event_id,
      },
      "create_if_absent"
    );
    if (didRaise) raised += 1;
  }

  const expirySince = new Date(Date.now() - SIGNING_EXPIRY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const expiredEnvelopes = await prisma.signingEnvelope.findMany({
    where: { status: "EXPIRED", expires_at: { gte: expirySince } },
    select: { id: true },
    take: 200,
  });
  for (const envelope of expiredEnvelopes) {
    const didRaise = await ensureReconstructedAlert(
      {
        type: OpsAlertType.SIGNING_EXPIRY,
        severity: OpsAlertSeverity.MEDIUM,
        dedupeKey: `signing-expiry:${envelope.id}`,
        title: "Signing package expired",
        summary: "An active signing envelope reached its expiry timestamp",
        entityType: "signing_envelope",
        entityId: envelope.id,
      },
      "create_if_absent"
    );
    if (didRaise) raised += 1;
  }

  const unresolvedExceptions = await prisma.gatewayReconException.findMany({
    where: { resolved_at: null },
    select: {
      id: true,
      recon_run_id: true,
      type: true,
      curlec_payment_id: true,
      gateway_payment_id: true,
    },
    take: 200,
  });
  for (const exception of unresolvedExceptions) {
    const thirdKey =
      exception.type === GatewayReconExceptionType.AMOUNT_MISMATCH
        ? exception.gateway_payment_id
        : exception.curlec_payment_id;
    if (!thirdKey) continue;
    const isAmount = exception.type === GatewayReconExceptionType.AMOUNT_MISMATCH;
    const didRaise = await ensureReconstructedAlert(
      {
        type: OpsAlertType.RECON_MISMATCH,
        severity: OpsAlertSeverity.HIGH,
        dedupeKey: `recon-mismatch:${exception.recon_run_id}:${thirdKey}`,
        title: isAmount ? "Settlement recon amount mismatch" : "Settlement recon orphan Curlec payment",
        summary: "Unresolved gateway recon exception",
        entityType: isAmount ? "gateway_payment" : "gateway_recon_run",
        entityId: isAmount ? exception.gateway_payment_id : exception.recon_run_id,
        details: { exceptionId: exception.id, curlecPaymentId: exception.curlec_payment_id },
      },
      "reopen_if_resolved"
    );
    if (didRaise) raised += 1;
  }

  const failedRuns = await prisma.gatewayReconRun.findMany({
    where: { status: GatewayReconRunStatus.FAILED },
    select: { id: true, gatewayAccount: true },
    take: 50,
  });
  for (const run of failedRuns) {
    const didRaise = await ensureReconstructedAlert(
      {
        type: OpsAlertType.RECON_MISMATCH,
        severity: OpsAlertSeverity.CRITICAL,
        dedupeKey: `recon-run-failed:${run.id}`,
        title: "Settlement recon run failed",
        summary: "Recon run ended in FAILED",
        entityType: "gateway_recon_run",
        entityId: run.id,
        details: { gatewayAccount: run.gatewayAccount },
      },
      "reopen_if_resolved"
    );
    if (didRaise) raised += 1;
  }

  const completedWithGuarantor = await prisma.signingEnvelope.findMany({
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
  for (const envelope of completedWithGuarantor) {
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
      const didRaise = await ensureReconstructedAlert(
        {
          type: OpsAlertType.MISSING_LEGAL_EVIDENCE,
          severity: OpsAlertSeverity.HIGH,
          dedupeKey: `missing-legal:${recipient.id}`,
          title: "Completed envelope missing guarantor legal acceptance",
          summary: "A guarantor signed without a stored legal_external_acceptances ACCEPTED row",
          entityType: "signing_envelope",
          entityId: envelope.id,
          details: { recipientId: recipient.id, applicationId: envelope.application_id },
        },
        "reopen_if_resolved"
      );
      if (didRaise) raised += 1;
    }
  }

  const completedWithoutPdf = await prisma.signingEnvelope.count({
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
  });
  if (completedWithoutPdf > 0) {
    const didRaise = await ensureReconstructedAlert(
      {
        type: OpsAlertType.PROVIDER_FAILURE,
        severity: OpsAlertSeverity.HIGH,
        dedupeKey: "signing-reconcile:errors",
        title: "Signing provider reconcile errors",
        summary: `${completedWithoutPdf} completed envelope(s) still missing stored PDFs`,
        entityType: "job",
        entityId: "signing-reconcile",
      },
      "reopen_if_resolved"
    );
    if (didRaise) raised += 1;
  }

  const actionable = await prisma.opsAlert.findMany({
    where: {
      status: { in: [OpsAlertStatus.OPEN, OpsAlertStatus.ACKNOWLEDGED] },
      type: {
        in: [
          OpsAlertType.STUCK_PAYMENT,
          OpsAlertType.GATEWAY_LEDGER_MISMATCH,
          OpsAlertType.RECEIPT_FAILURE,
          OpsAlertType.RECON_MISMATCH,
          OpsAlertType.MISSING_LEGAL_EVIDENCE,
          OpsAlertType.PROVIDER_FAILURE,
        ],
      },
    },
    select: { id: true, type: true, dedupe_key: true, entity_id: true },
    take: 500,
  });

  for (const alert of actionable) {
    const cleared = await isAlertConditionCleared(alert);
    if (!cleared) continue;
    await resolveAlertIfOpen(alert.id);
    resolved += 1;
  }

  logger.info(
    { raised, resolved, correlationId: RECONSTRUCTION_CORRELATION },
    "Ops alert reconstruction job completed"
  );
  return { raised, resolved };
}

async function isAlertConditionCleared(alert: {
  type: OpsAlertType;
  dedupe_key: string;
  entity_id: string | null;
}): Promise<boolean> {
  if (alert.type === OpsAlertType.STUCK_PAYMENT && alert.entity_id) {
    const payment = await prisma.gatewayPayment.findUnique({
      where: { id: alert.entity_id },
      select: { status: true },
    });
    return !payment || payment.status !== GatewayPaymentStatus.CREATED;
  }

  if (alert.type === OpsAlertType.GATEWAY_LEDGER_MISMATCH && alert.entity_id) {
    const payment = await prisma.gatewayPayment.findUnique({
      where: { id: alert.entity_id },
      select: { status: true, refund_reference: true, metadata: true },
    });
    if (!payment) return true;
    if (payment.status !== GatewayPaymentStatus.HELD) return true;
    if (payment.refund_reference) return true;
    return !hasAmountMismatchMetadata(asObjectMetadata(payment.metadata));
  }

  if (alert.type === OpsAlertType.RECEIPT_FAILURE) {
    const failed = await prisma.gatewayPaymentReceipt.count({
      where: { status: GatewayPaymentReceiptStatus.FAILED },
    });
    return failed === 0;
  }

  if (alert.type === OpsAlertType.RECON_MISMATCH) {
    if (alert.dedupe_key.startsWith("recon-run-failed:")) {
      if (!alert.entity_id) return false;
      const run = await prisma.gatewayReconRun.findUnique({
        where: { id: alert.entity_id },
        select: { status: true },
      });
      return !run || run.status !== GatewayReconRunStatus.FAILED;
    }
    const parts = alert.dedupe_key.split(":");
    const runId = parts[1];
    const thirdKey = parts.slice(2).join(":");
    if (!runId || !thirdKey) return false;
    const open = await prisma.gatewayReconException.count({
      where: {
        recon_run_id: runId,
        resolved_at: null,
        OR: [{ curlec_payment_id: thirdKey }, { gateway_payment_id: thirdKey }],
      },
    });
    return open === 0;
  }

  if (alert.type === OpsAlertType.MISSING_LEGAL_EVIDENCE) {
    const recipientId = alert.dedupe_key.replace(/^missing-legal:/, "");
    if (!recipientId) return false;
    const accepted = await prisma.legalExternalAcceptance.findFirst({
      where: {
        source_type: "SIGNING_RECIPIENT",
        source_id: recipientId,
        status: "ACCEPTED",
      },
      select: { id: true },
    });
    return Boolean(accepted);
  }

  if (alert.type === OpsAlertType.PROVIDER_FAILURE) {
    if (alert.dedupe_key !== "signing-reconcile:errors") return false;
    const missingPdf = await prisma.signingEnvelope.count({
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
    });
    return missingPdf === 0;
  }

  return false;
}
