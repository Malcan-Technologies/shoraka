import {
  NoteServicingStatus,
  NoteSettlementStatus,
  NoteStatus,
  Prisma,
  SettlementHibahReceiptStatus,
  type PrismaClient,
} from "@prisma/client";
import type { SettlementHibahReceiptPdfPayload } from "@cashsouk/types";
import { prisma as defaultPrisma } from "../../../lib/prisma";
import { logger } from "../../../lib/logger";
import { AppError } from "../../../lib/http/error-handler";
import {
  AUDIT_PORTAL,
  createNoteEventRow,
  systemAuditContext,
} from "../../../lib/audit";
import { resolveNoteEventTarget } from "../audit-fields";
import { convertHtmlToPdf } from "../../../lib/gotenberg/convert-html-to-pdf";
import { buildSettlementHibahReceiptHtml } from "./receipt-html";
import {
  buildSettlementHibahReceiptSnapshot,
  parseHibahReceiptSnapshot,
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

async function loadReceiptRow(
  db: PrismaClient,
  settlementId: string,
  version = RECEIPT_FIRST_VERSION
) {
  return db.settlementHibahReceipt.findUnique({
    where: {
      settlement_id_version: { settlement_id: settlementId, version },
    },
  });
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
  const existing = await loadReceiptRow(input.db, input.settlementId);
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
        version: RECEIPT_FIRST_VERSION,
        status: SettlementHibahReceiptStatus.PENDING,
        snapshot: input.snapshot as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
  }
  const row = await loadReceiptRow(input.db, input.snapshot.settlementId);
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
      return (await loadReceiptRow(input.db, input.snapshot.settlementId)) ?? row;
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
  const html = buildSettlementHibahReceiptHtml(frozen);
  const pdf = await convertHtmlToPdf(html);
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
 * Generate (or resume) V01 issuer receipt PDF from a frozen snapshot.
 * Never called inside a financial transaction. Failures mark FAILED only.
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

  let row = await loadReceiptRow(db, posted.id);
  if (row?.status === SettlementHibahReceiptStatus.READY && row.pdf_s3_key) {
    const readySnapshot = parseHibahReceiptSnapshot(row.snapshot);
    if (readySnapshot) {
      await writeGeneratedAuditEvent({
        db,
        snapshot: readySnapshot,
        source: input.source,
        actor: input.actor,
        pdfSha256: row.pdf_sha256,
      });
    }
    return;
  }

  let snapshot = row ? parseHibahReceiptSnapshot(row.snapshot) : null;
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
    row = await ensureReceiptRow({ db, snapshot });
    if (row.status === SettlementHibahReceiptStatus.READY && row.pdf_s3_key) return;
    const frozen = parseHibahReceiptSnapshot(row.snapshot) ?? snapshot;
    await generatePdfForRow({ db, row, snapshot: frozen });
  } catch (error) {
    logger.error(
      { err: error, noteId: input.noteId, settlementId: posted.id },
      "Settlement hibah receipt PDF generation failed"
    );
    const failedRow = await loadReceiptRow(db, posted.id);
    if (failedRow) await markRowFailed(db, failedRow.id, error);
    return;
  }

  const refreshed = await loadReceiptRow(db, posted.id);
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
      version: RECEIPT_FIRST_VERSION,
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
    const after = posted ? await loadReceiptRow(db, posted.id) : null;
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
  const row = await loadReceiptRow(db, posted.id);
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

async function payloadForRow(input: {
  row: ReceiptRow | null;
  hideError?: boolean;
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
  const row = await loadReceiptRow(db, posted.id);
  return payloadForRow({ row });
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
  const row = await loadReceiptRow(db, posted.id);
  const payload = await payloadForRow({ row, hideError: true });
  return { ...payload, canRetry: false };
}

export function isNoteRepaidAndSettled(note: {
  status: NoteStatus | string;
  servicing_status: NoteServicingStatus | string;
}): boolean {
  return isNoteFullySettledForHibahReceipt(note);
}
