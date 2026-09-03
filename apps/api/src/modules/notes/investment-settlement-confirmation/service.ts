import {
  InvestmentSettlementConfirmationStatus,
  NoteSettlementStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import type {
  AdminInvestmentSettlementConfirmationItem,
  AdminInvestmentSettlementConfirmationsPayload,
  InvestmentSettlementConfirmationPdfPayload,
  OfficialDocumentReviewVersion,
} from "@cashsouk/types";
import {
  INVESTMENT_SETTLEMENT_CONFIRMATION_INTRO,
  INVESTMENT_SETTLEMENT_CONFIRMATION_PROCESSING_NOTICE,
  INVESTMENT_SETTLEMENT_CONFIRMATION_STATUS_LABEL,
  latestOfficialDocumentVersion,
  nextOfficialDocumentVersion,
} from "@cashsouk/types";
import { prisma as defaultPrisma } from "../../../lib/prisma";
import {
  currentOfficialDocumentVersion,
  unpublishedLatestOfficialDocumentVersion,
} from "../official-document-publication";
import { certificatePartyDisplayReference } from "../investment-note-certificate/certificate-identity";
import { logger } from "../../../lib/logger";
import { AppError } from "../../../lib/http/error-handler";
import {
  AUDIT_PORTAL,
  createNoteEventRow,
  systemAuditContext,
} from "../../../lib/audit";
import { resolveNoteEventTarget } from "../audit-fields";
import { buildInvestmentSettlementConfirmationHtml } from "./confirmation-html";
import { renderConfirmationHtmlToPdfBuffer } from "./render-confirmation-html-to-pdf";
import {
  buildInvestmentSettlementConfirmationSnapshot,
  expectedInvestorOrganizationIds,
  parseConfirmationSnapshot,
  parseSettlementAllocations,
  reissueConfirmationSnapshotFromReady,
} from "./snapshot";
import {
  buildConfirmationPdfObjectKey,
  confirmationPdfFileName,
  CONFIRMATION_PDF_CONTENT_TYPE,
  generateConfirmationPdfViewUrl,
  sha256Hex,
  storeConfirmationPdf,
} from "./storage";
import {
  CONFIRMATION_FIRST_VERSION,
  ConfirmationGenerationError,
  type ConfirmationGenerationSource,
  type InvestmentSettlementConfirmationSnapshot,
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

type ConfirmationRow = Prisma.InvestmentSettlementConfirmationGetPayload<object>;

function isUniqueConstraint(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && (error as { code: unknown }).code === "P2002"
  );
}

function emptyInvestorPayload(
  overrides: Partial<InvestmentSettlementConfirmationPdfPayload> = {}
): InvestmentSettlementConfirmationPdfPayload {
  return {
    version: CONFIRMATION_FIRST_VERSION,
    statusLabel: INVESTMENT_SETTLEMENT_CONFIRMATION_STATUS_LABEL,
    introCopy: INVESTMENT_SETTLEMENT_CONFIRMATION_INTRO,
    processingNotice: INVESTMENT_SETTLEMENT_CONFIRMATION_PROCESSING_NOTICE,
    noteReference: "",
    issuerReference: "",
    settlementDateDisplay: "",
    principalReturned: 0,
    grossProfitEarned: 0,
    serviceFeeRatePercent: 0,
    serviceFeeLabel: "Service fee (0% of profit)",
    serviceFeeAmount: 0,
    netProfitCredited: 0,
    tawidhCompensation: 0,
    showTawidh: false,
    totalCreditedToWallet: 0,
    status: "NONE",
    generationError: null,
    generatedAt: null,
    canGenerate: false,
    canRetry: false,
    canRegenerate: false,
    canPublish: false,
    isCurrent: false,
    reviewVersion: null,
    viewUrl: null,
    downloadUrl: null,
    pdfExpiresIn: null,
    pdfContentType: CONFIRMATION_PDF_CONTENT_TYPE,
    pdfFileName: null,
    pdfSha256: null,
    ...overrides,
  };
}

function displayFromSnapshot(
  snapshot: InvestmentSettlementConfirmationSnapshot
): Pick<
  InvestmentSettlementConfirmationPdfPayload,
  | "version"
  | "statusLabel"
  | "introCopy"
  | "processingNotice"
  | "noteReference"
  | "issuerReference"
  | "settlementDateDisplay"
  | "principalReturned"
  | "grossProfitEarned"
  | "serviceFeeRatePercent"
  | "serviceFeeLabel"
  | "serviceFeeAmount"
  | "netProfitCredited"
  | "tawidhCompensation"
  | "showTawidh"
  | "totalCreditedToWallet"
> {
  return {
    version: snapshot.version,
    statusLabel: snapshot.statusLabel,
    introCopy: snapshot.introCopy,
    processingNotice: snapshot.processingNotice,
    noteReference: snapshot.noteReference,
    issuerReference: snapshot.issuerReference,
    settlementDateDisplay: snapshot.settlementDateDisplay,
    principalReturned: snapshot.principalReturned,
    grossProfitEarned: snapshot.grossProfitEarned,
    serviceFeeRatePercent: snapshot.serviceFeeRatePercent,
    serviceFeeLabel: snapshot.serviceFeeLabel,
    serviceFeeAmount: snapshot.serviceFeeAmount,
    netProfitCredited: snapshot.netProfitCredited,
    tawidhCompensation: snapshot.tawidhCompensation,
    showTawidh: snapshot.showTawidh,
    totalCreditedToWallet: snapshot.totalCreditedToWallet,
  };
}

async function signedPdfUrls(input: {
  storageKey: string;
  fileName: string;
}): Promise<{ viewUrl: string; downloadUrl: string; expiresIn: number }> {
  const [view, download] = await Promise.all([
    generateConfirmationPdfViewUrl({ storageKey: input.storageKey, fileName: input.fileName }),
    generateConfirmationPdfViewUrl({
      storageKey: input.storageKey,
      fileName: input.fileName,
      disposition: "attachment",
    }),
  ]);
  return { viewUrl: view.viewUrl, downloadUrl: download.viewUrl, expiresIn: view.expiresIn };
}

async function loadConfirmationRow(
  db: PrismaClient,
  settlementId: string,
  investorOrganizationId: string,
  version: string
) {
  return db.investmentSettlementConfirmation.findUnique({
    where: {
      settlement_id_investor_organization_id_version: {
        settlement_id: settlementId,
        investor_organization_id: investorOrganizationId,
        version,
      },
    },
  });
}

async function loadInvestorConfirmationRows(
  db: PrismaClient,
  settlementId: string,
  investorOrganizationId: string
) {
  return db.investmentSettlementConfirmation.findMany({
    where: { settlement_id: settlementId, investor_organization_id: investorOrganizationId },
    orderBy: { created_at: "asc" },
  });
}

function confirmationRowReady(row: ConfirmationRow | null | undefined): boolean {
  return Boolean(
    row &&
      row.status === InvestmentSettlementConfirmationStatus.READY &&
      row.pdf_s3_key
  );
}

async function setConfirmationVersionCurrent(
  db: PrismaClient,
  settlementId: string,
  investorOrganizationId: string,
  version: string
): Promise<void> {
  await db.investmentSettlementConfirmation.updateMany({
    where: {
      settlement_id: settlementId,
      investor_organization_id: investorOrganizationId,
      is_current: true,
    },
    data: { is_current: false },
  });
  await db.investmentSettlementConfirmation.updateMany({
    where: {
      settlement_id: settlementId,
      investor_organization_id: investorOrganizationId,
      version,
    },
    data: { is_current: true },
  });
}

async function maybeMarkFirstConfirmationCurrent(input: {
  db: PrismaClient;
  settlementId: string;
  investorOrganizationId: string;
  version: string;
}): Promise<void> {
  if (input.version !== CONFIRMATION_FIRST_VERSION) return;
  const rows = await loadInvestorConfirmationRows(
    input.db,
    input.settlementId,
    input.investorOrganizationId
  );
  if (currentOfficialDocumentVersion(rows)) return;
  const row = rows.find((item) => item.version === input.version) ?? null;
  if (confirmationRowReady(row)) {
    await setConfirmationVersionCurrent(
      input.db,
      input.settlementId,
      input.investorOrganizationId,
      input.version
    );
  }
}

async function loadPostedSettlement(db: PrismaClient, settlementId: string) {
  return db.noteSettlement.findUnique({
    where: { id: settlementId },
    select: {
      id: true,
      note_id: true,
      status: true,
      display_reference: true,
      preview_snapshot: true,
    },
  });
}

async function markRowFailed(db: PrismaClient, rowId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await db.investmentSettlementConfirmation.update({
    where: { id: rowId },
    data: {
      status: InvestmentSettlementConfirmationStatus.FAILED,
      generation_error: message.slice(0, 1000),
    },
  });
}

async function persistIncompleteFailure(input: {
  db: PrismaClient;
  noteId: string;
  settlementId: string;
  investorOrganizationId: string;
  error: ConfirmationGenerationError;
}): Promise<void> {
  const existing = await loadConfirmationRow(
    input.db,
    input.settlementId,
    input.investorOrganizationId,
    CONFIRMATION_FIRST_VERSION
  );
  if (existing?.status === InvestmentSettlementConfirmationStatus.READY) return;
  const data = {
    status: InvestmentSettlementConfirmationStatus.FAILED,
    generation_error: input.error.message.slice(0, 1000),
    snapshot: (existing?.snapshot ?? {}) as Prisma.InputJsonValue,
  };
  if (existing) {
    await input.db.investmentSettlementConfirmation.update({
      where: { id: existing.id },
      data,
    });
    return;
  }
  try {
    await input.db.investmentSettlementConfirmation.create({
      data: {
        note_id: input.noteId,
        settlement_id: input.settlementId,
        investor_organization_id: input.investorOrganizationId,
        version: CONFIRMATION_FIRST_VERSION,
        is_current: false,
        ...data,
      },
    });
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
  }
}

async function ensureConfirmationRow(input: {
  db: PrismaClient;
  snapshot: InvestmentSettlementConfirmationSnapshot;
}): Promise<ConfirmationRow> {
  try {
    await input.db.investmentSettlementConfirmation.create({
      data: {
        note_id: input.snapshot.noteId,
        settlement_id: input.snapshot.settlementId,
        investor_organization_id: input.snapshot.investorOrganizationId,
        version: input.snapshot.version,
        status: InvestmentSettlementConfirmationStatus.PENDING,
        is_current: false,
        snapshot: input.snapshot as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
  }
  const row = await loadConfirmationRow(
    input.db,
    input.snapshot.settlementId,
    input.snapshot.investorOrganizationId,
    input.snapshot.version
  );
  if (!row) {
    throw new ConfirmationGenerationError(
      "Confirmation row could not be created",
      "INCOMPLETE_DATA"
    );
  }
  if (row.status !== InvestmentSettlementConfirmationStatus.READY && !row.pdf_s3_key) {
    const existingSnapshot = parseConfirmationSnapshot(row.snapshot);
    if (!existingSnapshot) {
      await input.db.investmentSettlementConfirmation.update({
        where: { id: row.id },
        data: { snapshot: input.snapshot as unknown as Prisma.InputJsonValue },
      });
      return (
        (await loadConfirmationRow(
          input.db,
          input.snapshot.settlementId,
          input.snapshot.investorOrganizationId,
          input.snapshot.version
        )) ?? row
      );
    }
  }
  return row;
}

async function generatePdfForRow(input: {
  db: PrismaClient;
  row: ConfirmationRow;
  snapshot: InvestmentSettlementConfirmationSnapshot;
}): Promise<void> {
  if (
    input.row.status === InvestmentSettlementConfirmationStatus.READY &&
    input.row.pdf_s3_key &&
    input.row.pdf_sha256
  ) {
    return;
  }

  const frozen = parseConfirmationSnapshot(input.row.snapshot) ?? input.snapshot;
  const html = buildInvestmentSettlementConfirmationHtml(frozen);
  let pdf: Buffer;
  try {
    pdf = await renderConfirmationHtmlToPdfBuffer(html);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfirmationGenerationError(message, "PLAYWRIGHT_FAILED");
  }
  const sha256 = sha256Hex(pdf);
  const key = buildConfirmationPdfObjectKey({
    noteId: input.row.note_id,
    settlementId: input.row.settlement_id,
    investorOrganizationId: input.row.investor_organization_id,
    version: input.row.version,
  });
  await storeConfirmationPdf({
    key,
    body: pdf,
    sha256,
    snapshotSha256: frozen.snapshotSha256,
    noteReference: frozen.noteReference,
  });
  await input.db.investmentSettlementConfirmation.update({
    where: { id: input.row.id },
    data: {
      status: InvestmentSettlementConfirmationStatus.READY,
      pdf_s3_key: key,
      pdf_sha256: sha256,
      generated_at: new Date(),
      generation_error: null,
      snapshot: frozen as unknown as Prisma.InputJsonValue,
    },
  });
  await maybeMarkFirstConfirmationCurrent({
    db: input.db,
    settlementId: input.row.settlement_id,
    investorOrganizationId: input.row.investor_organization_id,
    version: input.row.version,
  });
}

async function writeGeneratedAuditEvent(input: {
  db: PrismaClient;
  noteId: string;
  settlementId: string;
  settlementReference: string;
  confirmationCount: number;
  source: ConfirmationGenerationSource;
  actor?: ActorContext;
  pdfSha256s: string[];
  snapshotSha256s: string[];
}): Promise<void> {
  const existing = await input.db.noteEvent.findMany({
    where: {
      note_id: input.noteId,
      event_type: "INVESTMENT_SETTLEMENT_CONFIRMATION_GENERATED",
    },
    select: { id: true, metadata: true },
  });
  const alreadyWritten = existing.some((row) => {
    const meta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null;
    return (
      meta?.settlementId === input.settlementId &&
      meta?.version === CONFIRMATION_FIRST_VERSION
    );
  });
  if (alreadyWritten) return;

  const actor = input.actor;
  const metadata = {
    noteId: input.noteId,
    settlementId: input.settlementId,
    settlementReference: input.settlementReference,
    version: CONFIRMATION_FIRST_VERSION,
    confirmationCount: input.confirmationCount,
    generatedAt: new Date().toISOString(),
    source: input.source,
    pdfSha256s: input.pdfSha256s,
    snapshotSha256s: input.snapshotSha256s,
    manifestHash: sha256Hex(Buffer.from(input.pdfSha256s.join("|"), "utf8")),
  };
  const target = resolveNoteEventTarget("INVESTMENT_SETTLEMENT_CONFIRMATION_GENERATED", metadata);
  await createNoteEventRow(input.db, {
    noteId: input.noteId,
    eventType: "INVESTMENT_SETTLEMENT_CONFIRMATION_GENERATED",
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
        correlationId:
          actor?.correlationId ?? `investment-settlement-confirmation:${input.settlementId}`,
      }),
    metadata,
    targetType: target.targetType,
    targetId: target.targetId ?? input.settlementId,
  });
}

async function maybeWriteSettlementAudit(input: {
  db: PrismaClient;
  settlementId: string;
  source: ConfirmationGenerationSource;
  actor?: ActorContext;
}): Promise<void> {
  const settlement = await loadPostedSettlement(input.db, input.settlementId);
  if (!settlement) return;
  const expectedOrgIds = expectedInvestorOrganizationIds(
    parseSettlementAllocations(settlement.preview_snapshot)
  );
  if (expectedOrgIds.length === 0) return;
  const rows = await input.db.investmentSettlementConfirmation.findMany({
    where: {
      settlement_id: input.settlementId,
      version: CONFIRMATION_FIRST_VERSION,
      investor_organization_id: { in: expectedOrgIds },
    },
  });
  if (rows.length !== expectedOrgIds.length) return;
  if (rows.some((row) => row.status !== InvestmentSettlementConfirmationStatus.READY || !row.pdf_s3_key)) {
    return;
  }
  const snapshots = rows
    .map((row) => parseConfirmationSnapshot(row.snapshot))
    .filter((snapshot): snapshot is InvestmentSettlementConfirmationSnapshot => Boolean(snapshot));
  await writeGeneratedAuditEvent({
    db: input.db,
    noteId: settlement.note_id,
    settlementId: settlement.id,
    settlementReference: settlement.display_reference ?? settlement.id,
    confirmationCount: rows.length,
    source: input.source,
    actor: input.actor,
    pdfSha256s: rows.map((row) => row.pdf_sha256 ?? "").filter((value) => value.length > 0).sort(),
    snapshotSha256s: snapshots.map((snapshot) => snapshot.snapshotSha256).sort(),
  });
}

async function generateOneInvestorConfirmation(input: {
  db: PrismaClient;
  settlementId: string;
  investorOrganizationId: string;
  source: ConfirmationGenerationSource;
  createIfMissing?: boolean;
}): Promise<void> {
  const existingRows = await loadInvestorConfirmationRows(
    input.db,
    input.settlementId,
    input.investorOrganizationId
  );
  const latest = latestOfficialDocumentVersion(existingRows.map((row) => row.version));
  let row = latest ? existingRows.find((item) => item.version === latest) ?? null : null;
  if (confirmationRowReady(row) && row) {
    await maybeMarkFirstConfirmationCurrent({
      db: input.db,
      settlementId: input.settlementId,
      investorOrganizationId: input.investorOrganizationId,
      version: row.version,
    });
    return;
  }
  if (!row && input.createIfMissing === false) return;

  let snapshot = row ? parseConfirmationSnapshot(row.snapshot) : null;
  if (!snapshot) {
    if (row) return;
    try {
      snapshot = await buildInvestmentSettlementConfirmationSnapshot({
        settlementId: input.settlementId,
        investorOrganizationId: input.investorOrganizationId,
        source: input.source,
      });
    } catch (error) {
      const posted = await loadPostedSettlement(input.db, input.settlementId);
      logger.error(
        { err: error, settlementId: input.settlementId, investorOrganizationId: input.investorOrganizationId },
        "Investment settlement confirmation snapshot failed"
      );
      if (error instanceof ConfirmationGenerationError && posted) {
        await persistIncompleteFailure({
          db: input.db,
          noteId: posted.note_id,
          settlementId: posted.id,
          investorOrganizationId: input.investorOrganizationId,
          error,
        });
      }
      return;
    }
  }

  try {
    row = await ensureConfirmationRow({ db: input.db, snapshot });
    if (confirmationRowReady(row)) {
      await maybeMarkFirstConfirmationCurrent({
        db: input.db,
        settlementId: input.settlementId,
        investorOrganizationId: input.investorOrganizationId,
        version: row.version,
      });
      return;
    }
    const frozen = parseConfirmationSnapshot(row.snapshot) ?? snapshot;
    await generatePdfForRow({ db: input.db, row, snapshot: frozen });
  } catch (error) {
    logger.error(
      { err: error, settlementId: input.settlementId, investorOrganizationId: input.investorOrganizationId },
      "Investment settlement confirmation PDF generation failed"
    );
    const failedRows = await loadInvestorConfirmationRows(
      input.db,
      input.settlementId,
      input.investorOrganizationId
    );
    const failedVersion = latestOfficialDocumentVersion(failedRows.map((item) => item.version));
    const failedRow = failedVersion
      ? failedRows.find((item) => item.version === failedVersion)
      : null;
    if (failedRow) await markRowFailed(input.db, failedRow.id, error);
  }
}

/**
 * Generate or resume investor confirmation PDFs for a posted settlement.
 * createMissing=false resumes existing PENDING/FAILED rows only.
 */
export async function generateInvestmentSettlementConfirmations(
  input: {
    settlementId: string;
    source: ConfirmationGenerationSource;
    actor?: ActorContext;
    createMissing?: boolean;
    investorOrganizationIds?: string[];
  },
  db: PrismaClient = defaultPrisma
): Promise<void> {
  const posted = await loadPostedSettlement(db, input.settlementId);
  if (!posted || posted.status !== NoteSettlementStatus.POSTED) return;

  const expectedIds = expectedInvestorOrganizationIds(
    parseSettlementAllocations(posted.preview_snapshot)
  );
  const orgIds = input.investorOrganizationIds ?? expectedIds;
  for (const investorOrganizationId of orgIds) {
    const rows = await loadInvestorConfirmationRows(db, input.settlementId, investorOrganizationId);
    if (input.createMissing === false && rows.length === 0) continue;
    if (input.createMissing === true && rows.length > 0) continue;
    await generateOneInvestorConfirmation({
      db,
      settlementId: input.settlementId,
      investorOrganizationId,
      source: input.source,
      createIfMissing: input.createMissing !== false,
    });
  }
  await maybeWriteSettlementAudit({
    db,
    settlementId: input.settlementId,
    source: input.source,
    actor: input.actor,
  });
}

export function scheduleInvestmentSettlementConfirmations(input: {
  settlementId: string;
  source: ConfirmationGenerationSource;
  actor?: ActorContext;
}): void {
  void generateInvestmentSettlementConfirmations({ ...input, createMissing: false }).catch((error) => {
    logger.error(
      { err: error, settlementId: input.settlementId },
      "Investment settlement confirmation generation threw"
    );
  });
}

export async function retryFailedInvestmentSettlementConfirmations(
  db: PrismaClient = defaultPrisma,
  limit = 20
) {
  const rows = await db.investmentSettlementConfirmation.findMany({
    where: {
      OR: [
        { status: InvestmentSettlementConfirmationStatus.PENDING },
        { status: InvestmentSettlementConfirmationStatus.FAILED },
      ],
    },
    orderBy: { updated_at: "asc" },
    take: limit,
    select: { settlement_id: true, investor_organization_id: true },
  });
  const scopes = [
    ...new Map(
      rows.map((row) => [`${row.settlement_id}:${row.investor_organization_id}`, row])
    ).values(),
  ];
  let succeeded = 0;
  let failed = 0;
  for (const scope of scopes) {
    await generateOneInvestorConfirmation({
      db,
      settlementId: scope.settlement_id,
      investorOrganizationId: scope.investor_organization_id,
      source: "ADMIN_RETRY",
      createIfMissing: false,
    });
    const after = await loadInvestorConfirmationRows(
      db,
      scope.settlement_id,
      scope.investor_organization_id
    );
    const latest = latestOfficialDocumentVersion(after.map((row) => row.version));
    const latestRow = latest ? after.find((row) => row.version === latest) : null;
    if (confirmationRowReady(latestRow)) succeeded += 1;
    else failed += 1;
  }
  return { attempted: scopes.length, succeeded, failed };
}

export async function retryAdminInvestmentSettlementConfirmation(
  noteId: string,
  investorOrganizationId: string,
  actor: ActorContext,
  db: PrismaClient = defaultPrisma
): Promise<AdminInvestmentSettlementConfirmationsPayload> {
  const posted = await db.noteSettlement.findFirst({
    where: { note_id: noteId, status: NoteSettlementStatus.POSTED },
    orderBy: { posted_at: "desc" },
    select: { id: true },
  });
  if (!posted) throw new AppError(404, "SETTLEMENT_NOT_FOUND", "Posted settlement not found");
  const rows = await loadInvestorConfirmationRows(db, posted.id, investorOrganizationId);
  const latest = latestOfficialDocumentVersion(rows.map((row) => row.version));
  const row = latest ? rows.find((item) => item.version === latest) ?? null : null;
  if (row?.status !== InvestmentSettlementConfirmationStatus.FAILED) {
    throw new AppError(
      409,
      "CONFIRMATION_RETRY_NOT_ALLOWED",
      "Retry is only available when confirmation generation has failed"
    );
  }
  await generateOneInvestorConfirmation({
    db,
    settlementId: posted.id,
    investorOrganizationId,
    source: "ADMIN_RETRY",
    createIfMissing: false,
  });
  await maybeWriteSettlementAudit({
    db,
    settlementId: posted.id,
    source: "ADMIN_RETRY",
    actor,
  });
  return getAdminInvestmentSettlementConfirmations(noteId, db);
}

export async function generateAdminInvestmentSettlementConfirmation(
  noteId: string,
  investorOrganizationId: string,
  actor: ActorContext,
  db: PrismaClient = defaultPrisma
): Promise<AdminInvestmentSettlementConfirmationsPayload> {
  const posted = await db.noteSettlement.findFirst({
    where: { note_id: noteId, status: NoteSettlementStatus.POSTED },
    orderBy: { posted_at: "desc" },
    select: { id: true },
  });
  if (!posted) throw new AppError(404, "SETTLEMENT_NOT_FOUND", "Posted settlement not found");
  const rows = await loadInvestorConfirmationRows(db, posted.id, investorOrganizationId);
  if (rows.length > 0) {
    throw new AppError(
      409,
      "CONFIRMATION_GENERATE_NOT_ALLOWED",
      "Confirmation already exists. Use Retry for a failed version or Regenerate for a new version"
    );
  }
  await generateOneInvestorConfirmation({
    db,
    settlementId: posted.id,
    investorOrganizationId,
    source: "ADMIN_GENERATE",
    createIfMissing: true,
  });
  await maybeWriteSettlementAudit({
    db,
    settlementId: posted.id,
    source: "ADMIN_GENERATE",
    actor,
  });
  return getAdminInvestmentSettlementConfirmations(noteId, db);
}

export async function generateAllAdminInvestmentSettlementConfirmations(
  noteId: string,
  actor: ActorContext,
  db: PrismaClient = defaultPrisma
): Promise<AdminInvestmentSettlementConfirmationsPayload> {
  const posted = await db.noteSettlement.findFirst({
    where: { note_id: noteId, status: NoteSettlementStatus.POSTED },
    orderBy: { posted_at: "desc" },
    select: { id: true },
  });
  if (!posted) throw new AppError(404, "SETTLEMENT_NOT_FOUND", "Posted settlement not found");
  await generateInvestmentSettlementConfirmations(
    { settlementId: posted.id, source: "ADMIN_GENERATE", actor, createMissing: true },
    db
  );
  return getAdminInvestmentSettlementConfirmations(noteId, db);
}

export async function reissueAdminInvestmentSettlementConfirmation(
  noteId: string,
  investorOrganizationId: string,
  actor: ActorContext,
  db: PrismaClient = defaultPrisma
): Promise<AdminInvestmentSettlementConfirmationsPayload> {
  const posted = await db.noteSettlement.findFirst({
    where: { note_id: noteId, status: NoteSettlementStatus.POSTED },
    orderBy: { posted_at: "desc" },
    select: { id: true, display_reference: true },
  });
  if (!posted) throw new AppError(404, "SETTLEMENT_NOT_FOUND", "Posted settlement not found");
  const rows = await loadInvestorConfirmationRows(db, posted.id, investorOrganizationId);
  const currentVersion = currentOfficialDocumentVersion(rows);
  const currentRow = currentVersion
    ? rows.find((row) => row.version === currentVersion) ?? null
    : null;
  if (!confirmationRowReady(currentRow) || !currentVersion) {
    throw new AppError(
      409,
      "CONFIRMATION_REISSUE_NOT_ALLOWED",
      "Regenerate is only available for a READY current confirmation"
    );
  }
  const latest = latestOfficialDocumentVersion(rows.map((row) => row.version));
  const latestRow = latest ? rows.find((row) => row.version === latest) ?? null : null;
  if (latest && latest !== currentVersion && latestRow?.status !== InvestmentSettlementConfirmationStatus.READY) {
    throw new AppError(
      409,
      "CONFIRMATION_REISSUE_NOT_ALLOWED",
      latestRow?.status === InvestmentSettlementConfirmationStatus.FAILED
        ? "Retry the failed regenerated version before creating another"
        : "Wait for the regenerated version to finish before creating another"
    );
  }
  const previousSnapshot = parseConfirmationSnapshot(currentRow!.snapshot);
  if (!previousSnapshot) {
    throw new AppError(
      409,
      "CONFIRMATION_REISSUE_NOT_ALLOWED",
      "The READY confirmation snapshot is missing"
    );
  }
  const nextVersion = nextOfficialDocumentVersion(latest ?? currentVersion);
  const nextSnapshot = reissueConfirmationSnapshotFromReady(previousSnapshot, {
    version: nextVersion,
    source: "ADMIN_REISSUE",
  });
  try {
    const row = await ensureConfirmationRow({ db, snapshot: nextSnapshot });
    await generatePdfForRow({ db, row, snapshot: nextSnapshot });
  } catch (error) {
    const failed = await loadConfirmationRow(db, posted.id, investorOrganizationId, nextVersion);
    if (failed) await markRowFailed(db, failed.id, error);
    return getAdminInvestmentSettlementConfirmations(noteId, db);
  }
  const refreshed = await loadConfirmationRow(db, posted.id, investorOrganizationId, nextVersion);
  if (confirmationRowReady(refreshed)) {
    await writeReissuedConfirmationAuditEvent({
      db,
      noteId,
      settlementId: posted.id,
      settlementReference: posted.display_reference ?? posted.id,
      investorOrganizationId,
      previousVersion: currentVersion,
      previousSnapshotSha256: previousSnapshot.snapshotSha256,
      snapshot: nextSnapshot,
      actor,
      pdfSha256: refreshed?.pdf_sha256 ?? null,
    });
  }
  return getAdminInvestmentSettlementConfirmations(noteId, db);
}

export async function publishAdminInvestmentSettlementConfirmation(
  noteId: string,
  investorOrganizationId: string,
  actor: ActorContext,
  db: PrismaClient = defaultPrisma
): Promise<AdminInvestmentSettlementConfirmationsPayload> {
  const posted = await db.noteSettlement.findFirst({
    where: { note_id: noteId, status: NoteSettlementStatus.POSTED },
    orderBy: { posted_at: "desc" },
    select: { id: true, display_reference: true },
  });
  if (!posted) throw new AppError(404, "SETTLEMENT_NOT_FOUND", "Posted settlement not found");
  const rows = await loadInvestorConfirmationRows(db, posted.id, investorOrganizationId);
  const previousVersion = currentOfficialDocumentVersion(rows);
  const reviewVersion = unpublishedLatestOfficialDocumentVersion(rows, previousVersion);
  const reviewRow = reviewVersion
    ? rows.find((row) => row.version === reviewVersion) ?? null
    : null;
  if (!confirmationRowReady(reviewRow) || !reviewVersion) {
    throw new AppError(
      409,
      "CONFIRMATION_PUBLISH_NOT_ALLOWED",
      "Publish New Version is only available for a regenerated READY confirmation"
    );
  }
  await setConfirmationVersionCurrent(db, posted.id, investorOrganizationId, reviewVersion);
  const snapshot = parseConfirmationSnapshot(reviewRow!.snapshot);
  const metadata = {
    documentType: "INVESTMENT_SETTLEMENT_CONFIRMATION",
    noteId,
    settlementId: posted.id,
    settlementReference: posted.display_reference,
    investorOrganizationId,
    version: reviewVersion,
    previousVersion,
    publishedAt: new Date().toISOString(),
    snapshotSha256: snapshot?.snapshotSha256 ?? null,
    pdfSha256: reviewRow!.pdf_sha256,
    source: "ADMIN_PUBLISH",
  };
  const target = resolveNoteEventTarget("INVESTMENT_SETTLEMENT_CONFIRMATION_PUBLISHED", metadata);
  await createNoteEventRow(db, {
    noteId,
    eventType: "INVESTMENT_SETTLEMENT_CONFIRMATION_PUBLISHED",
    actorUserId: actor.userId,
    actorRole: actor.role,
    portal: actor.portal ?? AUDIT_PORTAL.ADMIN,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    correlationId: actor.correlationId,
    context:
      actor.auditContext ??
      systemAuditContext({
        portal: AUDIT_PORTAL.ADMIN,
        actorUserId: actor.userId,
        correlationId:
          actor.correlationId ??
          `investment-settlement-confirmation-publish:${posted.id}:${investorOrganizationId}`,
      }),
    metadata,
    targetType: target.targetType,
    targetId: target.targetId ?? posted.id,
  });
  return getAdminInvestmentSettlementConfirmations(noteId, db);
}

async function writeReissuedConfirmationAuditEvent(input: {
  db: PrismaClient;
  noteId: string;
  settlementId: string;
  settlementReference: string;
  investorOrganizationId: string;
  previousVersion: string;
  previousSnapshotSha256: string;
  snapshot: InvestmentSettlementConfirmationSnapshot;
  actor: ActorContext;
  pdfSha256: string | null;
}): Promise<void> {
  const metadata = {
    documentType: "INVESTMENT_SETTLEMENT_CONFIRMATION",
    noteId: input.noteId,
    settlementId: input.settlementId,
    settlementReference: input.settlementReference,
    investorOrganizationId: input.investorOrganizationId,
    version: input.snapshot.version,
    previousVersion: input.previousVersion,
    newVersion: input.snapshot.version,
    generatedAt: new Date().toISOString(),
    oldSnapshotSha256: input.previousSnapshotSha256,
    newSnapshotSha256: input.snapshot.snapshotSha256,
    snapshotSha256: input.snapshot.snapshotSha256,
    pdfSha256: input.pdfSha256,
    source: "ADMIN_REISSUE",
  };
  const target = resolveNoteEventTarget(
    "INVESTMENT_SETTLEMENT_CONFIRMATION_REISSUED",
    metadata
  );
  await createNoteEventRow(input.db, {
    noteId: input.noteId,
    eventType: "INVESTMENT_SETTLEMENT_CONFIRMATION_REISSUED",
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
          `investment-settlement-confirmation-reissue:${input.settlementId}:${input.investorOrganizationId}`,
      }),
    metadata,
    targetType: target.targetType,
    targetId: target.targetId ?? input.settlementId,
  });
}

