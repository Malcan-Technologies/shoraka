/**
 * Acceptance + signing phase deadline job:
 * - Sends configurable reminders (days_before_expiry) with idempotency on offer_acceptance
 * - Expires past clocks to durable OFFER_EXPIRED (keeps full offer_details; admin can resend)
 */

import { Prisma } from "@prisma/client";
import {
  ApplicationStatus,
  computeReminderFireAt,
  DEFAULT_ACCEPTANCE_DEADLINE,
  DEFAULT_OFFER_DEADLINE_REMINDER_HOUR,
  DEFAULT_SIGNING_DEADLINE,
  deadlineReminderKey,
  getOfferAcceptanceFromOfferDetails,
  isPhaseDeadlineExpired,
  parseOfferAcceptanceDetails,
  resolveAcceptanceDeadlineFromWorkflow,
  resolveSigningDeadlineFromWorkflow,
  type OfferAcceptanceDetails,
  type PhaseDeadlineConfig,
} from "@cashsouk/types";
import { prisma } from "../prisma";
import { logger } from "../logger";
import {
  APPLICATION_AUDIT_TARGET_TYPE,
  writeApplicationAuditLog,
} from "../../modules/applications/audit/writer";
import { systemAuditContext, AUDIT_SOURCE } from "../audit/context";
import {
  expireSigningEnvelopeInTx,
  SIGNING_EXPIRY_TRIGGER,
} from "../../modules/signing/expire-envelope";
import { NotificationService } from "../../modules/notification/service";
import { NotificationTypeIds } from "../../modules/notification/registry";
import { getIssuerRecipientUserIdsForApplication } from "../../modules/notification/application-recipients";
import { ProductRepository } from "../../modules/products/repository";
import { ACCEPTANCE_ACTIVE, SIGNING_ACTIVE } from "../phase-deadlines";
import { patchOfferAcceptanceUnchecked } from "../../modules/applications/offer-acceptance";
import { computeInvoiceDetailsSectionStatus } from "../../modules/applications/invoice-details-section-status";
import {
  collectInvoiceScopeKeys,
  resolveInvoiceScopeKeyForId,
} from "../../modules/applications/invoice-review-scope";
import { refreshContractFacilityValues } from "../refresh-contract-facility";

const SYSTEM_USER_ID = "SYS";
const notificationService = new NotificationService();
const productRepo = new ProductRepository();

export type AcceptanceSigningExpiryResult = {
  remindersSent: number;
  contractsExpired: string[];
  invoicesExpired: string[];
  envelopesExpired: string[];
  applicationsUpdated: string[];
  systemUserId: string | null;
  error?: string;
};

type OfferRow = {
  kind: "contract" | "invoice";
  id: string;
  application_id: string;
  offer_details: unknown;
  product_id: string | null;
  product_version: number | null;
  financing_structure: unknown;
  contract_id?: string | null;
};

async function ensureSystemUser(): Promise<string> {
  await prisma.user.upsert({
    where: { user_id: SYSTEM_USER_ID },
    create: {
      user_id: SYSTEM_USER_ID,
      email: "system@internal.cashsouk",
      cognito_sub: "system-internal-no-login",
      cognito_username: "system-internal",
      roles: [],
      first_name: "System",
      last_name: "",
      investor_account: [],
      issuer_account: [],
    },
    update: { first_name: "System", last_name: "" },
  });
  return SYSTEM_USER_ID;
}

async function enrichApplicationNotificationPayload(
  applicationId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!("applicationId" in payload)) {
    return payload;
  }
  const displayReference = payload.displayReference;
  if (typeof displayReference === "string" && displayReference.trim().length > 0) {
    return payload;
  }
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { display_reference: true },
  });
  return {
    ...payload,
    displayReference: application?.display_reference ?? null,
  };
}

