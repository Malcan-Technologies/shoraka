import { ApplicationStatus, NoteStatus, Prisma, ReviewStepStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import { computeContractFacilitySnapshot } from "../../lib/contract-facility";
import { logApplicationActivity } from "../applications/logs/service";
import { ActivityPortal } from "../applications/logs/types";
import { NotificationTypeIds } from "../notification/registry";
import type { NotificationPayloads, NotificationTypeId } from "../notification/registry";
import { getIssuerRecipientUserIdsForApplication } from "../notification/application-recipients";
import { NotificationService } from "../notification/service";
import { logger } from "../../lib/logger";
import type { AdminLogContext } from "./service";
import {
  appendOfferSigningHistory,
  assertCanArchiveForResign,
  buildArchivedSigningEntry,
  contractReviewSectionForResign,
  resetOfferDetailsForResign,
  revertContractDetailsAfterResign,
  reviewStatusForResignOffer,
  applicationStatusAfterContractResign,
} from "../signingcloud/offer-resign";
const NOTE_STATUSES_BLOCKING_INVOICE_RESIGN: NoteStatus[] = [
  NoteStatus.PUBLISHED,
  NoteStatus.FUNDING,
  NoteStatus.ACTIVE,
  NoteStatus.REPAID,
  NoteStatus.ARREARS,
  NoteStatus.DEFAULTED,
];

const CONTRACT_NOTE_STATUSES_BLOCKING_RESIGN: NoteStatus[] = [
  NoteStatus.PUBLISHED,
  NoteStatus.FUNDING,
  NoteStatus.ACTIVE,
  NoteStatus.REPAID,
  NoteStatus.ARREARS,
  NoteStatus.DEFAULTED,
];

async function sendTypedIssuerNotifications<T extends NotificationTypeId>(
  applicationId: string,
  typeId: T,
  payload: NotificationPayloads[T],
  idempotencySuffix: string
): Promise<void> {
  try {
    const notificationService = new NotificationService();
    const recipientUserIds = await getIssuerRecipientUserIdsForApplication(applicationId);
    await Promise.all(
      recipientUserIds.map((userId) =>
        notificationService.sendTyped(
          userId,
          typeId,
          payload,
          `app:${applicationId}:notif:${String(typeId)}:user:${userId}:${idempotencySuffix}`
        )
      )
    );
  } catch (err) {
    logger.error({ err, applicationId, typeId }, "Failed to send issuer re-sign notification");
  }
}

export async function adminResignContractOffer(params: {
  contractId: string;
  adminUserId: string;
  logContext?: AdminLogContext;
}): Promise<{ applicationId: string }> {
  const { contractId, adminUserId, logContext } = params;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      status: true,
      offer_details: true,
      offer_signing: true,
      offer_signing_history: true,
      contract_details: true,
      applications: { select: { id: true }, take: 1, orderBy: { updated_at: "desc" } },
    },
  });
  if (!contract) {
    throw new AppError(404, "NOT_FOUND", "Contract not found");
  }

  const blockingNote = await prisma.note.findFirst({
    where: {
      source_contract_id: contractId,
      status: { in: CONTRACT_NOTE_STATUSES_BLOCKING_RESIGN },
    },
    select: { id: true, note_reference: true, status: true },
  });
  if (blockingNote) {
    throw new AppError(
      409,
      "NOTE_ACTIVE",
      `Cannot re-sign while note ${blockingNote.note_reference} is ${blockingNote.status}`
    );
  }

  let signedRecord;
  try {
    signedRecord = assertCanArchiveForResign(contract.offer_signing);
  } catch {
    throw new AppError(400, "INVALID_STATE", "No signed contract offer to replace");
  }

  const application = contract.applications[0];
  if (!application) {
    throw new AppError(400, "INVALID_STATE", "Contract has no linked application");
  }
  const applicationId = application.id;

  const offer = (contract.offer_details as Record<string, unknown> | null) ?? null;
  if (!offer || typeof offer !== "object") {
    throw new AppError(400, "INVALID_STATE", "Contract has no offer details");
  }

  const offeredFacility = Number(offer.offered_facility) || 0;
  const offerVersion =
    typeof offer.version === "number" && Number.isFinite(offer.version) ? offer.version : null;
  const now = new Date().toISOString();
  const archivedEntry = buildArchivedSigningEntry({
    offerSigning: signedRecord,
    offerVersion,
    archivedByUserId: adminUserId,
    archivedAt: now,
  });
  const updatedOffer = resetOfferDetailsForResign(offer, now);
  const revertedDetails = revertContractDetailsAfterResign(
    (contract.contract_details as Record<string, unknown> | null) ?? null,
    offeredFacility
  );

  await prisma.$transaction(async (tx) => {
    await tx.contract.update({
      where: { id: contractId },
      data: {
        status: "OFFER_SENT",
        offer_signing: Prisma.JsonNull,
        signing_sc_contractnum: null,
        offer_signing_history: appendOfferSigningHistory(contract.offer_signing_history, archivedEntry),
        offer_details: updatedOffer as Prisma.InputJsonValue,
        contract_details: revertedDetails as Prisma.InputJsonValue,
      },
    });

    await tx.applicationReview.upsert({
      where: {
        application_id_section: {
          application_id: applicationId,
          section: contractReviewSectionForResign,
        },
      },
      create: {
        application_id: applicationId,
        section: contractReviewSectionForResign,
        status: reviewStatusForResignOffer(),
        reviewer_user_id: adminUserId,
        reviewed_at: new Date(),
      },
      update: {
        status: reviewStatusForResignOffer(),
        reviewer_user_id: adminUserId,
        reviewed_at: new Date(),
      },
    });

    await tx.applicationReviewEvent.create({
      data: {
        application_id: applicationId,
        event_type: "CONTRACT_OFFER_RESENT",
        scope: "section",
        scope_key: contractReviewSectionForResign,
        new_status: "OFFER_SENT",
        reviewer_user_id: adminUserId,
        remark: "Admin requested replacement signing for contract offer",
      },
    });

    await tx.application.update({
      where: { id: applicationId },
      data: { status: applicationStatusAfterContractResign() },
    });
  });

  const expiresAt =
    typeof updatedOffer.expires_at === "string" ? (updatedOffer.expires_at as string) : null;
  const newVersion =
    typeof updatedOffer.version === "number" ? (updatedOffer.version as number) : 0;

  await logApplicationActivity({
    userId: adminUserId,
    applicationId,
    portal: ActivityPortal.ADMIN,
    eventType: "CONTRACT_OFFER_RESENT",
    metadata: {
      contract_id: contractId,
      archived_signer_email: signedRecord.signer_email,
      version: newVersion,
    },
    ipAddress: logContext?.ipAddress ?? undefined,
    userAgent: logContext?.userAgent ?? undefined,
    deviceInfo: logContext?.deviceInfo ?? undefined,
  });

  await sendTypedIssuerNotifications(
    applicationId,
    NotificationTypeIds.CONTRACT_OFFER_SENT,
    { applicationId, offeredFacility, expiresAt },
    `contract-offer-resent:${newVersion}`
  );

  return { applicationId };
}

