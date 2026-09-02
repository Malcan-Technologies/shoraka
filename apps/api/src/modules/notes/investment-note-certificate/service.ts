import {
  NoteFundingStatus,
  NoteInvestmentCertificateAudience,
  NoteInvestmentCertificateStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import type { InvestmentNoteCertificatePdfPayload } from "@cashsouk/types";
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
import { renderInvestmentNoteCertificateDocx } from "./render-certificate-docx";
import { buildInvestmentNoteCertificateSnapshot, parseCertificateSnapshot, reissueCertificateSnapshotFromReady } from "./snapshot";
import {
  buildCertificatePdfObjectKey,
  certificatePdfFileName,
  CERTIFICATE_PDF_CONTENT_TYPE,
  generateCertificatePdfViewUrl,
  sha256Hex,
  storeCertificatePdf,
} from "./storage";
import {
  CERTIFICATE_FIRST_VERSION,
  CertificateGenerationError,
  certificateAudienceScopeKey,
  type CertificateAudience,
  type CertificateGenerationSource,
  type InvestmentNoteCertificateSnapshot,
} from "./types";
import {
  freezeCertificateAuthorisation,
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

type CertificateRow = Prisma.NoteInvestmentCertificateGetPayload<object>;

function emptyPdfPayload(
  overrides: Partial<InvestmentNoteCertificatePdfPayload> = {}
): InvestmentNoteCertificatePdfPayload {
  return {
    certificateNumber: "",
    version: CERTIFICATE_FIRST_VERSION,
    status: "NONE",
    generationError: null,
    generatedAt: null,
    investorCount: 0,
    canRetry: false,
    canReissue: false,
    viewUrl: null,
    downloadUrl: null,
    pdfExpiresIn: null,
    pdfContentType: CERTIFICATE_PDF_CONTENT_TYPE,
    pdfFileName: null,
    pdfSha256: null,
    ...overrides,
  };
}

function aggregateStatus(rows: Array<{ status: NoteInvestmentCertificateStatus }>): {
  status: InvestmentNoteCertificatePdfPayload["status"];
  canRetry: boolean;
} {
  if (rows.length === 0) return { status: "NONE", canRetry: false };
  if (rows.every((row) => row.status === NoteInvestmentCertificateStatus.READY)) {
    return { status: "READY", canRetry: false };
  }
  if (rows.some((row) => row.status === NoteInvestmentCertificateStatus.FAILED)) {
    return { status: "FAILED", canRetry: true };
  }
  return { status: "PENDING", canRetry: false };
}

async function signedPdfUrls(input: {
  storageKey: string;
  fileName: string;
}): Promise<{ viewUrl: string; downloadUrl: string; expiresIn: number }> {
  const [view, download] = await Promise.all([
    generateCertificatePdfViewUrl({ storageKey: input.storageKey, fileName: input.fileName }),
    generateCertificatePdfViewUrl({
      storageKey: input.storageKey,
      fileName: input.fileName,
      disposition: "attachment",
    }),
  ]);
  return { viewUrl: view.viewUrl, downloadUrl: download.viewUrl, expiresIn: view.expiresIn };
}

async function loadNoteRows(db: PrismaClient, noteId: string) {
  return db.noteInvestmentCertificate.findMany({
    where: { note_id: noteId },
    orderBy: { created_at: "asc" },
  });
}

async function loadVersionRows(
  db: PrismaClient,
  noteId: string,
  version: string
) {
  return db.noteInvestmentCertificate.findMany({
    where: { note_id: noteId, version },
    orderBy: { created_at: "asc" },
  });
}

function rowsForVersion(rows: CertificateRow[], version: string): CertificateRow[] {
  return rows.filter((row) => row.version === version);
}

function latestVersionOf(rows: CertificateRow[]): string | null {
  return latestOfficialDocumentVersion(rows.map((row) => row.version));
}

function readyVersionsOf(rows: CertificateRow[]): string[] {
  const versions = [...new Set(rows.map((row) => row.version))];
  return versions.filter((version) => {
    const scoped = rowsForVersion(rows, version);
    return (
      scoped.length > 0 &&
      scoped.every(
        (row) => row.status === NoteInvestmentCertificateStatus.READY && row.pdf_s3_key
      )
    );
  });
}

function snapshotFromRows(rows: CertificateRow[]): InvestmentNoteCertificateSnapshot | null {
  for (const row of rows) {
    const parsed = parseCertificateSnapshot(row.snapshot);
    if (parsed) return parsed;
  }
  return null;
}

async function ensureAudienceRows(input: {
  db: PrismaClient;
  noteId: string;
  snapshot: InvestmentNoteCertificateSnapshot;
}): Promise<CertificateRow[]> {
  const scopes: Array<{
    audience: CertificateAudience;
    investorOrganizationId: string | null;
  }> = [
    { audience: "ADMIN", investorOrganizationId: null },
    { audience: "ISSUER", investorOrganizationId: null },
    ...input.snapshot.investors.map((investor) => ({
      audience: "INVESTOR" as const,
      investorOrganizationId: investor.investorOrganizationId,
    })),
  ];

  for (const scope of scopes) {
    const audience_scope_key = certificateAudienceScopeKey(
      scope.audience,
      scope.investorOrganizationId
    );
    try {
      await input.db.noteInvestmentCertificate.create({
        data: {
          note_id: input.noteId,
          certificate_number: input.snapshot.certificate.certificateNumber,
          version: input.snapshot.certificate.version,
          audience: scope.audience as NoteInvestmentCertificateAudience,
          audience_scope_key,
          investor_organization_id: scope.investorOrganizationId,
          status: NoteInvestmentCertificateStatus.PENDING,
          snapshot: input.snapshot as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (!isUniqueConstraint(error)) {
        throw error;
      }
    }
  }

  const rows = await loadVersionRows(input.db, input.noteId, input.snapshot.certificate.version);
  await input.db.noteInvestmentCertificate.updateMany({
    where: {
      note_id: input.noteId,
      version: input.snapshot.certificate.version,
      status: { not: NoteInvestmentCertificateStatus.READY },
      pdf_s3_key: null,
    },
    data: {
      snapshot: input.snapshot as unknown as Prisma.InputJsonValue,
      certificate_number: input.snapshot.certificate.certificateNumber,
    },
  });
  return rows;
}

async function markRowFailed(
  db: PrismaClient,
  rowId: string,
  error: unknown
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await db.noteInvestmentCertificate.update({
    where: { id: rowId },
    data: {
      status: NoteInvestmentCertificateStatus.FAILED,
      generation_error: message.slice(0, 1000),
    },
  });
}

async function generatePdfForRow(input: {
  db: PrismaClient;
  row: CertificateRow;
  snapshot: InvestmentNoteCertificateSnapshot;
}): Promise<void> {
  if (
    input.row.status === NoteInvestmentCertificateStatus.READY &&
    input.row.pdf_s3_key &&
    input.row.pdf_sha256
  ) {
    return;
  }

  const stampImage = await loadFrozenStampImage(input.snapshot.authorisation?.companyStamp);
  const docx = renderInvestmentNoteCertificateDocx(
    input.snapshot,
    {
      audience: input.row.audience,
      investorOrganizationId: input.row.investor_organization_id,
    },
    stampImage
  );
  const pdf = await convertDocxToPdf(docx, { fileName: "investment-note-certificate.docx" });
  const sha256 = sha256Hex(pdf);
  const key = buildCertificatePdfObjectKey({
    noteId: input.row.note_id,
    version: input.row.version,
    audience: input.row.audience,
    investorOrganizationId: input.row.investor_organization_id,
  });
  await storeCertificatePdf({
    key,
    body: pdf,
    sha256,
    snapshotSha256: input.snapshot.snapshotSha256,
    certificateNumber: input.snapshot.certificate.certificateNumber,
  });
  await input.db.noteInvestmentCertificate.update({
    where: { id: input.row.id },
    data: {
      status: NoteInvestmentCertificateStatus.READY,
      pdf_s3_key: key,
      pdf_sha256: sha256,
      generated_at: new Date(),
      generation_error: null,
      snapshot: input.snapshot as unknown as Prisma.InputJsonValue,
    },
  });
}

async function writeGeneratedAuditEvent(input: {
  db: PrismaClient;
  noteId: string;
  snapshot: InvestmentNoteCertificateSnapshot;
  source: CertificateGenerationSource;
  actor?: ActorContext;
  adminPdfSha256: string | null;
}): Promise<void> {
  if (input.source === "ADMIN_REISSUE") return;
  const existing = await input.db.noteEvent.findFirst({
    where: {
      note_id: input.noteId,
      event_type: "INVESTMENT_NOTE_CERTIFICATE_GENERATED",
    },
    select: { id: true, metadata: true },
  });
  const existingMeta =
    existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, unknown>)
      : null;
  if (existingMeta?.version === input.snapshot.certificate.version) {
    return;
  }

  const actor = input.actor;
  const metadata = {
    certificateNumber: input.snapshot.certificate.certificateNumber,
    version: input.snapshot.certificate.version,
    generatedAt: new Date().toISOString(),
    snapshotSha256: input.snapshot.snapshotSha256,
    adminPdfSha256: input.adminPdfSha256,
    investorCount: input.snapshot.investors.length,
    source: input.source,
  };
  const target = resolveNoteEventTarget("INVESTMENT_NOTE_CERTIFICATE_GENERATED", metadata);
  await createNoteEventRow(input.db, {
    noteId: input.noteId,
    eventType: "INVESTMENT_NOTE_CERTIFICATE_GENERATED",
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
        correlationId: actor?.correlationId ?? `investment-note-certificate:${input.noteId}`,
      }),
    metadata,
    targetType: target.targetType,
    targetId: target.targetId ?? input.noteId,
  });
}

async function persistIncompleteFailure(input: {
  db: PrismaClient;
  noteId: string;
  noteReference: string;
  error: CertificateGenerationError;
}): Promise<void> {
  const audience_scope_key = certificateAudienceScopeKey("ADMIN", null);
  const existing = await input.db.noteInvestmentCertificate.findUnique({
    where: {
      note_id_version_audience_scope_key: {
        note_id: input.noteId,
        version: CERTIFICATE_FIRST_VERSION,
        audience_scope_key,
      },
    },
  });
  if (existing?.status === NoteInvestmentCertificateStatus.READY) return;
  const data = {
    certificate_number: `IINC-${input.noteReference}`,
    status: NoteInvestmentCertificateStatus.FAILED,
    generation_error: input.error.message.slice(0, 1000),
    snapshot: (existing?.snapshot ?? {}) as Prisma.InputJsonValue,
  };
  if (existing) {
    await input.db.noteInvestmentCertificate.update({
      where: { id: existing.id },
      data,
    });
    return;
  }
  await input.db.noteInvestmentCertificate.create({
    data: {
      note_id: input.noteId,
      version: CERTIFICATE_FIRST_VERSION,
      audience: NoteInvestmentCertificateAudience.ADMIN,
      audience_scope_key,
      investor_organization_id: null,
      ...data,
    },
  });
}

/**
 * Generate or resume incomplete certificate versions from their frozen snapshots.
 * First-time generation creates V01. Never overwrites READY rows.
 * Never called inside a financial transaction.
 */
export async function generateInvestmentNoteCertificates(
  input: {
    noteId: string;
    source: CertificateGenerationSource;
    actor?: ActorContext;
  },
  db: PrismaClient = defaultPrisma
): Promise<void> {
  const note = await db.note.findUnique({
    where: { id: input.noteId },
    select: { id: true, note_reference: true, funding_status: true },
  });
  if (!note) return;
  if (note.funding_status !== NoteFundingStatus.FUNDED) {
    return;
  }

  const allRows = await loadNoteRows(db, input.noteId);

  if (allRows.length === 0) {
    let snapshot: InvestmentNoteCertificateSnapshot;
    try {
      snapshot = await buildInvestmentNoteCertificateSnapshot(input.noteId);
    } catch (error) {
      if (error instanceof CertificateGenerationError && error.code === "NOT_FUNDED") {
        return;
      }
      logger.error(
        { err: error, noteId: input.noteId },
        "Investment note certificate snapshot failed"
      );
      if (error instanceof CertificateGenerationError) {
        await persistIncompleteFailure({
          db,
          noteId: input.noteId,
          noteReference: note.note_reference,
          error,
        });
      }
      return;
    }
    await generateVersionPdfs({
      db,
      noteId: input.noteId,
      snapshot,
      source: input.source,
      actor: input.actor,
    });
    return;
  }

  const versions = [...new Set(allRows.map((row) => row.version))];
  for (const version of versions) {
    const versionRows = rowsForVersion(allRows, version);
    const { status } = aggregateStatus(versionRows);
    if (status === "READY") continue;
    const snapshot = snapshotFromRows(versionRows);
    if (!snapshot) continue;
    await generateVersionPdfs({
      db,
      noteId: input.noteId,
      snapshot,
      source: input.source,
      actor: input.actor,
    });
  }
}

async function generateVersionPdfs(input: {
  db: PrismaClient;
  noteId: string;
  snapshot: InvestmentNoteCertificateSnapshot;
  source: CertificateGenerationSource;
  actor?: ActorContext;
}): Promise<void> {
  await ensureAudienceRows({
    db: input.db,
    noteId: input.noteId,
    snapshot: input.snapshot,
  });
  const rows = await loadVersionRows(
    input.db,
    input.noteId,
    input.snapshot.certificate.version
  );
  for (const row of rows) {
    if (row.status === NoteInvestmentCertificateStatus.READY && row.pdf_s3_key) continue;
    try {
      await generatePdfForRow({ db: input.db, row, snapshot: input.snapshot });
    } catch (error) {
      logger.error(
        { err: error, noteId: input.noteId, audience: row.audience, rowId: row.id },
        "Investment note certificate PDF generation failed"
      );
      await markRowFailed(input.db, row.id, error);
    }
  }

  const refreshed = await loadVersionRows(
    input.db,
    input.noteId,
    input.snapshot.certificate.version
  );
  const allReady = refreshed.every(
    (row) => row.status === NoteInvestmentCertificateStatus.READY && row.pdf_s3_key
  );
  if (!allReady) return;

  const adminRow = refreshed.find((row) => row.audience === NoteInvestmentCertificateAudience.ADMIN);
  await writeGeneratedAuditEvent({
    db: input.db,
    noteId: input.noteId,
    snapshot: input.snapshot,
    source: input.source,
    actor: input.actor,
    adminPdfSha256: adminRow?.pdf_sha256 ?? null,
  });
}

export function scheduleInvestmentNoteCertificateGeneration(input: {
  noteId: string;
  source: CertificateGenerationSource;
  actor?: ActorContext;
}): void {
  void generateInvestmentNoteCertificates(input).catch((error) => {
    logger.error(
      { err: error, noteId: input.noteId },
      "Investment note certificate generation threw after disbursement"
    );
  });
}

export async function retryFailedInvestmentNoteCertificates(
  db: PrismaClient = defaultPrisma,
  limit = 20
) {
  const rows = await db.noteInvestmentCertificate.findMany({
    where: {
      OR: [
        { status: NoteInvestmentCertificateStatus.PENDING },
        { status: NoteInvestmentCertificateStatus.FAILED },
      ],
    },
    orderBy: { updated_at: "asc" },
    take: limit * 8,
    select: { note_id: true },
  });
  const noteIds = [...new Set(rows.map((row) => row.note_id))].slice(0, limit);

  let succeeded = 0;
  let failed = 0;
  for (const noteId of noteIds) {
    await generateInvestmentNoteCertificates({
      noteId,
      source: "ADMIN_RETRY",
      actor: {
        userId: "SYS",
        role: "SYSTEM",
        portal: AUDIT_PORTAL.ADMIN,
        auditContext: systemAuditContext({
          portal: AUDIT_PORTAL.ADMIN,
          actorUserId: "SYS",
          correlationId: `cron:investment-note-certificate:${noteId}`,
        }),
      },
    }, db);
    const after = await loadNoteRows(db, noteId);
    const latest = latestVersionOf(after);
    const latestRows = latest ? rowsForVersion(after, latest) : [];
    if (
      latestRows.length > 0 &&
      latestRows.every((item) => item.status === NoteInvestmentCertificateStatus.READY)
    ) {
      succeeded += 1;
    } else {
      failed += 1;
    }
  }
  return { attempted: noteIds.length, succeeded, failed };
}

export async function retryAdminInvestmentNoteCertificate(
  noteId: string,
  actor: ActorContext,
  db: PrismaClient = defaultPrisma
): Promise<InvestmentNoteCertificatePdfPayload> {
  const rows = await loadNoteRows(db, noteId);
  const latest = latestVersionOf(rows);
  const latestRows = latest ? rowsForVersion(rows, latest) : [];
  const { status } = aggregateStatus(latestRows);
  if (status !== "FAILED") {
    throw new AppError(
      409,
      "CERTIFICATE_RETRY_NOT_ALLOWED",
      "Retry is only available when certificate generation has failed"
    );
  }
  await generateInvestmentNoteCertificates(
    { noteId, source: "ADMIN_RETRY", actor },
    db
  );
  return getAdminInvestmentNoteCertificate(noteId, db);
}

async function writeReissuedAuditEvent(input: {
  db: PrismaClient;
  noteId: string;
  previousVersion: string;
  previousSnapshotSha256: string;
  snapshot: InvestmentNoteCertificateSnapshot;
  actor: ActorContext;
  adminPdfSha256: string | null;
}): Promise<void> {
  const metadata = {
    documentType: "ISLAMIC_INVESTMENT_NOTE_CERTIFICATE",
    certificateNumber: input.snapshot.certificate.certificateNumber,
    version: input.snapshot.certificate.version,
    previousVersion: input.previousVersion,
    newVersion: input.snapshot.certificate.version,
    generatedAt: new Date().toISOString(),
    oldSnapshotSha256: input.previousSnapshotSha256,
    newSnapshotSha256: input.snapshot.snapshotSha256,
    snapshotSha256: input.snapshot.snapshotSha256,
    adminPdfSha256: input.adminPdfSha256,
    investorCount: input.snapshot.investors.length,
    source: "ADMIN_REISSUE",
  };
  const target = resolveNoteEventTarget("INVESTMENT_NOTE_CERTIFICATE_REISSUED", metadata);
  await createNoteEventRow(input.db, {
    noteId: input.noteId,
    eventType: "INVESTMENT_NOTE_CERTIFICATE_REISSUED",
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
          input.actor.correlationId ?? `investment-note-certificate-reissue:${input.noteId}`,
      }),
    metadata,
    targetType: target.targetType,
    targetId: target.targetId ?? input.noteId,
  });
}