async function sendIssuerNotificationForApplication(
  applicationId: string,
  typeId: (typeof NotificationTypeIds)[keyof typeof NotificationTypeIds],
  payload: Record<string, unknown>,
  idempotencySuffix: string
) {
  const recipients = await getIssuerRecipientUserIdsForApplication(applicationId);
  const enrichedPayload = await enrichApplicationNotificationPayload(applicationId, payload);
  await Promise.all(
    recipients.map((userId) =>
      notificationService.sendTyped(
        userId,
        typeId as never,
        enrichedPayload as never,
        `app:${applicationId}:notif:${typeId}:user:${userId}:${idempotencySuffix}`
      )
    )
  );
}

async function loadWorkflowForApplication(row: OfferRow): Promise<unknown[]> {
  if (!row.product_id) return [];
  const product =
    row.product_version != null
      ? await productRepo.findByBaseAndVersion(row.product_id, row.product_version)
      : await productRepo.findById(row.product_id);
  return (product?.workflow as unknown[]) ?? [];
}

async function loadOfferSentRows(): Promise<OfferRow[]> {
  const contracts = await prisma.$queryRaw<
    {
      id: string;
      offer_details: Prisma.JsonValue;
      application_id: string;
      product_id: string | null;
      product_version: number | null;
      financing_structure: Prisma.JsonValue | null;
    }[]
  >(Prisma.sql`
    SELECT c.id,
           c.offer_details,
           a.id as application_id,
           a.financing_type->>'product_id' as product_id,
           a.product_version,
           a.financing_structure
    FROM contracts c
    INNER JOIN applications a ON a.contract_id = c.id
    WHERE c.status::text = 'OFFER_SENT'
      AND c.offer_details IS NOT NULL
      AND c.offer_details->'offer_acceptance' IS NOT NULL
  `);

  const invoices = await prisma.$queryRaw<
    {
      id: string;
      offer_details: Prisma.JsonValue;
      application_id: string;
      contract_id: string | null;
      product_id: string | null;
      product_version: number | null;
      financing_structure: Prisma.JsonValue | null;
    }[]
  >(Prisma.sql`
    SELECT i.id,
           i.offer_details,
           i.application_id,
           i.contract_id,
           a.financing_type->>'product_id' as product_id,
           a.product_version,
           a.financing_structure
    FROM invoices i
    INNER JOIN applications a ON a.id = i.application_id
    WHERE i.status::text = 'OFFER_SENT'
      AND i.contract_id IS NULL
      AND i.offer_details IS NOT NULL
      AND i.offer_details->'offer_acceptance' IS NOT NULL
  `);

  return [
    ...(contracts ?? []).map((c) => ({
      kind: "contract" as const,
      id: c.id,
      application_id: c.application_id,
      offer_details: c.offer_details,
      product_id: c.product_id,
      product_version: c.product_version,
      financing_structure: c.financing_structure,
    })),
    ...(invoices ?? []).map((i) => ({
      kind: "invoice" as const,
      id: i.id,
      application_id: i.application_id,
      offer_details: i.offer_details,
      product_id: i.product_id,
      product_version: i.product_version,
      financing_structure: i.financing_structure,
      contract_id: i.contract_id,
    })),
  ];
}