export async function adminResignInvoiceOfferFromNote(params: {
  noteId: string;
  adminUserId: string;
  logContext?: AdminLogContext;
}): Promise<{ applicationId: string; invoiceId: string }> {
  const { noteId, adminUserId, logContext } = params;

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      status: true,
      source_application_id: true,
      source_invoice_id: true,
    },
  });
  if (!note) {
    throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
  }
  if (!note.source_invoice_id) {
    throw new AppError(400, "INVALID_STATE", "Note has no source invoice for offer re-sign");
  }
  if (NOTE_STATUSES_BLOCKING_INVOICE_RESIGN.includes(note.status)) {
    throw new AppError(
      409,
      "NOTE_ACTIVE",
      `Cannot re-sign invoice offer while note is ${note.status}`
    );
  }

  const invoiceId = note.source_invoice_id;
  const applicationId = note.source_application_id;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, application_id: applicationId },
    select: {
      id: true,
      status: true,
      offer_details: true,
      offer_signing: true,
      offer_signing_history: true,
      details: true,
    },
  });
  if (!invoice) {
    throw new AppError(404, "NOT_FOUND", "Source invoice not found");
  }

  let signedRecord;
  try {
    signedRecord = assertCanArchiveForResign(invoice.offer_signing);
  } catch {
    throw new AppError(400, "INVALID_STATE", "No signed invoice offer to replace");
  }

  const offer = (invoice.offer_details as Record<string, unknown> | null) ?? null;
  if (!offer || typeof offer !== "object") {
    throw new AppError(400, "INVALID_STATE", "Invoice has no offer details");
  }

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { contract_id: true },
  });
  if (!application) {
    throw new AppError(404, "NOT_FOUND", "Application not found");
  }

  const reviewItems = await prisma.applicationReviewItem.findMany({
    where: { application_id: applicationId, item_type: "invoice" },
    select: { item_id: true },
  });
  const scopeKey = reviewItems[0]?.item_id ?? invoiceId;
  const details = (invoice.details as Record<string, unknown> | null) ?? {};
  const invoiceNumber =
    details.number != null && details.number !== "" ? String(details.number).trim() : null;

  const offerVersion =
    typeof offer.version === "number" && Number.isFinite(offer.version) ? offer.version : null;
  const now = new Date().toISOString();
  const archivedEntry = buildArchivedSigningEntry({
    offerSigning: signedRecord,
    offerVersion,
    archivedByUserId: adminUserId,
    archivedAt: now,
  });
  const updatedOffer = resetOfferDetailsForResign(offer, now);
  const offeredAmount = Number(updatedOffer.offered_amount) || 0;

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoiceId, application_id: applicationId },
      data: {
        status: "OFFER_SENT",
        offer_signing: Prisma.JsonNull,
        signing_sc_contractnum: null,
        offer_signing_history: appendOfferSigningHistory(invoice.offer_signing_history, archivedEntry),
        offer_details: updatedOffer as Prisma.InputJsonValue,
      },
    });

    await tx.applicationReviewItem.updateMany({
      where: {
        application_id: applicationId,
        item_type: "invoice",
        item_id: scopeKey,
      },
      data: {
        status: ReviewStepStatus.OFFER_SENT,
        reviewer_user_id: adminUserId,
        reviewed_at: new Date(),
      },
    });

    if (application.contract_id) {
      const contract = await tx.contract.findUnique({
        where: { id: application.contract_id },
        include: { invoices: true },
      });
      if (contract) {
        const contractDetails = contract.contract_details as Record<string, unknown> | null;
        const snapshot = computeContractFacilitySnapshot(
          contract.status,
          contractDetails,
          contract.invoices.map((linked) => ({
            status: linked.status,
            details: (linked.details as Record<string, unknown> | null) ?? null,
            offer_details: (linked.offer_details as Record<string, unknown> | null) ?? null,
          }))
        );
        await tx.contract.update({
          where: { id: application.contract_id },
          data: {
            contract_details: {
              ...(contractDetails && typeof contractDetails === "object" ? contractDetails : {}),
              approved_facility: snapshot.approvedFacility,
              utilized_facility: snapshot.utilizedFacility,
              available_facility: snapshot.availableFacility,
            },
          },
        });
      }
    }

    const invoiceStatuses = (
      await tx.invoice.findMany({
        where: { application_id: applicationId },
        select: { status: true },
      })
    ).map((row) => row.status);
    const allOfferable =
      invoiceStatuses.length > 0 &&
      invoiceStatuses.every((s) => s === "OFFER_SENT" || s === "APPROVED" || s === "REJECTED" || s === "WITHDRAWN");
    const nextAppStatus = allOfferable
      ? ApplicationStatus.INVOICES_SENT
      : ApplicationStatus.INVOICE_PENDING;

    await tx.applicationReviewEvent.create({
      data: {
        application_id: applicationId,
        event_type: "INVOICE_OFFER_RESENT",
        scope: "item",
        scope_key: scopeKey,
        new_status: "OFFER_SENT",
        reviewer_user_id: adminUserId,
        remark: "Admin requested replacement signing for invoice offer",
      },
    });

    await tx.application.update({
      where: { id: applicationId },
      data: { status: nextAppStatus },
    });
  });

  const expiresAt =
    typeof updatedOffer.expires_at === "string" ? (updatedOffer.expires_at as string) : null;
  const newVersion =
    typeof updatedOffer.version === "number" ? (updatedOffer.version as number) : 0;

  await logApplicationActivity({
    userId: adminUserId,
    applicationId,
    entityId: invoiceId,
    portal: ActivityPortal.ADMIN,
    eventType: "INVOICE_OFFER_RESENT",
    metadata: {
      invoice_id: invoiceId,
      note_id: noteId,
      archived_signer_email: signedRecord.signer_email,
      version: newVersion,
    },
    ipAddress: logContext?.ipAddress ?? undefined,
    userAgent: logContext?.userAgent ?? undefined,
    deviceInfo: logContext?.deviceInfo ?? undefined,
  });

  await sendTypedIssuerNotifications(
    applicationId,
    NotificationTypeIds.INVOICE_OFFER_SENT,
    {
      applicationId,
      invoiceId,
      invoiceNumber,
      offeredAmount,
      expiresAt,
    },
    `invoice-offer-resent:${invoiceId}:${newVersion}`
  );

  return { applicationId, invoiceId };
}
