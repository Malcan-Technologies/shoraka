import {
  InvestmentSettlementConfirmationStatus,
  NoteSettlementStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import type {
  AdminInvestmentSettlementConfirmationsPayload,
  InvestmentSettlementConfirmationPdfPayload,
} from "@cashsouk/types";
import {
  INVESTMENT_SETTLEMENT_CONFIRMATION_INTRO,
  INVESTMENT_SETTLEMENT_CONFIRMATION_PROCESSING_NOTICE,
  INVESTMENT_SETTLEMENT_CONFIRMATION_STATUS_LABEL,
  INVESTMENT_SETTLEMENT_CONFIRMATION_VERSION_V01,
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
import { buildInvestmentSettlementConfirmationHtml } from "./confirmation-html";
import { renderConfirmationHtmlToPdfBuffer } from "./render-confirmation-html-to-pdf";
import {
  buildInvestmentSettlementConfirmationSnapshot,
  expectedInvestorOrganizationIds,
  parseConfirmationSnapshot,
  parseSettlementAllocations,
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
    canRetry: false,
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
  version = CONFIRMATION_FIRST_VERSION
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
    input.investorOrganizationId
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
        version: CONFIRMATION_FIRST_VERSION,
        status: InvestmentSettlementConfirmationStatus.PENDING,
        snapshot: input.snapshot as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
  }
  const row = await loadConfirmationRow(
    input.db,
    input.snapshot.settlementId,
    input.snapshot.investorOrganizationId
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
          input.snapshot.investorOrganizationId
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
      meta?.version === INVESTMENT_SETTLEMENT_CONFIRMATION_VERSION_V01
    );
  });
  if (alreadyWritten) return;

  const actor = input.actor;
  const metadata = {
    noteId: input.noteId,
    settlementId: input.settlementId,
    settlementReference: input.settlementReference,
    version: INVESTMENT_SETTLEMENT_CONFIRMATION_VERSION_V01,
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
}): Promise<void> {
  let row = await loadConfirmationRow(input.db, input.settlementId, input.investorOrganizationId);
  if (row?.status === InvestmentSettlementConfirmationStatus.READY && row.pdf_s3_key) {
    return;
  }

  let snapshot = row ? parseConfirmationSnapshot(row.snapshot) : null;
  if (!snapshot) {
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
    if (row.status === InvestmentSettlementConfirmationStatus.READY && row.pdf_s3_key) return;
    const frozen = parseConfirmationSnapshot(row.snapshot) ?? snapshot;
    await generatePdfForRow({ db: input.db, row, snapshot: frozen });
  } catch (error) {
    logger.error(
      { err: error, settlementId: input.settlementId, investorOrganizationId: input.investorOrganizationId },
      "Investment settlement confirmation PDF generation failed"
    );
    const failedRow = await loadConfirmationRow(
      input.db,
      input.settlementId,
      input.investorOrganizationId
    );
    if (failedRow) await markRowFailed(input.db, failedRow.id, error);
  }
}

/**
 * Generate (or resume) V01 investor confirmation PDFs for a posted settlement.
 * Never called inside a financial transaction. Failures mark FAILED only.
 */