/** Transitional path for offers sent before offer_acceptance was stamped. */
async function loadLegacyOfferSentRows(): Promise<OfferRow[]> {
  const contracts = await prisma.$queryRaw<
    {
      id: string;
      offer_details: Prisma.JsonValue;
      application_id: string;
      product_id: string | null;
      product_version: number | null;
      financing_structure: Prisma.JsonValue | null;
    }[]
  >(Prisma.sql`
    SELECT c.id,
           c.offer_details,
           a.id as application_id,
           a.financing_type->>'product_id' as product_id,
           a.product_version,
           a.financing_structure
    FROM contracts c
    INNER JOIN applications a ON a.contract_id = c.id
    WHERE c.status::text = 'OFFER_SENT'
      AND c.offer_details IS NOT NULL
      AND c.offer_details->'offer_acceptance' IS NULL
      AND c.offer_details->>'expires_at' IS NOT NULL
  `);

  const invoices = await prisma.$queryRaw<
    {
      id: string;
      offer_details: Prisma.JsonValue;
      application_id: string;
      contract_id: string | null;
      product_id: string | null;
      product_version: number | null;
      financing_structure: Prisma.JsonValue | null;
    }[]
  >(Prisma.sql`
    SELECT i.id,
           i.offer_details,
           i.application_id,
           i.contract_id,
           a.financing_type->>'product_id' as product_id,
           a.product_version,
           a.financing_structure
    FROM invoices i
    INNER JOIN applications a ON a.id = i.application_id
    WHERE i.status::text = 'OFFER_SENT'
      AND i.offer_details IS NOT NULL
      AND i.offer_details->'offer_acceptance' IS NULL
      AND i.offer_details->>'expires_at' IS NOT NULL
  `);

  return [
    ...(contracts ?? []).map((c) => ({
      kind: "contract" as const,
      id: c.id,
      application_id: c.application_id,
      offer_details: c.offer_details,
      product_id: c.product_id,
      product_version: c.product_version,
      financing_structure: c.financing_structure,
    })),
    ...(invoices ?? []).map((i) => ({
      kind: "invoice" as const,
      id: i.id,
      application_id: i.application_id,
      offer_details: i.offer_details,
      product_id: i.product_id,
      product_version: i.product_version,
      financing_structure: i.financing_structure,
      contract_id: i.contract_id,
    })),
  ];
}

async function persistOfferDetails(row: OfferRow, offerDetails: Record<string, unknown>) {
  if (row.kind === "contract") {
    await prisma.contract.update({
      where: { id: row.id },
      data: { offer_details: offerDetails as Prisma.InputJsonValue },
    });
    return;
  }
  await prisma.invoice.update({
    where: { id: row.id },
    data: { offer_details: offerDetails as Prisma.InputJsonValue },
  });
}

async function expireActiveEnvelopesInTx(
  tx: Prisma.TransactionClient,
  params: {
    applicationId: string;
    contractId?: string | null;
    invoiceId?: string | null;
  }
): Promise<string[]> {
  const where: Prisma.SigningEnvelopeWhereInput = {
    application_id: params.applicationId,
    status: { in: ["DRAFT", "SENT", "IN_PROGRESS"] },
  };
  if (params.contractId) where.contract_id = params.contractId;
  if (params.invoiceId) where.invoice_id = params.invoiceId;
  const active = await tx.signingEnvelope.findMany({
    where,
    select: { id: true, status: true, expires_at: true, application_id: true },
  });
  if (active.length === 0) return [];
  const ids: string[] = [];
  for (const envelope of active) {
    const won = await expireSigningEnvelopeInTx(tx, {
      envelopeId: envelope.id,
      previousStatus: envelope.status,
      expiresAt: envelope.expires_at,
      trigger: SIGNING_EXPIRY_TRIGGER.OFFER_SIGNING_CLOCK,
      applicationId: envelope.application_id,
    });
    if (won) ids.push(envelope.id);
  }
  return ids;
}

/**
 * Persist durable OFFER_EXPIRED while keeping full offer_details.
 * Application stays in sent-stage queue so admin can filter and resend.
 */
