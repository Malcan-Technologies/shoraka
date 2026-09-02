import {
  NoteServicingStatus,
  NoteSettlementStatus,
  NoteStatus,
  Prisma,
  SettlementHibahReceiptStatus,
  type PrismaClient,
} from "@prisma/client";
import type { SettlementHibahReceiptPdfPayload } from "@cashsouk/types";
import {
  latestOfficialDocumentVersion,
  nextOfficialDocumentVersion,
} from "@cashsouk/types";
import { prisma as defaultPrisma } from "../../../lib/prisma";
import { logger } from "../../../lib/logger";
import { AppError } from "../../../lib/http/error-handler";
import {
  AUDIT_PORTAL,
  createNoteEventRow,
  systemAuditContext,
} from "../../../lib/audit";
import { resolveNoteEventTarget } from "../audit-fields";
import { convertDocxToPdf } from "../../../lib/gotenberg/convert-docx-to-pdf";
import { renderSettlementHibahReceiptDocx } from "./render-receipt-docx";
import {
  buildSettlementHibahReceiptSnapshot,
  parseHibahReceiptSnapshot,
  reissueHibahReceiptSnapshotFromReady,
} from "./snapshot";
import {
  buildReceiptPdfObjectKey,
  generateReceiptPdfViewUrl,
  RECEIPT_PDF_CONTENT_TYPE,
  receiptPdfFileName,
  sha256Hex,
  storeReceiptPdf,
} from "./storage";
import {
  RECEIPT_FIRST_VERSION,
  ReceiptGenerationError,
  type ReceiptGenerationSource,
  type SettlementHibahReceiptSnapshot,
} from "./types";
import { isNoteFullySettledForHibahReceipt } from "./eligibility";
import {
  freezeReceiptAuthorisation,
  loadFrozenStampImage,
} from "../document-authorisation/config";

type ActorContext = {
  userId: string;
  role?: string;
  portal?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  auditContext?: import("../../../lib/audit").AuditRequestContext;
};

function isUniqueConstraint(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && (error as { code: unknown }).code === "P2002"
  );
}

type ReceiptRow = Prisma.SettlementHibahReceiptGetPayload<object>;

function emptyPdfPayload(
  overrides: Partial<SettlementHibahReceiptPdfPayload> = {}
): SettlementHibahReceiptPdfPayload {
  return {
    receiptNumber: "",
    version: RECEIPT_FIRST_VERSION,
    status: "NONE",
    generationError: null,
    generatedAt: null,
    canRetry: false,
    canReissue: false,
    viewUrl: null,
    downloadUrl: null,
    pdfExpiresIn: null,
    pdfContentType: RECEIPT_PDF_CONTENT_TYPE,
    pdfFileName: null,
    pdfSha256: null,
    ...overrides,
  };
}

async function signedPdfUrls(input: {
  storageKey: string;
  fileName: string;
}): Promise<{ viewUrl: string; downloadUrl: string; expiresIn: number }> {
  const [view, download] = await Promise.all([
    generateReceiptPdfViewUrl({ storageKey: input.storageKey, fileName: input.fileName }),
    generateReceiptPdfViewUrl({
      storageKey: input.storageKey,
      fileName: input.fileName,
      disposition: "attachment",
    }),
  ]);
  return { viewUrl: view.viewUrl, downloadUrl: download.viewUrl, expiresIn: view.expiresIn };
}

async function loadReceiptRows(db: PrismaClient, settlementId: string) {
  return db.settlementHibahReceipt.findMany({
    where: { settlement_id: settlementId },
    orderBy: { created_at: "asc" },
  });
}

async function loadReceiptRow(
  db: PrismaClient,
  settlementId: string,
  version: string
) {
  return db.settlementHibahReceipt.findUnique({
    where: {
      settlement_id_version: { settlement_id: settlementId, version },
    },
  });
}