export async function reissueAdminInvestmentNoteCertificate(
  noteId: string,
  actor: ActorContext,
  db: PrismaClient = defaultPrisma
): Promise<InvestmentNoteCertificatePdfPayload> {
  const note = await db.note.findUnique({
    where: { id: noteId },
    select: { id: true, funding_status: true },
  });
  if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
  if (note.funding_status !== NoteFundingStatus.FUNDED) {
    throw new AppError(
      409,
      "CERTIFICATE_REISSUE_NOT_ALLOWED",
      "Regenerate / Reissue is only available for a READY certificate"
    );
  }

  const rows = await loadNoteRows(db, noteId);
  const ready = readyVersionsOf(rows);
  const latestReady = latestOfficialDocumentVersion(ready);
  if (!latestReady) {
    throw new AppError(
      409,
      "CERTIFICATE_REISSUE_NOT_ALLOWED",
      "Regenerate / Reissue is only available for a READY certificate"
    );
  }
  const latest = latestVersionOf(rows);
  const latestRows = latest ? rowsForVersion(rows, latest) : [];
  if (aggregateStatus(latestRows).status !== "READY") {
    throw new AppError(
      409,
      "CERTIFICATE_REISSUE_NOT_ALLOWED",
      "Regenerate / Reissue is only available for a READY certificate"
    );
  }

  const previousSnapshot = snapshotFromRows(rowsForVersion(rows, latestReady));
  if (!previousSnapshot) {
    throw new AppError(
      409,
      "CERTIFICATE_REISSUE_NOT_ALLOWED",
      "The READY certificate snapshot is missing"
    );
  }

  const nextVersion = nextOfficialDocumentVersion(latestReady);
  const authorisation = await freezeCertificateAuthorisation();
  const nextSnapshot = reissueCertificateSnapshotFromReady(previousSnapshot, {
    version: nextVersion,
    authorisedSignatoryName: authorisation.authorisedSignatoryName,
    companyStamp: authorisation.companyStamp,
  });

  await generateVersionPdfs({
    db,
    noteId,
    snapshot: nextSnapshot,
    source: "ADMIN_REISSUE",
    actor,
  });

  const refreshed = await loadVersionRows(db, noteId, nextVersion);
  const allReady = refreshed.every(
    (row) => row.status === NoteInvestmentCertificateStatus.READY && row.pdf_s3_key
  );
  if (allReady) {
    const adminRow = refreshed.find(
      (row) => row.audience === NoteInvestmentCertificateAudience.ADMIN
    );
    await writeReissuedAuditEvent({
      db,
      noteId,
      previousVersion: latestReady,
      previousSnapshotSha256: previousSnapshot.snapshotSha256,
      snapshot: nextSnapshot,
      actor,
      adminPdfSha256: adminRow?.pdf_sha256 ?? null,
    });
  }

  return getAdminInvestmentNoteCertificate(noteId, db);
}