async function payloadForRow(input: {
  row: ConfirmationRow | null;
  hideError?: boolean;
  isCurrent?: boolean;
  canGenerate?: boolean;
  canRegenerate?: boolean;
  canPublish?: boolean;
  reviewVersion?: OfficialDocumentReviewVersion | null;
}): Promise<InvestmentSettlementConfirmationPdfPayload> {
  const row = input.row;
  if (!row) {
    return emptyInvestorPayload({
      canGenerate: input.canGenerate === true,
      reviewVersion: input.reviewVersion ?? null,
    });
  }
  const snapshot = parseConfirmationSnapshot(row.snapshot);
  const ready = row.status === InvestmentSettlementConfirmationStatus.READY && row.pdf_s3_key;
  const fileName = confirmationPdfFileName({
    noteReference: snapshot?.noteReference ?? row.note_id,
    investorReference: snapshot?.investorReference ?? row.investor_organization_id,
  });
  const urls = ready
    ? await signedPdfUrls({ storageKey: row.pdf_s3_key!, fileName })
    : null;
  return emptyInvestorPayload({
    ...(snapshot ? displayFromSnapshot(snapshot) : {}),
    version: row.version,
    status: row.status,
    isCurrent: input.isCurrent === true,
    generationError: input.hideError ? null : row.generation_error,
    generatedAt: row.generated_at?.toISOString() ?? null,
    canGenerate: input.canGenerate === true,
    canRetry: input.hideError ? false : row.status === InvestmentSettlementConfirmationStatus.FAILED,
    canRegenerate: input.canRegenerate === true && row.status === InvestmentSettlementConfirmationStatus.READY,
    canPublish: input.canPublish === true,
    viewUrl: urls?.viewUrl ?? null,
    downloadUrl: urls?.downloadUrl ?? null,
    pdfExpiresIn: urls?.expiresIn ?? null,
    pdfFileName: ready ? fileName : null,
    pdfSha256: row.pdf_sha256,
    reviewVersion: input.reviewVersion ?? null,
  });
}