function latestReceiptVersion(rows: ReceiptRow[]): string | null {
  return latestOfficialDocumentVersion(rows.map((row) => row.version));
}

function latestReadyReceipt(rows: ReceiptRow[]): ReceiptRow | null {
  const ready = rows.filter(
    (row) => row.status === SettlementHibahReceiptStatus.READY && row.pdf_s3_key
  );
  const version = latestOfficialDocumentVersion(ready.map((row) => row.version));
  if (!version) return null;
  return ready.find((row) => row.version === version) ?? null;
}

async function findPostedSettlement(db: PrismaClient, noteId: string) {
  return db.noteSettlement.findFirst({
    where: { note_id: noteId, status: NoteSettlementStatus.POSTED },
    orderBy: { posted_at: "desc" },
    select: { id: true, display_reference: true, note_id: true },
  });
}

async function noteIsEligible(db: PrismaClient, noteId: string): Promise<boolean> {
  const note = await db.note.findUnique({
    where: { id: noteId },
    select: { status: true, servicing_status: true },
  });
  return Boolean(note && isNoteFullySettledForHibahReceipt(note));
}

async function markRowFailed(db: PrismaClient, rowId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await db.settlementHibahReceipt.update({
    where: { id: rowId },
    data: {
      status: SettlementHibahReceiptStatus.FAILED,
      generation_error: message.slice(0, 1000),
    },
  });
}

async function persistIncompleteFailure(input: {
  db: PrismaClient;
  noteId: string;
  settlementId: string;
  receiptNumber: string;
  error: ReceiptGenerationError;
}): Promise<void> {
  const existing = await loadReceiptRow(input.db, input.settlementId, RECEIPT_FIRST_VERSION);
  if (existing?.status === SettlementHibahReceiptStatus.READY) return;
  const data = {
    receipt_number: input.receiptNumber,
    status: SettlementHibahReceiptStatus.FAILED,
    generation_error: input.error.message.slice(0, 1000),
    snapshot: (existing?.snapshot ?? {}) as Prisma.InputJsonValue,
  };
  if (existing) {
    await input.db.settlementHibahReceipt.update({
      where: { id: existing.id },
      data,
    });
    return;
  }
  try {
    await input.db.settlementHibahReceipt.create({
      data: {
        note_id: input.noteId,
        settlement_id: input.settlementId,
        version: RECEIPT_FIRST_VERSION,
        ...data,
      },
    });
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
  }
}