async function payloadForAudienceRow(input: {
  row: CertificateRow | undefined;
  snapshot: InvestmentNoteCertificateSnapshot | null;
  rows: CertificateRow[];
  version: string;
  canReissue?: boolean;
  fileNameHint?: string | null;
}): Promise<InvestmentNoteCertificatePdfPayload> {
  const { status, canRetry } = aggregateStatus(input.rows);
  const snapshot = input.snapshot;
  const readyRow =
    input.row?.status === NoteInvestmentCertificateStatus.READY && input.row.pdf_s3_key
      ? input.row
      : null;
  const urls = readyRow
    ? await signedPdfUrls({
        storageKey: readyRow.pdf_s3_key!,
        fileName:
          input.fileNameHint ??
          certificatePdfFileName({
            certificateNumber:
              snapshot?.certificate.certificateNumber ?? readyRow.certificate_number,
            audience: readyRow.audience,
          }),
      })
    : null;
  const failed = input.rows.find((row) => row.status === NoteInvestmentCertificateStatus.FAILED);
  return emptyPdfPayload({
    certificateNumber: snapshot?.certificate.certificateNumber ?? input.row?.certificate_number ?? "",
    version: input.version,
    status,
    generationError: failed?.generation_error ?? null,
    generatedAt: readyRow?.generated_at?.toISOString() ?? null,
    investorCount: snapshot?.investors.length ?? 0,
    canRetry,
    canReissue: input.canReissue === true && status === "READY",
    viewUrl: urls?.viewUrl ?? null,
    downloadUrl: urls?.downloadUrl ?? null,
    pdfExpiresIn: urls?.expiresIn ?? null,
    pdfFileName: readyRow
      ? certificatePdfFileName({
          certificateNumber:
            snapshot?.certificate.certificateNumber ?? readyRow.certificate_number,
          audience: readyRow.audience,
        })
      : null,
    pdfSha256: readyRow?.pdf_sha256 ?? null,
  });
}