async function reviewPayloadForConfirmation(
  row: ConfirmationRow | null
): Promise<OfficialDocumentReviewVersion | null> {
  if (!row) return null;
  const snapshot = parseConfirmationSnapshot(row.snapshot);
  const ready = row.status === InvestmentSettlementConfirmationStatus.READY && row.pdf_s3_key;
  const fileName = confirmationPdfFileName({
    noteReference: snapshot?.noteReference ?? row.note_id,
    investorReference: snapshot?.investorReference ?? row.investor_organization_id,
  });
  const urls = ready
    ? await signedPdfUrls({ storageKey: row.pdf_s3_key!, fileName })
    : null;
  return {
    version: row.version,
    status: row.status,
    generationError: row.generation_error,
    generatedAt: row.generated_at?.toISOString() ?? null,
    canRetry: row.status === InvestmentSettlementConfirmationStatus.FAILED,
    canPublish: row.status === InvestmentSettlementConfirmationStatus.READY,
    viewUrl: urls?.viewUrl ?? null,
    downloadUrl: urls?.downloadUrl ?? null,
    pdfExpiresIn: urls?.expiresIn ?? null,
    pdfFileName: ready ? fileName : null,
    pdfSha256: row.pdf_sha256,
  };
}

export async function getAdminInvestmentSettlementConfirmations(
  noteId: string,
  db: PrismaClient = defaultPrisma
): Promise<AdminInvestmentSettlementConfirmationsPayload> {
  const note = await db.note.findUnique({ where: { id: noteId }, select: { id: true } });
  if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
  const posted = await db.noteSettlement.findFirst({
    where: { note_id: noteId, status: NoteSettlementStatus.POSTED },
    orderBy: { posted_at: "desc" },
    select: { id: true, display_reference: true, preview_snapshot: true },
  });
  if (!posted) {
    return {
      settlementId: null,
      settlementReference: null,
      version: CONFIRMATION_FIRST_VERSION,
      expectedCount: 0,
      readyCount: 0,
      pendingCount: 0,
      failedCount: 0,
      canGenerateAll: false,
      confirmations: [],
    };
  }
  const expectedOrgIds = expectedInvestorOrganizationIds(
    parseSettlementAllocations(posted.preview_snapshot)
  );
  const allRows = await db.investmentSettlementConfirmation.findMany({
    where: { settlement_id: posted.id },
    orderBy: { created_at: "asc" },
  });
  const orgs = expectedOrgIds.length
    ? await db.investorOrganization.findMany({
        where: { id: { in: expectedOrgIds } },
        select: { id: true, display_reference: true },
      })
    : [];
  const orgById = new Map(orgs.map((org) => [org.id, org]));
  const confirmations: AdminInvestmentSettlementConfirmationItem[] = [];
  for (const orgId of expectedOrgIds) {
    const investorRows = allRows.filter((row) => row.investor_organization_id === orgId);
    const currentVersion = currentOfficialDocumentVersion(investorRows);
    const latest = latestOfficialDocumentVersion(investorRows.map((row) => row.version));
    const reviewVersionKey = unpublishedLatestOfficialDocumentVersion(investorRows, currentVersion);
    const mainVersion = currentVersion ?? latest;
    const mainRow = mainVersion
      ? investorRows.find((row) => row.version === mainVersion) ?? null
      : null;
    const reviewRow = reviewVersionKey
      ? investorRows.find((row) => row.version === reviewVersionKey) ?? null
      : null;
    const payload = await payloadForRow({
      row: mainRow,
      isCurrent: currentVersion === mainVersion && confirmationRowReady(mainRow),
      canGenerate: investorRows.length === 0,
      canRegenerate:
        confirmationRowReady(currentVersion ? investorRows.find((row) => row.version === currentVersion) : null) &&
        (reviewVersionKey == null || reviewRow?.status === InvestmentSettlementConfirmationStatus.READY),
      reviewVersion: await reviewPayloadForConfirmation(reviewRow),
    });
    const snapshot = mainRow ? parseConfirmationSnapshot(mainRow.snapshot) : null;
    const fallbackRef = certificatePartyDisplayReference(
      orgById.get(orgId)?.display_reference,
      orgId
    );
    confirmations.push({
      investorOrganizationId: orgId,
      investorReference: snapshot?.investorReference ?? fallbackRef,
      version: payload.version,
      status: payload.status,
      isCurrent: payload.isCurrent,
      generationError: payload.generationError,
      generatedAt: payload.generatedAt,
      canGenerate: payload.canGenerate,
      canRetry: payload.canRetry,
      canRegenerate: payload.canRegenerate,
      canPublish: payload.canPublish,
      viewUrl: payload.viewUrl,
      downloadUrl: payload.downloadUrl,
      pdfExpiresIn: payload.pdfExpiresIn,
      pdfContentType: payload.pdfContentType,
      pdfFileName: payload.pdfFileName,
      pdfSha256: payload.pdfSha256,
      totalCreditedToWallet: payload.totalCreditedToWallet,
      reviewVersion: payload.reviewVersion,
    });
  }
  const generateable = confirmations.filter((row) => row.canGenerate);
  return {
    settlementId: posted.id,
    settlementReference: posted.display_reference,
    version: CONFIRMATION_FIRST_VERSION,
    expectedCount: expectedOrgIds.length,
    readyCount: confirmations.filter((row) => row.status === "READY" && row.isCurrent).length,
    pendingCount: confirmations.filter((row) => row.status === "PENDING").length,
    failedCount: confirmations.filter((row) => row.status === "FAILED").length,
    canGenerateAll: generateable.length > 1,
    confirmations,
  };
}

