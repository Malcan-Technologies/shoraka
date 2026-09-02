import {
  NoteFundingStatus,
  NoteInvestmentCertificateAudience,
  NoteInvestmentCertificateStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import type { InvestmentNoteCertificatePdfPayload } from "@cashsouk/types";
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
import { buildInvestmentNoteCertificateHtml } from "./certificate-html";
import { buildInvestmentNoteCertificateSnapshot, parseCertificateSnapshot } from "./snapshot";
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

async function loadVersionRows(
  db: PrismaClient,
  noteId: string,
  version = CERTIFICATE_FIRST_VERSION
) {
  return db.noteInvestmentCertificate.findMany({
    where: { note_id: noteId, version },
    orderBy: { created_at: "asc" },
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
          version: CERTIFICATE_FIRST_VERSION,
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

  const rows = await loadVersionRows(input.db, input.noteId);
  await input.db.noteInvestmentCertificate.updateMany({
    where: {
      note_id: input.noteId,
      version: CERTIFICATE_FIRST_VERSION,
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

  const html = buildInvestmentNoteCertificateHtml(input.snapshot, {
    audience: input.row.audience,
    investorOrganizationId: input.row.investor_organization_id,
  });
  const pdf = await convertHtmlToPdf(html);
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
 * Generate (or resume) V01 audience PDFs from a frozen snapshot.
 * Never called inside a financial transaction. Failures mark FAILED only.
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

  let rows = await loadVersionRows(db, input.noteId);
  let snapshot = snapshotFromRows(rows);

  if (!snapshot) {
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
  }

  rows = await ensureAudienceRows({ db, noteId: input.noteId, snapshot });
  rows = await loadVersionRows(db, input.noteId);

  for (const row of rows) {
    if (row.status === NoteInvestmentCertificateStatus.READY && row.pdf_s3_key) continue;
    try {
      await generatePdfForRow({ db, row, snapshot });
    } catch (error) {
      logger.error(
        { err: error, noteId: input.noteId, audience: row.audience, rowId: row.id },
        "Investment note certificate PDF generation failed"
      );
      await markRowFailed(db, row.id, error);
    }
  }

  const refreshed = await loadVersionRows(db, input.noteId);
  const allReady = refreshed.every(
    (row) => row.status === NoteInvestmentCertificateStatus.READY && row.pdf_s3_key
  );
  if (!allReady) return;

  const adminRow = refreshed.find((row) => row.audience === NoteInvestmentCertificateAudience.ADMIN);
  await writeGeneratedAuditEvent({
    db,
    noteId: input.noteId,
    snapshot,
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
      version: CERTIFICATE_FIRST_VERSION,
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
    const after = await loadVersionRows(db, noteId);
    if (after.every((item) => item.status === NoteInvestmentCertificateStatus.READY)) {
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
  const rows = await loadVersionRows(db, noteId);
  const { status } = aggregateStatus(rows);
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

async function payloadForAudienceRow(input: {
  row: CertificateRow | undefined;
  snapshot: InvestmentNoteCertificateSnapshot | null;
  rows: CertificateRow[];
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
    version: CERTIFICATE_FIRST_VERSION,
    status,
    generationError: failed?.generation_error ?? null,
    generatedAt: readyRow?.generated_at?.toISOString() ?? null,
    investorCount: snapshot?.investors.length ?? 0,
    canRetry,
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

export async function getAdminInvestmentNoteCertificate(
  noteId: string,
  db: PrismaClient = defaultPrisma
): Promise<InvestmentNoteCertificatePdfPayload> {
  const note = await db.note.findUnique({ where: { id: noteId }, select: { id: true } });
  if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
  const rows = await loadVersionRows(db, noteId);
  const snapshot = snapshotFromRows(rows);
  const adminRow = rows.find((row) => row.audience === NoteInvestmentCertificateAudience.ADMIN);
  return payloadForAudienceRow({ row: adminRow, snapshot, rows });
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

  const rows = await loadVersionRows(db, noteId);
  const snapshot = snapshotFromRows(rows);
  const issuerRow = rows.find((row) => row.audience === NoteInvestmentCertificateAudience.ISSUER);
  const payload = await payloadForAudienceRow({ row: issuerRow, snapshot, rows });
  return { ...payload, canRetry: false };
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

  const rows = await loadVersionRows(db, investment.note_id);
  const snapshot = snapshotFromRows(rows);
  const investorRow = rows.find(
    (row) =>
      row.audience === NoteInvestmentCertificateAudience.INVESTOR &&
      row.investor_organization_id === investment.investor_organization_id
  );
  if (
    rows.some(
      (row) =>
        row.audience === NoteInvestmentCertificateAudience.INVESTOR &&
        row.investor_organization_id !== investment.investor_organization_id &&
        row.status === NoteInvestmentCertificateStatus.READY
    ) &&
    !investorRow
  ) {
    throw new AppError(403, "INVESTMENT_FORBIDDEN", "Investment is not accessible");
  }

  const investorRef =
    snapshot?.investors.find(
      (row) => row.investorOrganizationId === investment.investor_organization_id
    )?.investorReference ?? null;
  const payload = await payloadForAudienceRow({
    row: investorRow,
    snapshot,
    rows: investorRow ? [investorRow] : [],
    fileNameHint: investorRow
      ? certificatePdfFileName({
          certificateNumber: investorRow.certificate_number,
          audience: "INVESTOR",
          investorReference: investorRef,
        })
      : null,
  });
  return { ...payload, canRetry: false };
}