function pickAudienceRow(
  rows: CertificateRow[],
  audience: NoteInvestmentCertificateAudience,
  investorOrganizationId?: string | null
): CertificateRow | undefined {
  return rows.find((row) => {
    if (row.audience !== audience) return false;
    if (audience === NoteInvestmentCertificateAudience.INVESTOR) {
      return row.investor_organization_id === investorOrganizationId;
    }
    return true;
  });
}

export async function getAdminInvestmentNoteCertificate(
  noteId: string,
  db: PrismaClient = defaultPrisma
): Promise<InvestmentNoteCertificatePdfPayload> {
  const note = await db.note.findUnique({ where: { id: noteId }, select: { id: true } });
  if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
  const allRows = await loadNoteRows(db, noteId);
  if (allRows.length === 0) return emptyPdfPayload();
  const latest = latestVersionOf(allRows) ?? CERTIFICATE_FIRST_VERSION;
  const latestRows = rowsForVersion(allRows, latest);
  const latestReady = latestOfficialDocumentVersion(readyVersionsOf(allRows));
  const viewRows = latestReady ? rowsForVersion(allRows, latestReady) : [];
  const status = aggregateStatus(latestRows);
  const viewRow = pickAudienceRow(viewRows, NoteInvestmentCertificateAudience.ADMIN);
  const snapshot =
    snapshotFromRows(latestRows) ??
    (latestReady ? snapshotFromRows(viewRows) : null);
  return payloadForAudienceRow({
    row: viewRow ?? pickAudienceRow(latestRows, NoteInvestmentCertificateAudience.ADMIN),
    snapshot,
    rows: latestRows,
    version: latest,
    canReissue: status.status === "READY",
  });
}

