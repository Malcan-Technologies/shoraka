import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import {
  generatePresignedDownloadUrl,
  generatePresignedUploadUrl,
  putS3ObjectBuffer,
  validateDocument,
} from "../../lib/s3/client";
import { renderAssignmentNoticeParticularsPdf } from "./assignment-notice-pdf";
import {
  getLatestAssignmentNoticeForNote,
  isExecutionPackCompleteForNote,
  mapAssignmentNotice,
} from "./service";

type Actor = { userId: string; role?: string };

async function logNoteEvent(
  noteId: string,
  eventType: string,
  actor: Actor,
  metadata: Record<string, unknown>
) {
  await prisma.noteEvent.create({
    data: {
      note_id: noteId,
      event_type: eventType,
      actor_user_id: actor.userId,
      actor_role: actor.role ?? "ADMIN",
      actor_type: "ADMIN",
      source: "ADMIN",
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

async function loadNoteForNotice(noteId: string) {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      note_reference: true,
      issuer_organization_id: true,
      source_application_id: true,
      source_contract_id: true,
      source_invoice_id: true,
      paymaster_id: true,
      paymaster_snapshot: true,
      issuer_snapshot: true,
    },
  });
  if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
  return note;
}

function snapshotString(snapshot: unknown, key: string): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const value = (snapshot as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function getNoteAssignmentNotice(noteId: string) {
  const notice = await getLatestAssignmentNoticeForNote(noteId);
  return notice ? mapAssignmentNotice(notice) : null;
}

export async function generateNoteAssignmentNotice(noteId: string, actor: Actor) {
  const note = await loadNoteForNotice(noteId);
  const packComplete = await isExecutionPackCompleteForNote({
    sourceApplicationId: note.source_application_id,
    sourceContractId: note.source_contract_id,
    sourceInvoiceId: note.source_invoice_id,
  });
  if (!packComplete) {
    throw new AppError(
      409,
      "EXECUTION_PACK_INCOMPLETE",
      "Notice of Assignment can be generated only after the existing execution pack is complete."
    );
  }

  let paymasterId = note.paymaster_id;
  if (!paymasterId) {
    const contract = note.source_contract_id
      ? await prisma.contract.findUnique({
          where: { id: note.source_contract_id },
          select: { paymaster_id: true },
        })
      : null;
    paymasterId = contract?.paymaster_id ?? null;
  }
  if (!paymasterId) {
    throw new AppError(
      409,
      "PAYMASTER_REQUIRED",
      "A Paymaster must be linked before generating the Notice of Assignment."
    );
  }

  const [paymaster, issuer, contract, invoice, latest] = await Promise.all([
    prisma.paymaster.findUnique({ where: { id: paymasterId } }),
    prisma.issuerOrganization.findUnique({
      where: { id: note.issuer_organization_id },
      select: { name: true, registration_number: true },
    }),
    note.source_contract_id
      ? prisma.contract.findUnique({
          where: { id: note.source_contract_id },
          select: { display_reference: true },
        })
      : Promise.resolve(null),
    note.source_invoice_id
      ? prisma.invoice.findUnique({
          where: { id: note.source_invoice_id },
          select: { display_reference: true },
        })
      : Promise.resolve(null),
    getLatestAssignmentNoticeForNote(noteId),
  ]);
  if (!paymaster) {
    throw new AppError(404, "PAYMASTER_NOT_FOUND", "Paymaster not found");
  }
  if (latest && (latest.status === "ACKNOWLEDGED" || latest.status === "ACKNOWLEDGEMENT_UPLOADED")) {
    throw new AppError(
      409,
      "NOTICE_ALREADY_IN_PROGRESS",
      "An acknowledgement workflow is already in progress for this Notice. Confirm or replace the acknowledgement instead of regenerating."
    );
  }

  const version = (latest?.version ?? 0) + 1;
  const generatedAt = new Date();
  const noticeReference = `${note.note_reference}-NOA-v${version}`;

  try {
    const buffer = await renderAssignmentNoticeParticularsPdf({
      noticeReference,
      generatedAt,
      issuerName:
        issuer?.name?.trim() ||
        snapshotString(note.issuer_snapshot, "company_name") ||
        snapshotString(note.issuer_snapshot, "name") ||
        "Issuer",
      issuerRegistrationNumber: issuer?.registration_number ?? null,
      paymasterName:
        paymaster.legal_name || snapshotString(note.paymaster_snapshot, "name") || "Paymaster",
      paymasterRegistrationNumber: paymaster.registration_number,
      contractReference: contract?.display_reference ?? null,
      invoiceReference: invoice?.display_reference ?? null,
      noteReference: note.note_reference,
    });
    const key = `assignment-notices/${noteId}/${noticeReference}-${generatedAt.getTime()}.pdf`;
    await putS3ObjectBuffer({ key, body: buffer, contentType: "application/pdf" });
    const sha256 = createHash("sha256").update(buffer).digest("hex");

    const created = await prisma.paymasterAssignmentNotice.create({
      data: {
        paymaster_id: paymaster.id,
        issuer_organization_id: note.issuer_organization_id,
        contract_id: note.source_contract_id,
        invoice_id: note.source_invoice_id,
        note_id: note.id,
        status: "GENERATED",
        version,
        notice_s3_key: key,
        notice_file_name: `${noticeReference}.pdf`,
        notice_sha256: sha256,
        generated_at: generatedAt,
        generated_by_user_id: actor.userId,
        template_pending: true,
      },
    });
    await logNoteEvent(note.id, "PAYMASTER_NOTICE_GENERATED", actor, {
      noticeId: created.id,
      version,
      s3Key: key,
    });
    return mapAssignmentNotice(created);
  } catch (error) {
    logger.error({ err: error, noteId }, "Notice of Assignment generation failed");
    throw new AppError(
      500,
      "NOTICE_GENERATION_FAILED",
      "Notice of Assignment could not be generated. Retry the generate action."
    );
  }
}

export async function markNoteAssignmentNoticeSent(noteId: string, actor: Actor) {
  const notice = await getLatestAssignmentNoticeForNote(noteId);
  if (!notice || notice.status !== "GENERATED" || !notice.notice_s3_key) {
    throw new AppError(
      409,
      "NOTICE_NOT_GENERATED",
      "Generate the Notice of Assignment before marking it sent."
    );
  }
  const updated = await prisma.paymasterAssignmentNotice.update({
    where: { id: notice.id },
    data: {
      status: "SENT",
      sent_at: new Date(),
      sent_by_user_id: actor.userId,
    },
  });
  await logNoteEvent(noteId, "PAYMASTER_NOTICE_SENT", actor, { noticeId: notice.id });
  return mapAssignmentNotice(updated);
}

export async function requestAssignmentNoticeUploadUrl(params: {
  noteId: string;
  kind: "notice" | "acknowledgement";
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  const validation = validateDocument({
    contentType: params.contentType,
    fileSize: params.fileSize,
  });
  if (!validation.valid) {
    throw new AppError(400, "INVALID_DOCUMENT", validation.error ?? "Invalid document");
  }
  const notice = await getLatestAssignmentNoticeForNote(params.noteId);
  if (params.kind === "acknowledgement") {
    if (!notice || (notice.status !== "SENT" && notice.status !== "ACKNOWLEDGEMENT_UPLOADED")) {
      throw new AppError(
        409,
        "NOTICE_NOT_SENT",
        "Mark the Notice of Assignment as sent before uploading paymaster acknowledgement."
      );
    }
  }
  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const key = `assignment-notices/${params.noteId}/${params.kind}-${Date.now()}-${safeName}`;
  const uploaded = await generatePresignedUploadUrl({
    key,
    contentType: params.contentType,
  });
  return { ...uploaded, s3Key: uploaded.key, fileName: params.fileName };
}

export async function attachAssignmentNoticeFile(params: {
  noteId: string;
  actor: Actor;
  kind: "notice" | "acknowledgement";
  s3Key: string;
  fileName: string;
}) {
  const notice = await getLatestAssignmentNoticeForNote(params.noteId);
  if (!notice) {
    throw new AppError(409, "NOTICE_NOT_GENERATED", "Generate the Notice of Assignment first.");
  }
  if (params.kind === "notice") {
    const updated = await prisma.paymasterAssignmentNotice.update({
      where: { id: notice.id },
      data: {
        notice_s3_key: params.s3Key,
        notice_file_name: params.fileName,
        template_pending: false,
        status: notice.status === "FAILED" ? "GENERATED" : notice.status,
        generated_at: notice.generated_at ?? new Date(),
        generated_by_user_id: notice.generated_by_user_id ?? params.actor.userId,
      },
    });
    await logNoteEvent(params.noteId, "PAYMASTER_NOTICE_UPLOADED", params.actor, {
      noticeId: notice.id,
      s3Key: params.s3Key,
    });
    return mapAssignmentNotice(updated);
  }

  if (notice.status !== "SENT" && notice.status !== "ACKNOWLEDGEMENT_UPLOADED") {
    throw new AppError(
      409,
      "NOTICE_NOT_SENT",
      "Mark the Notice of Assignment as sent before uploading paymaster acknowledgement."
    );
  }
  const updated = await prisma.paymasterAssignmentNotice.update({
    where: { id: notice.id },
    data: {
      status: "ACKNOWLEDGEMENT_UPLOADED",
      acknowledgement_s3_key: params.s3Key,
      acknowledgement_file_name: params.fileName,
      acknowledgement_uploaded_at: new Date(),
      acknowledgement_uploaded_by_user_id: params.actor.userId,
      acknowledged_at: null,
      acknowledged_by_user_id: null,
    },
  });
  await logNoteEvent(params.noteId, "PAYMASTER_ACKNOWLEDGEMENT_UPLOADED", params.actor, {
    noticeId: notice.id,
    s3Key: params.s3Key,
  });
  return mapAssignmentNotice(updated);
}

export async function confirmAssignmentNoticeAcknowledgement(noteId: string, actor: Actor) {
  const notice = await getLatestAssignmentNoticeForNote(noteId);
  if (!notice || notice.status !== "ACKNOWLEDGEMENT_UPLOADED" || !notice.acknowledgement_s3_key) {
    throw new AppError(
      409,
      "ACKNOWLEDGEMENT_NOT_UPLOADED",
      "Upload written paymaster acknowledgement before confirming it."
    );
  }
  const updated = await prisma.paymasterAssignmentNotice.update({
    where: { id: notice.id },
    data: {
      status: "ACKNOWLEDGED",
      acknowledged_at: new Date(),
      acknowledged_by_user_id: actor.userId,
    },
  });
  await logNoteEvent(noteId, "PAYMASTER_ACKNOWLEDGEMENT_CONFIRMED", actor, {
    noticeId: notice.id,
  });
  return mapAssignmentNotice(updated);
}

export async function getAssignmentNoticeDownloadUrl(params: {
  noteId: string;
  kind: "notice" | "acknowledgement";
}) {
  const notice = await getLatestAssignmentNoticeForNote(params.noteId);
  if (!notice) throw new AppError(404, "NOTICE_NOT_FOUND", "Notice of Assignment not found");
  const key =
    params.kind === "acknowledgement" ? notice.acknowledgement_s3_key : notice.notice_s3_key;
  const fileName =
    params.kind === "acknowledgement" ? notice.acknowledgement_file_name : notice.notice_file_name;
  if (!key) {
    throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document is not available yet.");
  }
  return generatePresignedDownloadUrl({ key, fileName: fileName ?? undefined });
}