async function expireOffer(params: {
  row: OfferRow;
  systemUserId: string;
  clock: "acceptance" | "signing";
  result: AcceptanceSigningExpiryResult;
}): Promise<void> {
  const { row, systemUserId, clock, result } = params;

  const envelopeIds = await prisma.$transaction(async (tx) => {
    let expiredEnvelopeIds: string[] = [];
    if (clock === "signing") {
      expiredEnvelopeIds = await expireActiveEnvelopesInTx(tx, {
        applicationId: row.application_id,
        contractId: row.kind === "contract" ? row.id : null,
        invoiceId: row.kind === "invoice" ? row.id : null,
      });
    }

    if (row.kind === "contract") {
      await tx.contract.update({
        where: { id: row.id },
        data: { status: "OFFER_EXPIRED" },
      });
      await tx.applicationReview.upsert({
        where: {
          application_id_section: {
            application_id: row.application_id,
            section: "contract_details",
          },
        },
        create: {
          application_id: row.application_id,
          section: "contract_details",
          status: "OFFER_EXPIRED",
          reviewer_user_id: systemUserId,
          reviewed_at: new Date(),
        },
        update: {
          status: "OFFER_EXPIRED",
          reviewer_user_id: systemUserId,
          reviewed_at: new Date(),
        },
      });
      await tx.application.update({
        where: { id: row.application_id },
        data: {
          status: ApplicationStatus.OFFER_EXPIRED,
        },
      });
      result.contractsExpired.push(row.id);
    } else {
      await tx.invoice.update({
        where: { id: row.id },
        data: { status: "OFFER_EXPIRED" },
      });

      const application = await tx.application.findUnique({
        where: { id: row.application_id },
        select: {
          contract_id: true,
          invoices: {
            orderBy: { created_at: "asc" },
            select: { id: true, details: true },
          },
        },
      });
      const occupancyContractId = row.contract_id ?? application?.contract_id ?? null;
      if (occupancyContractId) {
        await refreshContractFacilityValues(occupancyContractId, tx);
      }
      const scopeKey =
        application != null
          ? resolveInvoiceScopeKeyForId(application.invoices, row.id)
          : null;

      await tx.applicationReviewItem.updateMany({
        where: {
          application_id: row.application_id,
          item_type: "invoice",
          OR: [{ item_id: row.id }, ...(scopeKey ? [{ item_id: scopeKey }] : [])],
        },
        data: {
          status: "OFFER_EXPIRED",
          reviewer_user_id: systemUserId,
          reviewed_at: new Date(),
        },
      });

      if (application && application.invoices.length > 0) {
        const invoiceKeys = collectInvoiceScopeKeys(application.invoices);
        const invoiceItems = await tx.applicationReviewItem.findMany({
          where: { application_id: row.application_id, item_type: "invoice" },
          select: { item_id: true, status: true },
        });
        const sectionStatus = computeInvoiceDetailsSectionStatus(invoiceKeys, invoiceItems);
        await tx.applicationReview.upsert({
          where: {
            application_id_section: {
              application_id: row.application_id,
              section: "invoice_details",
            },
          },
          create: {
            application_id: row.application_id,
            section: "invoice_details",
            status: sectionStatus,
            reviewer_user_id: systemUserId,
            reviewed_at: new Date(),
          },
          update: {
            status: sectionStatus,
            reviewer_user_id: systemUserId,
            reviewed_at: new Date(),
          },
        });
      }

      await tx.application.update({
        where: { id: row.application_id },
        data: { status: ApplicationStatus.OFFER_EXPIRED },
      });
      result.invoicesExpired.push(row.id);
    }

    if (!result.applicationsUpdated.includes(row.application_id)) {
      result.applicationsUpdated.push(row.application_id);
    }

    await writeApplicationAuditLog(
      {
        eventType: row.kind === "contract" ? "CONTRACT_OFFER_EXPIRED" : "INVOICE_OFFER_EXPIRED",
        context: systemAuditContext({ source: AUDIT_SOURCE.SYSTEM_JOB, portal: null }),
        applicationId: row.application_id,
        targetType:
          row.kind === "contract"
            ? APPLICATION_AUDIT_TARGET_TYPE.CONTRACT
            : APPLICATION_AUDIT_TARGET_TYPE.INVOICE,
        targetId: row.id,
        metadata: {
          previousStatus: "OFFER_SENT",
          newStatus: "OFFER_EXPIRED",
          clock,
          trigger: `${clock}_deadline_expired`,
        },
      },
      tx
    );

    return expiredEnvelopeIds;
  });

  result.envelopesExpired.push(...envelopeIds);

  try {
    await sendIssuerNotificationForApplication(
      row.application_id,
      NotificationTypeIds.OFFER_EXPIRED,
      {
        applicationId: row.application_id,
        offerType: row.kind,
        clock,
      },
      `${row.kind}-${clock}-expired:${row.id}`
    );
  } catch (notificationError) {
    logger.error(
      { error: notificationError, applicationId: row.application_id, offerId: row.id },
      "Failed to send offer expired notification"
    );
  }
}