export async function getIssuerInvestmentNoteCertificate(
  noteId: string,
  userId: string,
  db: PrismaClient = defaultPrisma
): Promise<InvestmentNoteCertificatePdfPayload> {
  const note = await db.note.findUnique({
    where: { id: noteId },
    select: { id: true, issuer_organization_id: true },
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

  const allRows = await loadNoteRows(db, noteId);
  const issuerRows = allRows.filter(
    (row) => row.audience === NoteInvestmentCertificateAudience.ISSUER
  );
  const ready = issuerRows.filter(
    (row) => row.status === NoteInvestmentCertificateStatus.READY && row.pdf_s3_key
  );
  const viewVersion =
    latestOfficialDocumentVersion(ready.map((row) => row.version)) ??
    latestVersionOf(issuerRows);
  const viewRows = viewVersion ? rowsForVersion(issuerRows, viewVersion) : [];
  const snapshot = snapshotFromRows(viewRows) ?? snapshotFromRows(issuerRows);
  const payload = await payloadForAudienceRow({
    row: viewRows[0],
    snapshot,
    rows: viewRows,
    version: viewVersion ?? CERTIFICATE_FIRST_VERSION,
  });
  return { ...payload, canRetry: false, canReissue: false };
}

export async function getInvestorInvestmentNoteCertificate(
  investmentId: string,
  userId: string,
  db: PrismaClient = defaultPrisma
): Promise<InvestmentNoteCertificatePdfPayload> {
  const investment = await db.noteInvestment.findUnique({
    where: { id: investmentId },
    select: {
      id: true,
      note_id: true,
      investor_organization_id: true,
    },
  });
  if (!investment) throw new AppError(404, "INVESTMENT_NOT_FOUND", "Investment not found");

  const orgAccess = await db.investorOrganization.findFirst({
    where: {
      id: investment.investor_organization_id,
      OR: [
        { owner_user_id: userId },
        { members: { some: { user_id: userId } } },
      ],
    },
    select: { id: true },
  });
  if (!orgAccess) {
    throw new AppError(403, "INVESTMENT_FORBIDDEN", "Investment is not accessible");
  }

  const allRows = await loadNoteRows(db, investment.note_id);
  const investorRows = allRows.filter(
    (row) =>
      row.audience === NoteInvestmentCertificateAudience.INVESTOR &&
      row.investor_organization_id === investment.investor_organization_id
  );
  if (
    allRows.some(
      (row) =>
        row.audience === NoteInvestmentCertificateAudience.INVESTOR &&
        row.investor_organization_id !== investment.investor_organization_id &&
        row.status === NoteInvestmentCertificateStatus.READY
    ) &&
    investorRows.length === 0
  ) {
    throw new AppError(403, "INVESTMENT_FORBIDDEN", "Investment is not accessible");
  }

  const ready = investorRows.filter(
    (row) => row.status === NoteInvestmentCertificateStatus.READY && row.pdf_s3_key
  );
  const viewVersion =
    latestOfficialDocumentVersion(ready.map((row) => row.version)) ??
    latestVersionOf(investorRows);
  const viewRows = viewVersion ? rowsForVersion(investorRows, viewVersion) : [];
  const snapshot = snapshotFromRows(viewRows) ?? snapshotFromRows(investorRows);
  const investorRef =
    snapshot?.investors.find(
      (row) => row.investorOrganizationId === investment.investor_organization_id
    )?.investorReference ?? null;
  const payload = await payloadForAudienceRow({
    row: viewRows[0],
    snapshot,
    rows: viewRows,
    version: viewVersion ?? CERTIFICATE_FIRST_VERSION,
    fileNameHint: viewRows[0]
      ? certificatePdfFileName({
          certificateNumber: viewRows[0].certificate_number,
          audience: "INVESTOR",
          investorReference: investorRef,
        })
      : null,
  });
  return { ...payload, canRetry: false, canReissue: false };
}