async function ensureReceiptRow(input: {
  db: PrismaClient;
  snapshot: SettlementHibahReceiptSnapshot;
}): Promise<ReceiptRow> {
  try {
    await input.db.settlementHibahReceipt.create({
      data: {
        note_id: input.snapshot.noteId,
        settlement_id: input.snapshot.settlementId,
        receipt_number: input.snapshot.receiptNumber,
        version: input.snapshot.version,
        status: SettlementHibahReceiptStatus.PENDING,
        snapshot: input.snapshot as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
  }
  const row = await loadReceiptRow(input.db, input.snapshot.settlementId, input.snapshot.version);
  if (!row) {
    throw new ReceiptGenerationError("Receipt row could not be created", "INCOMPLETE_DATA");
  }
  if (row.status !== SettlementHibahReceiptStatus.READY && !row.pdf_s3_key) {
    const existingSnapshot = parseHibahReceiptSnapshot(row.snapshot);
    if (!existingSnapshot) {
      await input.db.settlementHibahReceipt.update({
        where: { id: row.id },
        data: {
          snapshot: input.snapshot as unknown as Prisma.InputJsonValue,
          receipt_number: input.snapshot.receiptNumber,
        },
      });
      return (
        (await loadReceiptRow(
          input.db,
          input.snapshot.settlementId,
          input.snapshot.version
        )) ?? row
      );
    }
  }
  return row;
}

async function generatePdfForRow(input: {
  db: PrismaClient;
  row: ReceiptRow;
  snapshot: SettlementHibahReceiptSnapshot;
}): Promise<void> {
  if (
    input.row.status === SettlementHibahReceiptStatus.READY &&
    input.row.pdf_s3_key &&
    input.row.pdf_sha256
  ) {
    return;
  }

  const frozen = parseHibahReceiptSnapshot(input.row.snapshot) ?? input.snapshot;
  const stampImage = await loadFrozenStampImage(frozen.authorisation?.companyStamp);
  const docx = renderSettlementHibahReceiptDocx(frozen, stampImage);
  const pdf = await convertDocxToPdf(docx, { fileName: "settlement-hibah-receipt.docx" });
  const sha256 = sha256Hex(pdf);
  const key = buildReceiptPdfObjectKey({
    noteId: input.row.note_id,
    settlementId: input.row.settlement_id,
    version: input.row.version,
  });
  await storeReceiptPdf({
    key,
    body: pdf,
    sha256,
    snapshotSha256: frozen.snapshotSha256,
    receiptNumber: frozen.receiptNumber,
  });
  await input.db.settlementHibahReceipt.update({
    where: { id: input.row.id },
    data: {
      status: SettlementHibahReceiptStatus.READY,
      pdf_s3_key: key,
      pdf_sha256: sha256,
      generated_at: new Date(),
      generation_error: null,
      snapshot: frozen as unknown as Prisma.InputJsonValue,
    },
  });
}

async function writeGeneratedAuditEvent(input: {
  db: PrismaClient;
  snapshot: SettlementHibahReceiptSnapshot;
  source: ReceiptGenerationSource;
  actor?: ActorContext;
  pdfSha256: string | null;
}): Promise<void> {
  if (input.source === "ADMIN_REISSUE") return;
  const existing = await input.db.noteEvent.findFirst({
    where: {
      note_id: input.snapshot.noteId,
      event_type: "SETTLEMENT_HIBAH_RECEIPT_GENERATED",
    },
    select: { id: true, metadata: true },
  });
  const existingMeta =
    existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, unknown>)
      : null;
  if (existingMeta?.version === input.snapshot.version) {
    return;
  }

  const actor = input.actor;
  const metadata = {
    noteId: input.snapshot.noteId,
    settlementId: input.snapshot.settlementId,
    settlementReference: input.snapshot.settlementReference,
    receiptNumber: input.snapshot.receiptNumber,
    version: input.snapshot.version,
    generatedAt: new Date().toISOString(),
    pdfSha256: input.pdfSha256,
    snapshotSha256: input.snapshot.snapshotSha256,
    hibahAmount: input.snapshot.hibahAmount,
    source: input.source,
  };
  const target = resolveNoteEventTarget("SETTLEMENT_HIBAH_RECEIPT_GENERATED", metadata);
  await createNoteEventRow(input.db, {
    noteId: input.snapshot.noteId,
    eventType: "SETTLEMENT_HIBAH_RECEIPT_GENERATED",
    actorUserId: actor?.userId ?? "SYS",
    actorRole: actor?.role,
    portal: actor?.portal ?? AUDIT_PORTAL.ADMIN,
    ipAddress: actor?.ipAddress,
    userAgent: actor?.userAgent,
    correlationId: actor?.correlationId,
    context:
      actor?.auditContext ??
      systemAuditContext({
        portal: AUDIT_PORTAL.ADMIN,
        actorUserId: actor?.userId ?? "SYS",
        correlationId: actor?.correlationId ?? `settlement-hibah-receipt:${input.snapshot.noteId}`,
      }),
    metadata,
    targetType: target.targetType,
    targetId: target.targetId ?? input.snapshot.settlementId,
  });
}

/**
 * Generate or resume incomplete receipt versions from their frozen snapshots.
 * First-time generation creates V01. Never overwrites READY rows.
 */
export async function generateSettlementHibahReceipt(
  input: {
    noteId: string;
    source: ReceiptGenerationSource;
    actor?: ActorContext;
  },
  db: PrismaClient = defaultPrisma
): Promise<void> {
  if (!(await noteIsEligible(db, input.noteId))) {
    return;
  }

  const posted = await findPostedSettlement(db, input.noteId);
  if (!posted) return;

  const rows = await loadReceiptRows(db, posted.id);
  const latest = latestReceiptVersion(rows);
  const latestRow = latest ? rows.find((row) => row.version === latest) ?? null : null;

  if (latestRow?.status === SettlementHibahReceiptStatus.READY && latestRow.pdf_s3_key) {
    const readySnapshot = parseHibahReceiptSnapshot(latestRow.snapshot);
    if (readySnapshot) {
      await writeGeneratedAuditEvent({
        db,
        snapshot: readySnapshot,
        source: input.source,
        actor: input.actor,
        pdfSha256: latestRow.pdf_sha256,
      });
    }
    return;
  }

  let snapshot = latestRow ? parseHibahReceiptSnapshot(latestRow.snapshot) : null;
  if (!snapshot) {
    try {
      snapshot = await buildSettlementHibahReceiptSnapshot(input.noteId, input.source);
    } catch (error) {
      if (error instanceof ReceiptGenerationError && error.code === "NOT_ELIGIBLE") {
        return;
      }
      logger.error(
        { err: error, noteId: input.noteId },
        "Settlement hibah receipt snapshot failed"
      );
      if (error instanceof ReceiptGenerationError) {
        await persistIncompleteFailure({
          db,
          noteId: input.noteId,
          settlementId: posted.id,
          receiptNumber: posted.display_reference ?? posted.id,
          error,
        });
      }
      return;
    }
  }

  try {
    const row = await ensureReceiptRow({ db, snapshot });
    if (row.status === SettlementHibahReceiptStatus.READY && row.pdf_s3_key) return;
    const frozen = parseHibahReceiptSnapshot(row.snapshot) ?? snapshot;
    await generatePdfForRow({ db, row, snapshot: frozen });
  } catch (error) {
    logger.error(
      { err: error, noteId: input.noteId, settlementId: posted.id },
      "Settlement hibah receipt PDF generation failed"
    );
    const failedRows = await loadReceiptRows(db, posted.id);
    const failed = latestReceiptVersion(failedRows)
      ? failedRows.find((row) => row.version === latestReceiptVersion(failedRows))
      : null;
    if (failed) await markRowFailed(db, failed.id, error);
    return;
  }

  const refreshedRows = await loadReceiptRows(db, posted.id);
  const refreshedVersion = snapshot.version;
  const refreshed = refreshedRows.find((row) => row.version === refreshedVersion) ?? null;
  if (refreshed?.status !== SettlementHibahReceiptStatus.READY || !refreshed.pdf_s3_key) return;
  const readySnapshot = parseHibahReceiptSnapshot(refreshed.snapshot) ?? snapshot;
  await writeGeneratedAuditEvent({
    db,
    snapshot: readySnapshot,
    source: input.source,
    actor: input.actor,
    pdfSha256: refreshed.pdf_sha256,
  });
}

export function scheduleSettlementHibahReceiptGeneration(input: {
  noteId: string;
  source: ReceiptGenerationSource;
  actor?: ActorContext;
}): void {
  void generateSettlementHibahReceipt(input).catch((error) => {
    logger.error(
      { err: error, noteId: input.noteId },
      "Settlement hibah receipt generation threw after settlement"
    );
  });
}

export async function retryFailedSettlementHibahReceipts(
  db: PrismaClient = defaultPrisma,
  limit = 20
) {
  const rows = await db.settlementHibahReceipt.findMany({
    where: {
      OR: [
        { status: SettlementHibahReceiptStatus.PENDING },
        { status: SettlementHibahReceiptStatus.FAILED },
      ],
    },
    orderBy: { updated_at: "asc" },
    take: limit,
    select: { note_id: true },
  });
  const noteIds = [...new Set(rows.map((row) => row.note_id))];

  let succeeded = 0;
  let failed = 0;
  for (const noteId of noteIds) {
    await generateSettlementHibahReceipt(
      {
        noteId,
        source: "ADMIN_RETRY",
        actor: {
          userId: "SYS",
          role: "SYSTEM",
          portal: AUDIT_PORTAL.ADMIN,
          auditContext: systemAuditContext({
            portal: AUDIT_PORTAL.ADMIN,
            actorUserId: "SYS",
            correlationId: `cron:settlement-hibah-receipt:${noteId}`,
          }),
        },
      },
      db
    );
    const posted = await findPostedSettlement(db, noteId);
    const afterRows = posted ? await loadReceiptRows(db, posted.id) : [];
    const latest = latestReceiptVersion(afterRows);
    const after = latest ? afterRows.find((row) => row.version === latest) : null;
    if (after?.status === SettlementHibahReceiptStatus.READY) {
      succeeded += 1;
    } else {
      failed += 1;
    }
  }
  return { attempted: noteIds.length, succeeded, failed };
}

export async function retryAdminSettlementHibahReceipt(
  noteId: string,
  actor: ActorContext,
  db: PrismaClient = defaultPrisma
): Promise<SettlementHibahReceiptPdfPayload> {
  const posted = await findPostedSettlement(db, noteId);
  if (!posted) {
    throw new AppError(404, "SETTLEMENT_NOT_FOUND", "Posted settlement not found");
  }
  const rows = await loadReceiptRows(db, posted.id);
  const latest = latestReceiptVersion(rows);
  const row = latest ? rows.find((item) => item.version === latest) ?? null : null;
  if (row?.status !== SettlementHibahReceiptStatus.FAILED) {
    throw new AppError(
      409,
      "RECEIPT_RETRY_NOT_ALLOWED",
      "Retry is only available when receipt generation has failed"
    );
  }
  await generateSettlementHibahReceipt({ noteId, source: "ADMIN_RETRY", actor }, db);
  return getAdminSettlementHibahReceipt(noteId, db);
}

async function writeReissuedReceiptAuditEvent(input: {
  db: PrismaClient;
  previousVersion: string;
  previousSnapshotSha256: string;
  snapshot: SettlementHibahReceiptSnapshot;
  actor: ActorContext;
  pdfSha256: string | null;
}): Promise<void> {
  const metadata = {
    documentType: "SETTLEMENT_HIBAH_RECEIPT",
    noteId: input.snapshot.noteId,
    settlementId: input.snapshot.settlementId,
    settlementReference: input.snapshot.settlementReference,
    receiptNumber: input.snapshot.receiptNumber,
    version: input.snapshot.version,
    previousVersion: input.previousVersion,
    newVersion: input.snapshot.version,
    generatedAt: new Date().toISOString(),
    oldSnapshotSha256: input.previousSnapshotSha256,
    newSnapshotSha256: input.snapshot.snapshotSha256,
    snapshotSha256: input.snapshot.snapshotSha256,
    pdfSha256: input.pdfSha256,
    hibahAmount: input.snapshot.hibahAmount,
    source: "ADMIN_REISSUE",
  };
  const target = resolveNoteEventTarget("SETTLEMENT_HIBAH_RECEIPT_REISSUED", metadata);
  await createNoteEventRow(input.db, {
    noteId: input.snapshot.noteId,
    eventType: "SETTLEMENT_HIBAH_RECEIPT_REISSUED",
    actorUserId: input.actor.userId,
    actorRole: input.actor.role,
    portal: input.actor.portal ?? AUDIT_PORTAL.ADMIN,
    ipAddress: input.actor.ipAddress,
    userAgent: input.actor.userAgent,
    correlationId: input.actor.correlationId,
    context:
      input.actor.auditContext ??
      systemAuditContext({
        portal: AUDIT_PORTAL.ADMIN,
        actorUserId: input.actor.userId,
        correlationId:
          input.actor.correlationId ??
          `settlement-hibah-receipt-reissue:${input.snapshot.noteId}`,
      }),
    metadata,
    targetType: target.targetType,
    targetId: target.targetId ?? input.snapshot.settlementId,
  });
}

export async function reissueAdminSettlementHibahReceipt(
  noteId: string,
  actor: ActorContext,
  db: PrismaClient = defaultPrisma
): Promise<SettlementHibahReceiptPdfPayload> {
  if (!(await noteIsEligible(db, noteId))) {
    throw new AppError(
      409,
      "RECEIPT_REISSUE_NOT_ALLOWED",
      "Regenerate / Reissue is only available for a READY receipt"
    );
  }
  const posted = await findPostedSettlement(db, noteId);
  if (!posted) {
    throw new AppError(404, "SETTLEMENT_NOT_FOUND", "Posted settlement not found");
  }
  const rows = await loadReceiptRows(db, posted.id);
  const readyRow = latestReadyReceipt(rows);
  const latest = latestReceiptVersion(rows);
  const latestRow = latest ? rows.find((row) => row.version === latest) ?? null : null;
  if (
    !readyRow ||
    latestRow?.status !== SettlementHibahReceiptStatus.READY ||
    !latestRow.pdf_s3_key
  ) {
    throw new AppError(
      409,
      "RECEIPT_REISSUE_NOT_ALLOWED",
      "Regenerate / Reissue is only available for a READY receipt"
    );
  }
  const previousSnapshot = parseHibahReceiptSnapshot(readyRow.snapshot);
  if (!previousSnapshot) {
    throw new AppError(
      409,
      "RECEIPT_REISSUE_NOT_ALLOWED",
      "The READY receipt snapshot is missing"
    );
  }

  const nextVersion = nextOfficialDocumentVersion(readyRow.version);
  const authorisation = await freezeReceiptAuthorisation();
  const nextSnapshot = reissueHibahReceiptSnapshotFromReady(previousSnapshot, {
    version: nextVersion,
    stampSource: authorisation.stampSource,
    companyStamp: authorisation.companyStamp,
  });

  try {
    const row = await ensureReceiptRow({ db, snapshot: nextSnapshot });
    await generatePdfForRow({ db, row, snapshot: nextSnapshot });
  } catch (error) {
    logger.error(
      { err: error, noteId, settlementId: posted.id },
      "Settlement hibah receipt reissue PDF generation failed"
    );
    const failed = await loadReceiptRow(db, posted.id, nextVersion);
    if (failed) await markRowFailed(db, failed.id, error);
    return getAdminSettlementHibahReceipt(noteId, db);
  }

  const refreshed = await loadReceiptRow(db, posted.id, nextVersion);
  if (refreshed?.status === SettlementHibahReceiptStatus.READY && refreshed.pdf_s3_key) {
    await writeReissuedReceiptAuditEvent({
      db,
      previousVersion: readyRow.version,
      previousSnapshotSha256: previousSnapshot.snapshotSha256,
      snapshot: nextSnapshot,
      actor,
      pdfSha256: refreshed.pdf_sha256,
    });
  }
  return getAdminSettlementHibahReceipt(noteId, db);
}

async function payloadForRow(input: {
  row: ReceiptRow | null;
  hideError?: boolean;
  canReissue?: boolean;
}): Promise<SettlementHibahReceiptPdfPayload> {
  const row = input.row;
  if (!row) return emptyPdfPayload();
  const snapshot = parseHibahReceiptSnapshot(row.snapshot);
  const ready = row.status === SettlementHibahReceiptStatus.READY && row.pdf_s3_key;
  const fileName = receiptPdfFileName(snapshot?.receiptNumber ?? row.receipt_number);
  const urls = ready
    ? await signedPdfUrls({ storageKey: row.pdf_s3_key!, fileName })
    : null;
  return emptyPdfPayload({
    receiptNumber: snapshot?.receiptNumber ?? row.receipt_number,
    version: row.version,
    status: row.status,
    generationError: input.hideError ? null : row.generation_error,
    generatedAt: row.generated_at?.toISOString() ?? null,
    canRetry: row.status === SettlementHibahReceiptStatus.FAILED,
    canReissue: input.canReissue === true && row.status === SettlementHibahReceiptStatus.READY,
    viewUrl: urls?.viewUrl ?? null,
    downloadUrl: urls?.downloadUrl ?? null,
    pdfExpiresIn: urls?.expiresIn ?? null,
    pdfFileName: ready ? fileName : null,
    pdfSha256: row.pdf_sha256,
  });
}

export async function getAdminSettlementHibahReceipt(
  noteId: string,
  db: PrismaClient = defaultPrisma
): Promise<SettlementHibahReceiptPdfPayload> {
  const note = await db.note.findUnique({
    where: { id: noteId },
    select: { id: true, status: true, servicing_status: true },
  });
  if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
  const posted = await findPostedSettlement(db, noteId);
  if (!posted) return emptyPdfPayload();
  const rows = await loadReceiptRows(db, posted.id);
  const latest = latestReceiptVersion(rows);
  const latestRow = latest ? rows.find((row) => row.version === latest) ?? null : null;
  const readyRow = latestReadyReceipt(rows);
  const statusRow = latestRow;
  const viewRow =
    statusRow?.status === SettlementHibahReceiptStatus.READY ? statusRow : readyRow;
  const payload = await payloadForRow({
    row: statusRow,
    canReissue: statusRow?.status === SettlementHibahReceiptStatus.READY,
  });
  if (
    viewRow &&
    viewRow.id !== statusRow?.id &&
    viewRow.status === SettlementHibahReceiptStatus.READY &&
    viewRow.pdf_s3_key
  ) {
    const snapshot = parseHibahReceiptSnapshot(viewRow.snapshot);
    const fileName = receiptPdfFileName(snapshot?.receiptNumber ?? viewRow.receipt_number);
    const urls = await signedPdfUrls({ storageKey: viewRow.pdf_s3_key, fileName });
    return {
      ...payload,
      viewUrl: urls.viewUrl,
      downloadUrl: urls.downloadUrl,
      pdfExpiresIn: urls.expiresIn,
      pdfFileName: fileName,
      pdfSha256: viewRow.pdf_sha256,
    };
  }
  return payload;
}

export async function getIssuerSettlementHibahReceipt(
  noteId: string,
  userId: string,
  db: PrismaClient = defaultPrisma
): Promise<SettlementHibahReceiptPdfPayload> {
  const note = await db.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      issuer_organization_id: true,
      status: true,
      servicing_status: true,
    },
  });
  if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
  const allowed = await db.issuerOrganization.findFirst({
    where: {
      id: note.issuer_organization_id,
      OR: [{ owner_user_id: userId }, { members: { some: { user_id: userId } } }],
    },
    select: { id: true },
  });
  if (!allowed) throw new AppError(403, "ISSUER_NOTE_FORBIDDEN", "Issuer note is not accessible");

  const posted = await findPostedSettlement(db, noteId);
  if (!posted) return emptyPdfPayload();
  const rows = await loadReceiptRows(db, posted.id);
  const readyRow = latestReadyReceipt(rows);
  const latest = latestReceiptVersion(rows);
  const latestRow = latest ? rows.find((row) => row.version === latest) ?? null : null;
  const payload = await payloadForRow({
    row: readyRow ?? latestRow,
    hideError: true,
  });
  return { ...payload, canRetry: false, canReissue: false };
}

export function isNoteRepaidAndSettled(note: {
  status: NoteStatus | string;
  servicing_status: NoteServicingStatus | string;
}): boolean {
  return isNoteFullySettledForHibahReceipt(note);
}