async function loadOfferDeadlineReminderHour(): Promise<number> {
  const settings = await prisma.platformFinanceSetting.findUnique({
    where: { key: "DEFAULT" },
    select: { offer_deadline_reminder_hour: true },
  });
  const hour = settings?.offer_deadline_reminder_hour;
  if (typeof hour === "number" && Number.isInteger(hour) && hour >= 0 && hour <= 23) {
    return hour;
  }
  return DEFAULT_OFFER_DEADLINE_REMINDER_HOUR;
}

async function processRemindersForRow(params: {
  row: OfferRow;
  acceptance: OfferAcceptanceDetails;
  offer: Record<string, unknown>;
  workflow: unknown[];
  now: Date;
  reminderHour: number;
  result: AcceptanceSigningExpiryResult;
}): Promise<void> {
  const { row, acceptance, offer, workflow, now, reminderHour, result } = params;
  const acceptanceDeadline: PhaseDeadlineConfig =
    resolveAcceptanceDeadlineFromWorkflow(workflow) ?? DEFAULT_ACCEPTANCE_DEADLINE;
  const signingDeadline: PhaseDeadlineConfig =
    resolveSigningDeadlineFromWorkflow(workflow) ?? DEFAULT_SIGNING_DEADLINE;

  const clocks: Array<{
    clock: "acceptance" | "signing";
    expiresAt: string | null | undefined;
    config: PhaseDeadlineConfig;
    active: boolean;
  }> = [
    {
      clock: "acceptance",
      expiresAt: acceptance.acceptance_expires_at,
      config: acceptanceDeadline,
      active: ACCEPTANCE_ACTIVE.has(acceptance.status),
    },
    {
      clock: "signing",
      expiresAt: acceptance.signing_expires_at,
      config: signingDeadline,
      active: SIGNING_ACTIVE.has(acceptance.status),
    },
  ];

  let nextAcceptance = acceptance;
  let dirty = false;

  for (const entry of clocks) {
    if (!entry.active || typeof entry.expiresAt !== "string" || !entry.expiresAt) continue;
    for (const reminder of entry.config.reminders) {
      const key = deadlineReminderKey(entry.clock, reminder.days_before_expiry);
      if (nextAcceptance.deadline_reminders_sent?.[key]) continue;
      const fireAt = computeReminderFireAt(
        entry.expiresAt,
        reminder.days_before_expiry,
        reminderHour
      );
      if (now < fireAt) continue;
      if (isPhaseDeadlineExpired(entry.expiresAt, now)) continue;

      try {
        await sendIssuerNotificationForApplication(
          row.application_id,
          NotificationTypeIds.OFFER_EXPIRY_REMINDER_24H,
          {
            applicationId: row.application_id,
            offerType: row.kind,
            expiresAt: entry.expiresAt,
            clock: entry.clock,
            daysBeforeExpiry: reminder.days_before_expiry,
          },
          `${row.kind}-${key}:${row.id}:${entry.expiresAt}`
        );
        result.remindersSent += 1;
        nextAcceptance = {
          ...nextAcceptance,
          deadline_reminders_sent: {
            ...(nextAcceptance.deadline_reminders_sent ?? {}),
            [key]: now.toISOString(),
          },
        };
        dirty = true;
      } catch (notificationError) {
        logger.error(
          { error: notificationError, applicationId: row.application_id, key },
          "Failed to send phase deadline reminder"
        );
      }
    }
  }

  if (dirty) {
    const updated = patchOfferAcceptanceUnchecked(offer, {
      status: nextAcceptance.status,
      deadline_reminders_sent: nextAcceptance.deadline_reminders_sent,
    });
    const merged = {
      ...updated,
      offer_acceptance: nextAcceptance,
    };
    await persistOfferDetails(row, merged);
  }
}