export async function generateInvestmentSettlementConfirmations(
  input: {
    settlementId: string;
    source: ConfirmationGenerationSource;
    actor?: ActorContext;
  },
  db: PrismaClient = defaultPrisma
): Promise<void> {
  const posted = await loadPostedSettlement(db, input.settlementId);
  if (!posted || posted.status !== NoteSettlementStatus.POSTED) return;

  const orgIds = expectedInvestorOrganizationIds(parseSettlementAllocations(posted.preview_snapshot));
  for (const investorOrganizationId of orgIds) {
    await generateOneInvestorConfirmation({
      db,
      settlementId: input.settlementId,
      investorOrganizationId,
      source: input.source,
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
  void generateInvestmentSettlementConfirmations(input).catch((error) => {
    logger.error(
      { err: error, settlementId: input.settlementId },
      "Investment settlement confirmation generation threw after settlement"
    );
  });
}

export async function retryFailedInvestmentSettlementConfirmations(
  db: PrismaClient = defaultPrisma,
  limit = 20
) {
  const rows = await db.investmentSettlementConfirmation.findMany({
    where: {
      version: CONFIRMATION_FIRST_VERSION,
      OR: [
        { status: InvestmentSettlementConfirmationStatus.PENDING },
        { status: InvestmentSettlementConfirmationStatus.FAILED },
      ],
    },
    orderBy: { updated_at: "asc" },
    take: limit,
    select: { settlement_id: true },
  });
  const settlementIds = [...new Set(rows.map((row) => row.settlement_id))];
  let succeeded = 0;
  let failed = 0;
  for (const settlementId of settlementIds) {
    await generateInvestmentSettlementConfirmations(
      {
        settlementId,
        source: "ADMIN_RETRY",
        actor: {
          userId: "SYS",
          role: "SYSTEM",
          portal: AUDIT_PORTAL.ADMIN,
          auditContext: systemAuditContext({
            portal: AUDIT_PORTAL.ADMIN,
            actorUserId: "SYS",
            correlationId: `cron:investment-settlement-confirmation:${settlementId}`,
          }),
        },
      },
      db
    );
    const remaining = await db.investmentSettlementConfirmation.count({
      where: {
        settlement_id: settlementId,
        version: CONFIRMATION_FIRST_VERSION,
        status: { not: InvestmentSettlementConfirmationStatus.READY },
      },
    });
    if (remaining === 0) succeeded += 1;
    else failed += 1;
  }
  return { attempted: settlementIds.length, succeeded, failed };
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
  const row = await loadConfirmationRow(db, posted.id, investorOrganizationId);
  if (row?.status !== InvestmentSettlementConfirmationStatus.FAILED) {
    throw new AppError(
      409,
      "CONFIRMATION_RETRY_NOT_ALLOWED",
      "Retry is only available when confirmation generation has failed"
    );
  }
  await generateInvestmentSettlementConfirmations(
    { settlementId: posted.id, source: "ADMIN_RETRY", actor },
    db
  );
  return getAdminInvestmentSettlementConfirmations(noteId, db);
}

async function payloadForRow(input: {
  row: ConfirmationRow | null;
  hideError?: boolean;
}): Promise<InvestmentSettlementConfirmationPdfPayload> {
  const row = input.row;
  if (!row) return emptyInvestorPayload();
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
    generationError: input.hideError ? null : row.generation_error,
    generatedAt: row.generated_at?.toISOString() ?? null,
    canRetry: input.hideError ? false : row.status === InvestmentSettlementConfirmationStatus.FAILED,
    viewUrl: urls?.viewUrl ?? null,
    downloadUrl: urls?.downloadUrl ?? null,
    pdfExpiresIn: urls?.expiresIn ?? null,
    pdfFileName: ready ? fileName : null,
    pdfSha256: row.pdf_sha256,
  });
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
      confirmations: [],
    };
  }
  const expectedOrgIds = expectedInvestorOrganizationIds(
    parseSettlementAllocations(posted.preview_snapshot)
  );
  const rows = await db.investmentSettlementConfirmation.findMany({
    where: { settlement_id: posted.id, version: CONFIRMATION_FIRST_VERSION },
    orderBy: { created_at: "asc" },
  });
  const confirmations = [];
  for (const row of rows) {
    const payload = await payloadForRow({ row });
    const snapshot = parseConfirmationSnapshot(row.snapshot);
    confirmations.push({
      investorOrganizationId: row.investor_organization_id,
      investorReference: snapshot?.investorReference ?? row.investor_organization_id,
      status: row.status,
      generationError: row.generation_error,
      generatedAt: row.generated_at?.toISOString() ?? null,
      canRetry: row.status === InvestmentSettlementConfirmationStatus.FAILED,
      viewUrl: payload.viewUrl,
      downloadUrl: payload.downloadUrl,
      pdfExpiresIn: payload.pdfExpiresIn,
      pdfContentType: payload.pdfContentType,
      pdfFileName: payload.pdfFileName,
      pdfSha256: row.pdf_sha256,
      totalCreditedToWallet: payload.totalCreditedToWallet,
    });
  }
  return {
    settlementId: posted.id,
    settlementReference: posted.display_reference,
    version: CONFIRMATION_FIRST_VERSION,
    expectedCount: expectedOrgIds.length,
    readyCount: rows.filter((row) => row.status === InvestmentSettlementConfirmationStatus.READY).length,
    pendingCount: rows.filter((row) => row.status === InvestmentSettlementConfirmationStatus.PENDING)
      .length,
    failedCount: rows.filter((row) => row.status === InvestmentSettlementConfirmationStatus.FAILED)
      .length,
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

  const row = await loadConfirmationRow(db, posted.id, investment.investor_organization_id);
  return payloadForRow({ row, hideError: true });
}