export async function getInvestorInvestmentSettlementConfirmation(
  investmentId: string,
  userId: string,
  db: PrismaClient = defaultPrisma
): Promise<InvestmentSettlementConfirmationPdfPayload> {
  const investment = await db.noteInvestment.findUnique({
    where: { id: investmentId },
    select: { id: true, note_id: true, investor_organization_id: true },
  });
  if (!investment) throw new AppError(404, "INVESTMENT_NOT_FOUND", "Investment not found");

  const orgAccess = await db.investorOrganization.findFirst({
    where: {
      id: investment.investor_organization_id,
      OR: [{ owner_user_id: userId }, { members: { some: { user_id: userId } } }],
    },
    select: { id: true },
  });
  if (!orgAccess) {
    throw new AppError(403, "INVESTMENT_FORBIDDEN", "Investment is not accessible");
  }

  const posted = await db.noteSettlement.findFirst({
    where: { note_id: investment.note_id, status: NoteSettlementStatus.POSTED },
    orderBy: { posted_at: "desc" },
    select: { id: true },
  });
  if (!posted) return emptyInvestorPayload();

  const rows = await loadInvestorConfirmationRows(
    db,
    posted.id,
    investment.investor_organization_id
  );
  const currentVersion = currentOfficialDocumentVersion(rows);
  const viewRow = currentVersion
    ? rows.find((row) => row.version === currentVersion) ?? null
    : null;
  if (!confirmationRowReady(viewRow)) {
    return emptyInvestorPayload();
  }
  return payloadForRow({
    row: viewRow,
    hideError: true,
    isCurrent: true,
  });
}