export async function runAcceptanceSigningExpiryJob(): Promise<AcceptanceSigningExpiryResult> {
  const result: AcceptanceSigningExpiryResult = {
    remindersSent: 0,
    contractsExpired: [],
    invoicesExpired: [],
    envelopesExpired: [],
    applicationsUpdated: [],
    systemUserId: null,
  };

  try {
    result.systemUserId = await ensureSystemUser();
  } catch (err) {
    logger.warn({ err }, "Acceptance/signing expiry job: could not ensure System user");
  }

  try {
    const now = new Date();
    const reminderHour = await loadOfferDeadlineReminderHour();
    const rows = await loadOfferSentRows();
    const rowErrors: string[] = [];

    for (const row of rows) {
      try {
        const offer = (row.offer_details as Record<string, unknown> | null) ?? null;
        if (!offer) continue;
        const acceptance = getOfferAcceptanceFromOfferDetails(offer);
        if (!acceptance) continue;

        const workflow = await loadWorkflowForApplication(row);

        await processRemindersForRow({
          row,
          acceptance,
          offer,
          workflow,
          now,
          reminderHour,
          result,
        });

        const freshOffer =
          row.kind === "contract"
            ? await prisma.contract.findUnique({
                where: { id: row.id },
                select: { offer_details: true, status: true },
              })
            : await prisma.invoice.findUnique({
                where: { id: row.id },
                select: { offer_details: true, status: true },
              });
        if (!freshOffer || freshOffer.status !== "OFFER_SENT" || !freshOffer.offer_details) continue;
        const freshAcceptance = parseOfferAcceptanceDetails(
          (freshOffer.offer_details as Record<string, unknown>).offer_acceptance
        );
        if (!freshAcceptance) continue;

        if (
          ACCEPTANCE_ACTIVE.has(freshAcceptance.status) &&
          typeof freshAcceptance.acceptance_expires_at === "string" &&
          isPhaseDeadlineExpired(freshAcceptance.acceptance_expires_at, now)
        ) {
          await expireOffer({
            row,
            systemUserId: result.systemUserId ?? SYSTEM_USER_ID,
            clock: "acceptance",
            result,
          });
          continue;
        }

        if (
          SIGNING_ACTIVE.has(freshAcceptance.status) &&
          typeof freshAcceptance.signing_expires_at === "string" &&
          isPhaseDeadlineExpired(freshAcceptance.signing_expires_at, now)
        ) {
          await expireOffer({
            row,
            systemUserId: result.systemUserId ?? SYSTEM_USER_ID,
            clock: "signing",
            result,
          });
        }
      } catch (rowErr) {
        const message = rowErr instanceof Error ? rowErr.message : String(rowErr);
        rowErrors.push(`${row.kind}:${row.id}: ${message}`);
        logger.error({ err: rowErr, row }, "Acceptance/signing expiry row failed");
      }
    }

    const legacyRows = await loadLegacyOfferSentRows();
    for (const row of legacyRows) {
      try {
        const offer = (row.offer_details as Record<string, unknown> | null) ?? null;
        if (!offer) continue;
        const expiresAt =
          typeof offer.expires_at === "string" ? offer.expires_at : null;
        if (!expiresAt || !isPhaseDeadlineExpired(expiresAt, now)) continue;

        await expireOffer({
          row,
          systemUserId: result.systemUserId ?? SYSTEM_USER_ID,
          clock: "signing",
          result,
        });
      } catch (rowErr) {
        const message = rowErr instanceof Error ? rowErr.message : String(rowErr);
        rowErrors.push(`legacy:${row.kind}:${row.id}: ${message}`);
        logger.error({ err: rowErr, row }, "Legacy offer expiry row failed");
      }
    }

    if (rowErrors.length > 0) {
      result.error = rowErrors.join("; ");
    }

    if (
      result.remindersSent > 0 ||
      result.contractsExpired.length > 0 ||
      result.invoicesExpired.length > 0
    ) {
      logger.info(
        {
          remindersSent: result.remindersSent,
          contractsExpired: result.contractsExpired.length,
          invoicesExpired: result.invoicesExpired.length,
          envelopesExpired: result.envelopesExpired.length,
        },
        "Acceptance/signing expiry job completed"
      );
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    logger.error({ err, result }, "Acceptance/signing expiry job failed");
  }

  return result;
}
