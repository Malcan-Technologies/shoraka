/**
 * SECTION: Prospectus Review service (Draft → Approved → Published)
 * WHY: Direct approve, change-based invalidation, complete freeze at approve, copy-only publish
 */

import { createHash, randomBytes } from "node:crypto";
import {
  NoteStatus,
  Prisma,
  ProspectusReviewStatus,
  type NoteProspectusReview,
} from "@prisma/client";
import {
  buildProspectusHighlightRecommendations,
  isMarcSmeGrade,
  isCompleteIssuerMarcAssessment,
  isNoteProspectusPublished,
  normalizeProspectusWorkflowStatus,
  type ProspectusAboutInvoiceRecommendationInput,
  type ProspectusHighlightRecommendationInput,
} from "@cashsouk/types";
import { mergeApplicationAdminFinancialSupplementsIntoOrg } from "../../applications/issuer-organization-financial-statements";
import { AppError } from "../../../lib/http/error-handler";
import { prisma } from "../../../lib/prisma";
import {
  AUDIT_TARGET_TYPE,
  changedFieldsOf,
  createNoteAdminActionRow,
  createNoteEventRow,
} from "../../../lib/audit";
import { toAdminIssuerTrackRecordRows } from "../prospectus/prospectus-issuer-track-record";
import { toAdminHistoricalNoteTable } from "../prospectus/prospectus-historical-note-table";
import { toAdminIssuerProfileRows } from "../prospectus/prospectus-issuer-profile";
import { toAdminInvoicePaymasterRows } from "../prospectus/prospectus-invoice-paymaster";
import { toAdminPaymasterTrackRecordRows } from "../prospectus/prospectus-paymaster-track-record";
import { toAdminFinancialComparisonTable, toAdminFrozenFinancialYears } from "../prospectus/prospectus-financial-comparison-metrics";
import { combineProspectusPagesHtml } from "../prospectus/combine-prospectus-pages-html";
import {
  generateAndStoreProspectusPdf,
  type ProspectusPdfArtifact,
} from "../prospectus/prospectus-pdf";
import { buildProspectusPageOneHtml } from "../prospectus/prospectus-page-one.html";
import {
  buildProspectusPageOne,
  mapProspectusPageOneDataToInput,
} from "../prospectus/prospectus-page-one-mapper";
import { loadProspectusPageOneNote } from "../prospectus/prospectus-page-one-prisma";
import { buildProspectusPageTwoHtml } from "../prospectus/prospectus-page-two.html";
import {
  buildProspectusPageTwo,
  mapProspectusPageTwoDataToInput,
} from "../prospectus/prospectus-page-two-mapper";
import { loadProspectusPageTwoData } from "../prospectus/prospectus-page-two-prisma";
import { buildProspectusPageThreeHtml } from "../prospectus/prospectus-page-three.html";
import { buildProspectusPageFourHtml, buildProspectusPageFiveHtml } from "../prospectus/prospectus-marc-appendix.html";
import {
  buildProspectusPageThree,
  mapProspectusPageThreeDataToInput,
} from "../prospectus/prospectus-page-three-mapper";
import { loadProspectusPageThreeData } from "../prospectus/prospectus-page-three-prisma";
import { resolveMarcSnapshotForProspectus } from "../prospectus/prospectus-marc-snapshot";
import { getActiveProspectusCatalogues } from "./prospectus-option-catalogues";
import { mergePublicationContentIntoSnapshot } from "./prospectus-frozen-publication";
import {
  buildCompleteApprovedProspectusSnapshot,
  computeCurrentRenderFingerprint,
  hashDraftContent,
  hashProspectusFingerprint,
  parseApprovedSnapshot,
  withApprovedSnapshotHtml,
  type ProspectusApprovedSnapshot,
} from "./prospectus-approved-snapshot";
import {
  catalogueVersion,
  cloneReviewContent,
  emptyProspectusReviewContent,
  normalizeProspectusReviewSelections,
  stripLegacyPaymentBasisShariahKeys,
  toProspectusPublicationContent,
  type ProspectusFrozenPublicationContent,
  type ProspectusReviewStoredContent,
} from "./prospectus-review-content";
import {
  saveProspectusReviewDraftSchema,
  validateApprovalContent,
  validateDraftContent,
  type SaveProspectusReviewDraftInput,
} from "./prospectus-review.schemas";
// TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
import {
  approvedSnapshotDiag,
  diagChangedKeys,
  diagSafeHash,
  diffFingerprintDiagSummaries,
  getFingerprintDiagSummary,
  prospectusDiag,
  prospectusDiagRethrow,
  reviewRowDiag,
  setProspectusDiagStash,
  withProspectusDiagError,
} from "./prospectus-diagnostics";

type ActorContext = {
  userId: string;
  role?: string;
  portal?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
};

/** Notes created on/after this instant require an APPROVED prospectus to publish. */
export const PROSPECTUS_REVIEW_REQUIRED_FROM = new Date("2026-07-19T00:00:00.000Z");

const PUBLISH_BLOCKED =
  "Approve the Prospectus before publishing this Note.";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asStoredContent(value: unknown): ProspectusReviewStoredContent {
  return value as unknown as ProspectusReviewStoredContent;
}

function recommendationInputFromNote(note: {
  paymaster_snapshot: unknown;
  invoice_snapshot: unknown;
  purpose_snapshot?: unknown;
  contract_snapshot?: unknown;
  profit_rate_percent: Prisma.Decimal | number | null;
  maturity_date: Date | null;
  listing: { opens_at: Date | null } | null;
}): ProspectusHighlightRecommendationInput {
  const invoice = asRecord(note.invoice_snapshot);
  const offer = asRecord(invoice?.offer_details);
  // Issuer Fundamentals highlight recommendations use MARC SME grades (SME-1..SME-10).
  const rawRiskRating = offer?.risk_rating;
  const normalizedRiskRating =
    typeof rawRiskRating === "string" ? rawRiskRating.trim() : rawRiskRating;
  const riskRating = isMarcSmeGrade(normalizedRiskRating) ? normalizedRiskRating : null;
  const profit =
    note.profit_rate_percent == null ? null : Number(note.profit_rate_percent);
  return {
    paymasterSnapshot: note.paymaster_snapshot,
    riskRating,
    profitRatePercent: Number.isFinite(profit) ? profit : null,
    listingOpensAt: note.listing?.opens_at?.toISOString() ?? null,
    maturityDate: note.maturity_date?.toISOString() ?? null,
  };
}

function aboutInvoiceRecommendationInputFromNote(note: {
  paymaster_snapshot: unknown;
  contract_snapshot?: unknown;
}): ProspectusAboutInvoiceRecommendationInput {
  return {
    paymasterSnapshot: note.paymaster_snapshot,
    contractSnapshot: note.contract_snapshot ?? null,
  };
}

async function loadNoteRecommendationBundles(noteId: string): Promise<{
  highlights: ProspectusHighlightRecommendationInput;
  aboutInvoice: ProspectusAboutInvoiceRecommendationInput;
}> {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      paymaster_snapshot: true,
      invoice_snapshot: true,
      purpose_snapshot: true,
      contract_snapshot: true,
      profit_rate_percent: true,
      maturity_date: true,
      listing: { select: { opens_at: true } },
    },
  });
  if (!note) return { highlights: {}, aboutInvoice: {} };
  return {
    highlights: recommendationInputFromNote(note),
    aboutInvoice: aboutInvoiceRecommendationInputFromNote(note),
  };
}

function mapReview(row: NoteProspectusReview) {
  const workflow = normalizeProspectusWorkflowStatus(row.status);
  return {
    id: row.id,
    noteId: row.note_id,
    status: workflow as typeof row.status,
    contentVersion: row.content_version,
    optionCatalogueVersion: row.option_catalogue_version,
    draftContent: asStoredContent(row.draft_content),
    approvedContent: row.approved_content
      ? asStoredContent(row.approved_content)
      : null,
    approvedPublicationId: row.approved_publication_id ?? null,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    approvedByUserId: row.approved_by_user_id,
    approvedAt: row.approved_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
function diagHash(value: unknown): string {
  return diagSafeHash(hashProspectusFingerprint, value);
}

// TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
function rowDiag(row: NoteProspectusReview | null | undefined) {
  return reviewRowDiag(row, diagHash);
}

// TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
type ProspectusInvalidateDiag = {
  reason: "SOURCE" | "EDIT" | "UNPUBLISH" | "OTHER";
  caller: string;
  auditAction?: string;
  before?: NoteProspectusReview | null;
  storedFingerprint?: string | null;
  currentFingerprint?: string | null;
};

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function logProspectusAction(
  tx: Prisma.TransactionClient,
  noteId: string,
  actionType: string,
  actor: ActorContext,
  beforeState?: Prisma.InputJsonValue,
  afterState?: Prisma.InputJsonValue
) {
  await createNoteAdminActionRow(tx, {
    noteId,
    actionType,
    actorUserId: actor.userId,
    beforeState,
    afterState,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    correlationId: actor.correlationId,
    portal: actor.portal,
    targetType: AUDIT_TARGET_TYPE.NOTE_PROSPECTUS,
    targetId: noteId,
    metadata: {
      changedFields: changedFieldsOf(
        beforeState as Record<string, unknown> | null,
        afterState as Record<string, unknown> | null
      ),
    },
  });
  await createNoteEventRow(tx, {
    noteId,
    eventType: actionType,
    actorUserId: actor.userId,
    actorRole: actor.role,
    portal: actor.portal,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    correlationId: actor.correlationId,
    metadata: { beforeState, afterState },
    targetType: AUDIT_TARGET_TYPE.NOTE_PROSPECTUS,
    targetId: noteId,
  });
}

function isNoteListed(note: { status: NoteStatus; published_at: Date | null }) {
  return isNoteProspectusPublished({
    status: note.status,
    publishedAt: note.published_at,
  });
}

async function clearApprovalEligibility(
  tx: Prisma.TransactionClient,
  noteId: string,
  actorUserId: string,
  draftContent: ProspectusReviewStoredContent,
  // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
  diag?: ProspectusInvalidateDiag
) {
  // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
  prospectusDiag("prospectus.invalidate.start", () => ({
    noteId,
    reason: diag?.reason ?? "OTHER",
    caller: diag?.caller ?? "unknown",
    actorUserId,
    auditAction: diag?.auditAction ?? null,
    storedFingerprint: diag?.storedFingerprint ?? diag?.before?.render_fingerprint ?? null,
    currentFingerprint: diag?.currentFingerprint ?? null,
    review: rowDiag(diag?.before),
  }));
  prospectusDiag("prospectus.invalidate.before_write", () => ({
    noteId,
    reason: diag?.reason ?? "OTHER",
    caller: diag?.caller ?? "unknown",
    auditAction: diag?.auditAction ?? null,
    beforeStatus: diag?.before?.status ?? null,
    targetStatus: ProspectusReviewStatus.DRAFT,
    beforeUpdatedAt: diag?.before?.updated_at?.toISOString?.() ?? null,
    beforeContentVersion: diag?.before?.content_version ?? null,
    incomingDraftHash: hashDraftContent(draftContent),
    draftContentChanges: diag?.before
      ? hashDraftContent(asStoredContent(diag.before.draft_content)) !==
        hashDraftContent(draftContent)
      : null,
  }));
  const row = await tx.noteProspectusReview.update({
    where: { note_id: noteId },
    data: {
      status: ProspectusReviewStatus.DRAFT,
      draft_content: draftContent as unknown as Prisma.InputJsonValue,
      approved_content: Prisma.DbNull,
      approved_snapshot: Prisma.DbNull,
      approved_publication_id: null,
      render_fingerprint: null,
      approved_by_user_id: null,
      approved_at: null,
      updated_by_user_id: actorUserId,
      content_version: { increment: 1 },
      option_catalogue_version: catalogueVersion(),
    },
  });
  // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
  prospectusDiag("prospectus.invalidate.after_write", () => ({
    noteId,
    reason: diag?.reason ?? "OTHER",
    caller: diag?.caller ?? "unknown",
    auditAction: diag?.auditAction ?? null,
    beforeStatus: diag?.before?.status ?? null,
    afterStatus: row.status,
    beforeUpdatedAt: diag?.before?.updated_at?.toISOString?.() ?? null,
    afterUpdatedAt: row.updated_at?.toISOString?.() ?? null,
    beforeContentVersion: diag?.before?.content_version ?? null,
    afterContentVersion: row.content_version,
    changedFields: diag?.before
      ? diagChangedKeys(rowDiag(diag.before), rowDiag(row), diagHash)
      : null,
    review: rowDiag(row),
  }));
  return row;
}

/**
 * Unpublish (zero investors) reopens the prospectus as Draft with fields preserved.
 * Does not bump content_version — the next Approve creates the new publication version.
 * Prior `note_prospectus_publications` rows are kept for audit; live `published_at` is cleared.
 */
async function reopenProspectusDraftAfterUnpublish(
  tx: Prisma.TransactionClient,
  noteId: string,
  actor: ActorContext,
  // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
  diag?: ProspectusInvalidateDiag
) {
  const review = await tx.noteProspectusReview.findUnique({ where: { note_id: noteId } });
  // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
  prospectusDiag("prospectus.invalidate.start", () => ({
    noteId,
    reason: diag?.reason ?? "OTHER",
    caller: diag?.caller ?? "unknown",
    actorUserId: actor.userId,
    auditAction: "PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH",
    storedFingerprint: review?.render_fingerprint ?? null,
    currentFingerprint: null,
    willWrite:
      review != null &&
      (review.status === ProspectusReviewStatus.APPROVED ||
        review.status === ProspectusReviewStatus.READY_FOR_PUBLISH ||
        review.status === ProspectusReviewStatus.PUBLISHED),
    review: rowDiag(review),
  }));
  if (!review) return null;
  if (
    review.status !== ProspectusReviewStatus.APPROVED &&
    review.status !== ProspectusReviewStatus.READY_FOR_PUBLISH &&
    review.status !== ProspectusReviewStatus.PUBLISHED
  ) {
    return review;
  }

  const draftContent = review.draft_content
    ? asStoredContent(review.draft_content)
    : review.approved_content
      ? asStoredContent(review.approved_content)
      : null;
  const before = mapReview(review);
  // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
  prospectusDiag("prospectus.invalidate.before_write", () => ({
    noteId,
    reason: diag?.reason ?? "OTHER",
    caller: diag?.caller ?? "unknown",
    auditAction: "PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH",
    beforeStatus: review.status,
    targetStatus: ProspectusReviewStatus.DRAFT,
    beforeUpdatedAt: review.updated_at?.toISOString?.() ?? null,
    beforeContentVersion: review.content_version,
    draftContentSource: review.draft_content
      ? "draft_content"
      : review.approved_content
        ? "approved_content"
        : "none",
  }));
  const row = await tx.noteProspectusReview.update({
    where: { note_id: noteId },
    data: {
      status: ProspectusReviewStatus.DRAFT,
      ...(draftContent
        ? { draft_content: draftContent as unknown as Prisma.InputJsonValue }
        : {}),
      approved_content: Prisma.DbNull,
      approved_snapshot: Prisma.DbNull,
      approved_publication_id: null,
      render_fingerprint: null,
      approved_by_user_id: null,
      approved_at: null,
      updated_by_user_id: actor.userId,
    },
  });
  // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
  prospectusDiag("prospectus.invalidate.after_write", () => ({
    noteId,
    reason: diag?.reason ?? "OTHER",
    caller: diag?.caller ?? "unknown",
    auditAction: "PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH",
    beforeStatus: review.status,
    afterStatus: row.status,
    beforeUpdatedAt: review.updated_at?.toISOString?.() ?? null,
    afterUpdatedAt: row.updated_at?.toISOString?.() ?? null,
    beforeContentVersion: review.content_version,
    afterContentVersion: row.content_version,
    changedFields: diagChangedKeys(rowDiag(review), rowDiag(row), diagHash),
    review: rowDiag(row),
  }));
  await tx.noteProspectusPublication.updateMany({
    where: { note_id: noteId, published_at: { not: null } },
    data: { published_at: null },
  });
  await tx.note.updateMany({
    where: { id: noteId, status: { not: NoteStatus.PUBLISHED } },
    data: { published_at: null },
  });
  await logProspectusAction(
    tx,
    noteId,
    "PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH",
    actor,
    asJson({
      ...before,
      previousPublicationId: review.approved_publication_id,
      previousContentVersion: review.content_version,
    }),
    asJson(mapReview(row))
  );
  return row;
}

export class ProspectusReviewService {
  noteRequiresProspectusReview(note: {
    created_at: Date;
    prospectus_review?: { id: string } | null;
  }) {
    if (note.prospectus_review) return true;
    return note.created_at.getTime() >= PROSPECTUS_REVIEW_REQUIRED_FROM.getTime();
  }

  /**
   * Authoritative publish gate. Fingerprint mismatch rejects — never rebuilds.
   */
  async assertPublishAllowed(noteId: string) {
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        created_at: true,
        prospectus_review: true,
      },
    });
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (!this.noteRequiresProspectusReview(note)) return;

    const review = note.prospectus_review;
    if (
      !review ||
      (review.status !== ProspectusReviewStatus.APPROVED &&
        review.status !== ProspectusReviewStatus.READY_FOR_PUBLISH)
    ) {
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      prospectusDiag("prospectus.publish_gate.result", () => ({
        noteId,
        outcome: "blocked",
        reason: review ? "review status is not APPROVED/READY_FOR_PUBLISH" : "no review row",
        review: rowDiag(review),
      }));
      throw new AppError(409, "PROSPECTUS_REVIEW_REQUIRED", PUBLISH_BLOCKED);
    }
    const snapshot = parseApprovedSnapshot(review.approved_snapshot);
    if (!snapshot || !review.approved_content || !review.approved_publication_id) {
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      prospectusDiag("prospectus.publish_gate.result", () => ({
        noteId,
        outcome: "blocked",
        reason: "approved snapshot, approved content or publication id missing",
        snapshotParsed: snapshot != null,
        review: rowDiag(review),
      }));
      throw new AppError(409, "PROSPECTUS_REVIEW_REQUIRED", PUBLISH_BLOCKED);
    }
    if (review.render_fingerprint !== snapshot.render_fingerprint) {
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      prospectusDiag("prospectus.publish_gate.result", () => ({
        noteId,
        outcome: "blocked",
        reason: "review.render_fingerprint differs from approved_snapshot.render_fingerprint",
        storedFingerprint: review.render_fingerprint,
        snapshotFingerprint: snapshot.render_fingerprint,
        review: rowDiag(review),
      }));
      throw new AppError(409, "PROSPECTUS_REVIEW_REQUIRED", PUBLISH_BLOCKED);
    }

    const currentFp = await computeCurrentRenderFingerprint({
      noteId,
      approvedContent: asStoredContent(review.approved_content),
      approvedSnapshot: snapshot,
    });
    // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
    prospectusDiag("prospectus.publish_gate.result", () => ({
      noteId,
      outcome: currentFp !== review.render_fingerprint ? "blocked" : "allowed",
      reason: currentFp !== review.render_fingerprint ? "fingerprint mismatch" : null,
      storedFingerprint: review.render_fingerprint,
      recomputedFingerprint: currentFp,
      match: currentFp === review.render_fingerprint,
      changedComponents: diffFingerprintDiagSummaries(
        getFingerprintDiagSummary(review.render_fingerprint),
        getFingerprintDiagSummary(currentFp)
      ),
      review: rowDiag(review),
    }));
    if (currentFp !== review.render_fingerprint) {
      throw new AppError(409, "PROSPECTUS_REVIEW_REQUIRED", PUBLISH_BLOCKED);
    }
  }

  /** Returns approved snapshot for exact copy at publish (no rebuild). */
  async getApprovedSnapshotForPublish(noteId: string): Promise<{
    snapshot: ProspectusApprovedSnapshot;
    publicationId: string;
    reviewId: string;
  }> {
    await this.assertPublishAllowed(noteId);
    const review = await prisma.noteProspectusReview.findUniqueOrThrow({
      where: { note_id: noteId },
    });
    const snapshot = parseApprovedSnapshot(review.approved_snapshot);
    if (!snapshot || !review.approved_publication_id) {
      throw new AppError(409, "PROSPECTUS_REVIEW_REQUIRED", PUBLISH_BLOCKED);
    }
    const publication = await prisma.noteProspectusPublication.findUnique({
      where: { id: review.approved_publication_id },
      select: {
        pdf_generation_status: true,
        pdf_storage_key: true,
      },
    });
    // Final investor PDF is generated during Note publish after listing opens/closes timestamps exist.
    if (!publication) {
      throw new AppError(404, "PROSPECTUS_PDF_UNAVAILABLE", "Prospectus publication missing");
    }
    return {
      snapshot,
      publicationId: review.approved_publication_id,
      reviewId: review.id,
    };
  }

  /** Called from Note unpublish: reopen fields for edit and require a new approval. */
  async invalidateAfterUnpublish(
    tx: Prisma.TransactionClient,
    noteId: string,
    actor: ActorContext
  ) {
    await reopenProspectusDraftAfterUnpublish(
      tx,
      noteId,
      actor,
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      { reason: "UNPUBLISH", caller: "notes.unpublish" }
    );
  }

  async getOrCreateReview(noteId: string, actor: ActorContext) {
    // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
    prospectusDiag("prospectus.get.start", () => ({
      noteId,
      actorUserId: actor.userId,
      correlationId: actor.correlationId ?? null,
    }));
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        note_reference: true,
        status: true,
        published_at: true,
        title: true,
        paymaster_snapshot: true,
        invoice_snapshot: true,
        purpose_snapshot: true,
        contract_snapshot: true,
        profit_rate_percent: true,
        maturity_date: true,
        listing: { select: { opens_at: true } },
      },
    });
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");

    const recommendationInput = recommendationInputFromNote(note);
    const aboutInvoiceInput = aboutInvoiceRecommendationInputFromNote(note);
    const highlightRecommendations =
      buildProspectusHighlightRecommendations(recommendationInput);

    let review = await prisma.noteProspectusReview.findUnique({ where: { note_id: noteId } });
    if (!review) {
      const empty = emptyProspectusReviewContent(recommendationInput, aboutInvoiceInput);
      review = await prisma.noteProspectusReview.create({
        data: {
          note_id: noteId,
          status: ProspectusReviewStatus.DRAFT,
          option_catalogue_version: catalogueVersion(),
          draft_content: empty as unknown as Prisma.InputJsonValue,
          created_by_user_id: actor.userId,
          updated_by_user_id: actor.userId,
        },
      });
      await prisma.$transaction(async (tx) => {
        await logProspectusAction(
          tx,
          noteId,
          "PROSPECTUS_REVIEW_CREATE",
          actor,
          undefined,
          asJson(mapReview(review!))
        );
      });
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      prospectusDiag("prospectus.get.created", () => ({
        noteId,
        noteReference: note.note_reference,
        auditAction: "PROSPECTUS_REVIEW_CREATE",
        review: rowDiag(review),
      }));
    }

    // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
    setProspectusDiagStash("reviewStatus", review.status);
    prospectusDiag("prospectus.get.loaded", () => ({
      noteId,
      noteReference: note.note_reference,
      noteStatus: note.status,
      notePublishedAt: note.published_at?.toISOString?.() ?? null,
      noteListed: isNoteListed(note),
      review: rowDiag(review),
    }));
    prospectusDiag(
      "prospectus.get.sources_loaded",
      () => ({
        noteId,
        noteReference: note.note_reference,
        note: {
          id: note.id,
          status: note.status,
          publishedAt: note.published_at?.toISOString?.() ?? null,
          title: note.title,
          profitRatePercent: note.profit_rate_percent?.toString?.() ?? null,
          maturityDate: note.maturity_date?.toISOString?.() ?? null,
          listingOpensAt: note.listing?.opens_at?.toISOString?.() ?? null,
        },
        paymasterHash: diagHash(note.paymaster_snapshot),
        invoiceHash: diagHash(note.invoice_snapshot),
        purposeHash: diagHash(note.purpose_snapshot),
        contractHash: diagHash(note.contract_snapshot),
        recommendationInputHash: diagHash(recommendationInput),
        aboutInvoiceInputHash: diagHash(aboutInvoiceInput),
        highlightRecommendationsHash: diagHash(highlightRecommendations),
        // Financial statements / CTOS / MARC are loaded only by the fingerprint recompute
        // (prospectus.fingerprint.components) and by the page builders (render_sources_loaded).
      }),
      () => ({
        paymasterSnapshot: note.paymaster_snapshot,
        invoiceSnapshot: note.invoice_snapshot,
        purposeSnapshot: note.purpose_snapshot,
        contractSnapshot: note.contract_snapshot,
        recommendationInput,
        aboutInvoiceInput,
        highlightRecommendations,
      })
    );

    if (!isNoteListed(note) && review.status === ProspectusReviewStatus.PUBLISHED) {
      const healed = await prisma.$transaction(async (tx) =>
        reopenProspectusDraftAfterUnpublish(
          tx,
          noteId,
          actor,
          // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
          { reason: "OTHER", caller: "get.heal_published_on_unlisted_note" }
        )
      );
      if (healed) review = healed;
    }

    // Approved content (READY_FOR_PUBLISH / APPROVED / PUBLISHED) is never rewritten by a GET.
    if (
      review.status !== ProspectusReviewStatus.APPROVED &&
      review.status !== ProspectusReviewStatus.READY_FOR_PUBLISH &&
      review.status !== ProspectusReviewStatus.PUBLISHED
    ) {
      const parsed = saveProspectusReviewDraftSchema.shape.draftContent.safeParse(
        review.draft_content
      );
      if (parsed.success) {
        const normalized = normalizeProspectusReviewSelections(
          parsed.data as ProspectusReviewStoredContent,
          recommendationInput,
          aboutInvoiceInput
        );
        // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
        const diagReviewBeforeNormalization = review;
        prospectusDiag(
          "prospectus.get.normalized",
          () => {
            const storedDraftHash = hashDraftContent(asStoredContent(review!.draft_content));
            const normalizedHash = hashDraftContent(cloneReviewContent(normalized));
            return {
              noteId,
              skipped: false,
              rawStatus: review!.status,
              storedDraftHash,
              normalizedHash,
              semanticallyEqual: storedDraftHash === normalizedHash,
              jsonStringifyEqual:
                JSON.stringify(review!.draft_content) === JSON.stringify(normalized),
              normalizationWriteRequired: storedDraftHash !== normalizedHash,
              changedFields: diagChangedKeys(
                review!.draft_content,
                cloneReviewContent(normalized),
                diagHash
              ),
            };
          },
          () => ({ storedDraftContent: review!.draft_content, normalizedContent: normalized })
        );
        // Key-order independent: jsonb reorders keys, and an unneeded write here bumps
        // updated_at, which is the optimistic-lock token for save and approve.
        if (
          hashDraftContent(asStoredContent(review.draft_content)) !==
          hashDraftContent(cloneReviewContent(normalized))
        ) {
          // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
          prospectusDiag(
            "prospectus.get.normalization.before",
            () => ({
              noteId,
              updatedAtBefore: diagReviewBeforeNormalization.updated_at?.toISOString?.() ?? null,
              storedDraftHash: hashDraftContent(
                asStoredContent(diagReviewBeforeNormalization.draft_content)
              ),
              normalizedHash: hashDraftContent(cloneReviewContent(normalized)),
              review: rowDiag(diagReviewBeforeNormalization),
            }),
            () => ({
              contentBefore: diagReviewBeforeNormalization.draft_content,
              normalizedContent: normalized,
            })
          );
          review = await prisma.noteProspectusReview.update({
            where: { note_id: noteId },
            data: {
              draft_content: normalized as unknown as Prisma.InputJsonValue,
              option_catalogue_version: catalogueVersion(),
            },
          });
          // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
          prospectusDiag("prospectus.get.normalization.after", () => ({
            noteId,
            updatedAtBefore: diagReviewBeforeNormalization.updated_at?.toISOString?.() ?? null,
            updatedAtAfter: review!.updated_at?.toISOString?.() ?? null,
            // No audit row and no updated_by_user_id change on this write.
            auditAction: null,
            review: rowDiag(review),
          }));
        }
      } else {
        // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
        prospectusDiag("prospectus.get.normalized", () => ({
          noteId,
          skipped: true,
          reason: "stored draft_content failed schema parse",
          rawStatus: review!.status,
          issues: parsed.error.issues,
        }));
      }
    } else {
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      prospectusDiag("prospectus.get.normalized", () => ({
        noteId,
        skipped: true,
        reason: "approved content is never rewritten by a GET",
        rawStatus: review!.status,
        normalizationWriteRequired: false,
      }));
    }

    // Source drift while APPROVED → invalidate to Draft.
    if (
      (review.status === ProspectusReviewStatus.APPROVED ||
        review.status === ProspectusReviewStatus.READY_FOR_PUBLISH) &&
      !isNoteListed(note) &&
      review.approved_content &&
      review.approved_snapshot &&
      review.render_fingerprint
    ) {
      const snapshot = parseApprovedSnapshot(review.approved_snapshot);
      if (snapshot) {
        // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
        const diagApprovedReview = review;
        const currentFp = await withProspectusDiagError("get.fingerprint_recompute", () =>
          computeCurrentRenderFingerprint({
            noteId,
            approvedContent: asStoredContent(diagApprovedReview.approved_content),
            approvedSnapshot: snapshot,
          })
        );
        // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
        prospectusDiag("prospectus.get.fingerprint", () => ({
          noteId,
          checked: true,
          rawStatus: diagApprovedReview.status,
          storedFingerprint: diagApprovedReview.render_fingerprint,
          snapshotFingerprint: snapshot.render_fingerprint,
          recomputedFingerprint: currentFp,
          match: currentFp === diagApprovedReview.render_fingerprint,
          sourceDriftDetected: currentFp !== diagApprovedReview.render_fingerprint,
          approvedContentHash: hashDraftContent(
            asStoredContent(diagApprovedReview.approved_content)
          ),
          // Full hashed input: prospectus.fingerprint.components (phase "recompute").
          fingerprintInput: getFingerprintDiagSummary(currentFp),
        }));
        if (currentFp !== review.render_fingerprint) {
          // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
          prospectusDiag("prospectus.get.fingerprint_mismatch", () => {
            const approveInput = getFingerprintDiagSummary(diagApprovedReview.render_fingerprint);
            const currentInput = getFingerprintDiagSummary(currentFp);
            return {
              noteId,
              storedFingerprint: diagApprovedReview.render_fingerprint,
              newFingerprint: currentFp,
              // Present only when Approve ran in this same API process.
              approveInputAvailable: approveInput != null,
              changedComponents: diffFingerprintDiagSummaries(approveInput, currentInput),
              approveInput,
              currentInput,
            };
          });
          prospectusDiag("prospectus.get.invalidate_source.before", () => ({
            noteId,
            invalidationReason: "SOURCE",
            auditAction: "PROSPECTUS_APPROVAL_INVALIDATED_SOURCE",
            storedFingerprint: diagApprovedReview.render_fingerprint,
            recomputedFingerprint: currentFp,
            review: rowDiag(diagApprovedReview),
          }));
          review = await prisma.$transaction(async (tx) => {
            const before = mapReview(review!);
            const row = await clearApprovalEligibility(
              tx,
              noteId,
              actor.userId,
              asStoredContent(review!.draft_content),
              // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
              {
                reason: "SOURCE",
                caller: "getOrCreateReview",
                auditAction: "PROSPECTUS_APPROVAL_INVALIDATED_SOURCE",
                before: review,
                storedFingerprint: review!.render_fingerprint,
                currentFingerprint: currentFp,
              }
            );
            await logProspectusAction(
              tx,
              noteId,
              "PROSPECTUS_APPROVAL_INVALIDATED_SOURCE",
              actor,
              asJson(before),
              asJson(mapReview(row))
            );
            return row;
          });
          // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
          prospectusDiag("prospectus.get.invalidate_source.after", () => ({
            noteId,
            approvalInvalidated: true,
            invalidationReason: "SOURCE",
            auditAction: "PROSPECTUS_APPROVAL_INVALIDATED_SOURCE",
            resultingStatus: review!.status,
            updatedAt: review!.updated_at?.toISOString?.() ?? null,
            contentVersion: review!.content_version,
            review: rowDiag(review),
          }));
        }
      } else {
        // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
        prospectusDiag("prospectus.get.fingerprint", () => ({
          noteId,
          checked: false,
          reason: "approved_snapshot failed parseApprovedSnapshot",
          rawStatus: review!.status,
          storedFingerprint: review!.render_fingerprint,
        }));
      }
    } else {
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      prospectusDiag("prospectus.get.fingerprint", () => ({
        noteId,
        checked: false,
        reason: "drift check preconditions not met",
        rawStatus: review!.status,
        noteListed: isNoteListed(note),
        hasApprovedContent: review!.approved_content != null,
        hasApprovedSnapshot: review!.approved_snapshot != null,
        storedFingerprint: review!.render_fingerprint,
      }));
    }

    const mapped = mapReview(review);
    mapped.draftContent = normalizeProspectusReviewSelections(
      mapped.draftContent,
      recommendationInput,
      aboutInvoiceInput
    );

    const page1Note = await loadProspectusPageOneNote(prisma, noteId);
    const page1Input = await mapProspectusPageOneDataToInput(page1Note);
    const page1 = buildProspectusPageOne(page1Input);

    const page2Data = await loadProspectusPageTwoData(prisma, noteId);
    const page2Input = mapProspectusPageTwoDataToInput(page2Data);
    const workflow = normalizeProspectusWorkflowStatus(review.status);
    // Use saved draft/approved officer content so Admin Issuer Profile matches Preview.
    if (!page2Input.isPublished) {
      const contentForProfile =
        (workflow === "APPROVED" || workflow === "READY_FOR_PUBLISH") &&
        mapped.approvedContent != null
          ? mapped.approvedContent
          : mapped.draftContent;
      page2Input.publicationContent = toProspectusPublicationContent(contentForProfile);
    }
    const page2 = buildProspectusPageTwo(page2Input);
    const publishBlocked =
      !isNoteListed(note) && workflow !== "APPROVED" ? PUBLISH_BLOCKED : null;

    // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
    prospectusDiag(
      "prospectus.get.render_sources_loaded",
      () => ({
        noteId,
        page1NoteHash: diagHash(page1Note),
        page1InputHash: diagHash(page1Input),
        page2DataHash: diagHash(page2Data),
        page2InputHash: diagHash(page2Input),
        page2IsPublished: page2Input.isPublished,
      }),
      () => ({ page1Note, page2Data })
    );
    prospectusDiag("prospectus.status_mapping", () => ({
      site: "api.getOrCreateReview",
      noteId,
      rawStatus: review!.status,
      normalizedStatus: workflow,
      dtoStatus: mapped.status,
      noteStatus: note.status,
      noteListed: isNoteListed(note),
      publishBlockedReason: publishBlocked,
      readyForPublishPreserved:
        review!.status !== ProspectusReviewStatus.READY_FOR_PUBLISH ||
        mapped.status === ProspectusReviewStatus.READY_FOR_PUBLISH,
    }));

    // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
    const response = {
      note: {
        id: note.id,
        noteReference: note.note_reference,
        title: note.title,
        status: note.status,
        publishedAt: note.published_at?.toISOString() ?? null,
      },
      review: mapped,
      catalogues: getActiveProspectusCatalogues(),
      highlightRecommendations,
      issuerTrackRecord: {
        rows: toAdminIssuerTrackRecordRows(page1.issuerTrackRecord),
      },
      historicalNotes: toAdminHistoricalNoteTable(page1.historicalNoteTable),
      issuerProfile: {
        industry: page2.issuerProfile.industry,
        rows: toAdminIssuerProfileRows(page2.issuerProfile),
      },
      invoicePaymaster: {
        rows: toAdminInvoicePaymasterRows(page2.invoicePaymaster),
      },
      paymasterTrackRecord: {
        rows: toAdminPaymasterTrackRecordRows(page2.paymasterTrackRecord),
      },
      financialComparison: {
        table: toAdminFinancialComparisonTable(page2.financialComparisonMetrics),
        years: toAdminFrozenFinancialYears(page2.financialComparisonSource.years),
        opsWarning: page2.financialComparisonSource.opsWarning,
        missingSsmUnauditedYears: page2.financialComparisonSource.missingSsmUnauditedYears,
      },
      publishBlockedReason: publishBlocked,
      catalogueNotice:
        "Issuer Financial Strength recommendations use placeholder SoukScore wording pending product/legal approval.",
    };
    // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
    prospectusDiag(
      "prospectus.get.response",
      () => ({
        noteId,
        noteReference: note.note_reference,
        finalResponseStatus: mapped.status,
        rawStatus: review!.status,
        updatedAt: mapped.updatedAt,
        contentVersion: mapped.contentVersion,
        approvedPublicationId: mapped.approvedPublicationId,
        publishBlockedReason: publishBlocked,
        responseDraftContentHash: hashDraftContent(mapped.draftContent),
        review: rowDiag(review),
      }),
      () => ({ response })
    );
    return response;
  }

  async saveDraft(noteId: string, rawInput: unknown, actor: ActorContext) {
    // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
    prospectusDiag(
      "prospectus.save.start",
      () => {
        const body = (rawInput ?? {}) as { expectedUpdatedAt?: unknown; draftContent?: unknown };
        return {
          noteId,
          actorUserId: actor.userId,
          correlationId: actor.correlationId ?? null,
          expectedUpdatedAt: body.expectedUpdatedAt ?? null,
          hasDraftContent: body.draftContent != null,
          incomingDraftHash:
            body.draftContent != null ? diagHash(body.draftContent) : null,
        };
      },
      () => ({ requestBody: rawInput })
    );
    const input: SaveProspectusReviewDraftInput = saveProspectusReviewDraftSchema.parse(rawInput);
    const draftErrors = validateDraftContent(input.draftContent);
    if (draftErrors.length > 0) {
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      prospectusDiag("prospectus.save.validation_failed", () => ({
        noteId,
        errorCode: "PROSPECTUS_REVIEW_INVALID",
        errors: draftErrors,
      }));
      throw new AppError(422, "PROSPECTUS_REVIEW_INVALID", "Draft content is invalid", {
        details: draftErrors,
      });
    }

    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: { status: true, published_at: true },
    });
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (isNoteListed(note)) {
      throw new AppError(
        409,
        "PROSPECTUS_PUBLISHED_LOCKED",
        "Published Prospectus cannot be edited."
      );
    }

    let current = await prisma.noteProspectusReview.findUnique({ where: { note_id: noteId } });
    if (!current) {
      await this.getOrCreateReview(noteId, actor);
      current = await prisma.noteProspectusReview.findUniqueOrThrow({
        where: { note_id: noteId },
      });
    }

    if (current.status === ProspectusReviewStatus.PUBLISHED) {
      await prisma.$transaction(async (tx) => {
        await reopenProspectusDraftAfterUnpublish(
          tx,
          noteId,
          actor,
          // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
          { reason: "OTHER", caller: "saveDraft.reopen_published_review" }
        );
      });
      current = await prisma.noteProspectusReview.findUniqueOrThrow({
        where: { note_id: noteId },
      });
    }

    // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
    const diagSaveCurrent = current;
    setProspectusDiagStash("reviewStatus", current.status);
    prospectusDiag("prospectus.save.loaded", () => ({
      noteId,
      noteStatus: note.status,
      noteListed: isNoteListed(note),
      review: rowDiag(diagSaveCurrent),
    }));
    prospectusDiag("prospectus.save.lock_check", () => ({
      noteId,
      checked: Boolean(input.expectedUpdatedAt),
      expectedUpdatedAt: input.expectedUpdatedAt ?? null,
      expectedUpdatedAtMs: input.expectedUpdatedAt
        ? new Date(input.expectedUpdatedAt).getTime()
        : null,
      actualUpdatedAt: diagSaveCurrent.updated_at?.toISOString?.() ?? null,
      actualUpdatedAtMs: diagSaveCurrent.updated_at?.getTime?.() ?? null,
      match: input.expectedUpdatedAt
        ? diagSaveCurrent.updated_at.getTime() === new Date(input.expectedUpdatedAt).getTime()
        : null,
    }));
    if (input.expectedUpdatedAt) {
      const expected = new Date(input.expectedUpdatedAt);
      if (current.updated_at.getTime() !== expected.getTime()) {
        throw new AppError(
          409,
          "CONFLICT",
          "Prospectus review has changed since it was last loaded. Reload and try again."
        );
      }
    }

    const noteForRecs = await prisma.note.findUnique({
      where: { id: noteId },
      select: {
        paymaster_snapshot: true,
        invoice_snapshot: true,
        purpose_snapshot: true,
        contract_snapshot: true,
        profit_rate_percent: true,
        maturity_date: true,
        listing: { select: { opens_at: true } },
      },
    });
    const draftToStore = stripLegacyPaymentBasisShariahKeys(
      normalizeProspectusReviewSelections(
        input.draftContent as ProspectusReviewStoredContent,
        noteForRecs ? recommendationInputFromNote(noteForRecs) : {},
        noteForRecs ? aboutInvoiceRecommendationInputFromNote(noteForRecs) : {}
      )
    );

    const previousDraft = asStoredContent(current.draft_content);
    const contentChanged =
      hashDraftContent(draftToStore) !== hashDraftContent(previousDraft);

    const before = mapReview(current);

    // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
    const diagSaveWasApproved =
      current.status === ProspectusReviewStatus.APPROVED ||
      current.status === ProspectusReviewStatus.READY_FOR_PUBLISH;
    const diagSaveAuditAction =
      diagSaveWasApproved && contentChanged
        ? "PROSPECTUS_APPROVAL_INVALIDATED_EDIT"
        : "PROSPECTUS_REVIEW_DRAFT_UPDATE";
    prospectusDiag(
      "prospectus.save.input",
      () => {
        const incomingHash = diagHash(input.draftContent);
        const normalizedHash = hashDraftContent(draftToStore);
        return {
          noteId,
          incomingHash,
          existingHash: hashDraftContent(previousDraft),
          normalizedHash,
          normalizationChangedIncoming: incomingHash !== normalizedHash,
          contentChanged,
          changedFields: diagChangedKeys(previousDraft, draftToStore, diagHash),
        };
      },
      () => ({
        incomingDraftContent: input.draftContent,
        existingDraftContent: previousDraft,
        normalizedContent: draftToStore,
      })
    );

    // APPROVED/READY_FOR_PUBLISH + identical content → keep (no version bump needed for noop).
    if (
      (current.status === ProspectusReviewStatus.APPROVED ||
        current.status === ProspectusReviewStatus.READY_FOR_PUBLISH) &&
      !contentChanged
    ) {
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      prospectusDiag("prospectus.save.noop_approved_unchanged", () => ({
        noteId,
        contentChanged,
        approvalInvalidated: false,
        review: rowDiag(diagSaveCurrent),
      }));
      return mapReview(current);
    }

    // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
    prospectusDiag("prospectus.save.before_write", () => ({
      noteId,
      auditAction: diagSaveAuditAction,
      approvalInvalidated: diagSaveWasApproved && contentChanged,
      invalidationReason: diagSaveWasApproved && contentChanged ? "EDIT" : null,
      beforeStatus: diagSaveCurrent.status,
      targetStatus: ProspectusReviewStatus.DRAFT,
      contentVersionBefore: diagSaveCurrent.content_version,
      nextContentVersion: diagSaveCurrent.content_version + 1,
      lockedOnUpdatedAt: !(diagSaveWasApproved && contentChanged),
      review: rowDiag(diagSaveCurrent),
    }));
    const updated = await prisma.$transaction(async (tx) => {
      if (
        (current!.status === ProspectusReviewStatus.APPROVED ||
          current!.status === ProspectusReviewStatus.READY_FOR_PUBLISH) &&
        contentChanged
      ) {
        const row = await clearApprovalEligibility(
          tx,
          noteId,
          actor.userId,
          draftToStore,
          // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
          {
            reason: "EDIT",
            caller: "saveDraft",
            auditAction: "PROSPECTUS_APPROVAL_INVALIDATED_EDIT",
            before: current,
            storedFingerprint: current!.render_fingerprint,
          }
        );
        await logProspectusAction(
          tx,
          noteId,
          "PROSPECTUS_APPROVAL_INVALIDATED_EDIT",
          actor,
          asJson(before),
          asJson(mapReview(row))
        );
        return row;
      }

      const row = await tx.noteProspectusReview.update({
        where: {
          note_id: noteId,
          updated_at: current!.updated_at,
        },
        data: {
          draft_content: draftToStore as unknown as Prisma.InputJsonValue,
          updated_by_user_id: actor.userId,
          status: ProspectusReviewStatus.DRAFT,
          content_version: { increment: 1 },
          option_catalogue_version: catalogueVersion(),
        },
      });
      await logProspectusAction(
        tx,
        noteId,
        "PROSPECTUS_REVIEW_DRAFT_UPDATE",
        actor,
        asJson(before),
        asJson(mapReview(row))
      );
      return row;
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation (.catch only logs and rethrows)
    }).catch(prospectusDiagRethrow("save.transaction_write"));

    // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
    prospectusDiag("prospectus.save.after_write", () => ({
      noteId,
      status: updated.status,
      updatedAt: updated.updated_at?.toISOString?.() ?? null,
      updatedAtBefore: diagSaveCurrent.updated_at?.toISOString?.() ?? null,
      contentVersion: updated.content_version,
      contentVersionBefore: diagSaveCurrent.content_version,
      review: rowDiag(updated),
    }));
    prospectusDiag(
      "prospectus.save.audit",
      () => ({
        noteId,
        auditAction: diagSaveAuditAction,
        changedFields: changedFieldsOf(
          before as unknown as Record<string, unknown>,
          mapReview(updated) as unknown as Record<string, unknown>
        ),
        beforeStatus: before.status,
        afterStatus: mapReview(updated).status,
      }),
      () => ({ beforeState: before, afterState: mapReview(updated) })
    );

    return mapReview(updated);
  }

  async approve(
    noteId: string,
    actor: ActorContext,
    rawDraft?: unknown,
    expectedUpdatedAt?: string
  ) {
    // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
    prospectusDiag(
      "prospectus.approve.start",
      () => ({
        noteId,
        actorUserId: actor.userId,
        actorRole: actor.role ?? null,
        correlationId: actor.correlationId ?? null,
        expectedUpdatedAt: expectedUpdatedAt ?? null,
        hasDraftPayload: rawDraft != null,
      }),
      () => ({ requestBody: { expectedUpdatedAt: expectedUpdatedAt ?? null, draftPayload: rawDraft ?? null } })
    );
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: {
        status: true,
        published_at: true,
        issuer_organization_id: true,
        prospectus_snapshot: true,
        source_application_id: true,
      },
    });
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (isNoteListed(note)) {
      throw new AppError(
        409,
        "PROSPECTUS_PUBLISHED_LOCKED",
        "Published Prospectus cannot be re-approved."
      );
    }

    let current = await prisma.noteProspectusReview.findUnique({ where: { note_id: noteId } });
    if (!current) throw new AppError(404, "PROSPECTUS_REVIEW_NOT_FOUND", "Prospectus review not found");

    // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
    const diagApproveLoaded = current;
    setProspectusDiagStash("reviewStatus", current.status);
    prospectusDiag("prospectus.approve.loaded", () => ({
      noteId,
      noteStatus: note.status,
      notePublishedAt: note.published_at?.toISOString?.() ?? null,
      noteListed: isNoteListed(note),
      issuerOrganizationId: note.issuer_organization_id,
      sourceApplicationId: note.source_application_id,
      review: rowDiag(diagApproveLoaded),
    }));
    prospectusDiag("prospectus.approve.lock_check", () => ({
      noteId,
      phase: "initial",
      checked: Boolean(expectedUpdatedAt),
      expectedUpdatedAt: expectedUpdatedAt ?? null,
      expectedUpdatedAtMs: expectedUpdatedAt ? new Date(expectedUpdatedAt).getTime() : null,
      actualUpdatedAt: diagApproveLoaded.updated_at?.toISOString?.() ?? null,
      actualUpdatedAtMs: diagApproveLoaded.updated_at?.getTime?.() ?? null,
      match: expectedUpdatedAt
        ? diagApproveLoaded.updated_at.getTime() === new Date(expectedUpdatedAt).getTime()
        : null,
    }));
    // Optimistic concurrency: clean-approve and dirty-approve must only succeed
    // when approving the same review version the Admin has loaded.
    if (expectedUpdatedAt) {
      const expected = new Date(expectedUpdatedAt);
      if (current.updated_at.getTime() !== expected.getTime()) {
        throw new AppError(
          409,
          "CONFLICT",
          "Prospectus review has changed since it was last loaded. Reload and try again."
        );
      }
    }

    if (current.status === ProspectusReviewStatus.PUBLISHED) {
      await prisma.$transaction(async (tx) => {
        await reopenProspectusDraftAfterUnpublish(
          tx,
          noteId,
          actor,
          // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
          { reason: "OTHER", caller: "approve.reopen_published_review" }
        );
      });
      current = await prisma.noteProspectusReview.findUniqueOrThrow({
        where: { note_id: noteId },
      });
    }

    if (
      current.status === ProspectusReviewStatus.APPROVED ||
      current.status === ProspectusReviewStatus.READY_FOR_PUBLISH
    ) {
      throw new AppError(409, "PROSPECTUS_REVIEW_ALREADY_APPROVED", "Prospectus is already approved");
    }

    // Optional: save latest draft body before approve.
    if (rawDraft != null) {
      await this.saveDraft(noteId, rawDraft, actor);
      current = await prisma.noteProspectusReview.findUniqueOrThrow({
        where: { note_id: noteId },
      });
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      const diagAfterInternalSave = current;
      prospectusDiag("prospectus.approve.lock_check", () => ({
        noteId,
        phase: "after_internal_save",
        checked: Boolean(expectedUpdatedAt),
        expectedUpdatedAt: expectedUpdatedAt ?? null,
        actualUpdatedAt: diagAfterInternalSave.updated_at?.toISOString?.() ?? null,
        match: expectedUpdatedAt
          ? diagAfterInternalSave.updated_at.getTime() === new Date(expectedUpdatedAt).getTime()
          : null,
      }));
      // If caller provided expectedUpdatedAt, it must still match after the internal save.
      if (expectedUpdatedAt) {
        const expected = new Date(expectedUpdatedAt);
        if (current.updated_at.getTime() !== expected.getTime()) {
          throw new AppError(
            409,
            "CONFLICT",
            "Prospectus review has changed since it was last loaded. Reload and try again."
          );
        }
      }
    }

    const parsed = saveProspectusReviewDraftSchema.shape.draftContent.parse(
      current.draft_content
    );
    const recBundles = await loadNoteRecommendationBundles(noteId);
    const approvedClone = stripLegacyPaymentBasisShariahKeys(
      normalizeProspectusReviewSelections(
        parsed as ProspectusReviewStoredContent,
        recBundles.highlights,
        recBundles.aboutInvoice
      )
    );
    // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
    const diagApproveCurrent = current;
    prospectusDiag(
      "prospectus.approve.normalized_content",
      () => {
        const draftHash = diagHash(diagApproveCurrent.draft_content);
        const normalizedHash = hashDraftContent(approvedClone);
        return {
          noteId,
          draftHash,
          normalizedHash,
          contentChanged: draftHash !== normalizedHash,
          changedFields: diagChangedKeys(
            diagApproveCurrent.draft_content,
            approvedClone,
            diagHash
          ),
          // What JSONB will hand back on the next read of approved_content.
          normalizedHashAfterJsonRoundTrip: hashDraftContent(cloneReviewContent(approvedClone)),
        };
      },
      () => ({ draftContent: diagApproveCurrent.draft_content, normalizedContent: approvedClone })
    );
    // Resolve Page 2/3 years before approve so Income Statement officer rows are validated.
    const publication = toProspectusPublicationContent(approvedClone);
    const page3Data = await loadProspectusPageThreeData(prisma, noteId);
    const page3Input = mapProspectusPageThreeDataToInput(page3Data);
    page3Input.publicationContent = publication;
    const page3 = buildProspectusPageThree(page3Input);
    // Approval uses real financial years only — never padded display placeholders.
    const incomeStatementYears = page3.incomeStatement.years
      .filter((year) => !year.isPlaceholder)
      .map((year) => String(year.year));

    let hasMarcAssessment: boolean | undefined = undefined;
    try {
      const marcSnapshot = await resolveMarcSnapshotForProspectus({
        status: note.status,
        published_at: note.published_at,
        prospectus_snapshot: note.prospectus_snapshot,
        issuer_organization_id: note.issuer_organization_id,
      });
      hasMarcAssessment = isCompleteIssuerMarcAssessment(marcSnapshot ?? null);
    } catch (diagMarcError) {
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      prospectusDiag("prospectus.approve.marc_resolve_error", () => ({
        noteId,
        message: diagMarcError instanceof Error ? diagMarcError.message : String(diagMarcError),
        stack: diagMarcError instanceof Error ? diagMarcError.stack : null,
      }));
      // Mirror frontend semantics: undefined = not evaluated yet (do not enforce).
      hasMarcAssessment = undefined;
    }

    const errors = validateApprovalContent(approvedClone, {
      incomeStatementYears,
      hasMarcAssessment,
    });
    if (errors.length > 0) {
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      prospectusDiag("prospectus.approve.validation_failed", () => ({
        noteId,
        errorCode: "PROSPECTUS_REVIEW_INVALID",
        incomeStatementYears,
        hasMarcAssessment: hasMarcAssessment ?? null,
        errors,
      }));
      throw new AppError(422, "PROSPECTUS_REVIEW_INVALID", "Approval validation failed", {
        details: errors,
      });
    }

    const now = new Date();
    const nextVersion = current.content_version + 1;
    const publicationId = `pub_${randomBytes(16).toString("hex")}`;
    // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
    prospectusDiag(
      "prospectus.approve.snapshot_input",
      () => ({
        noteId,
        publicationId,
        contentVersion: nextVersion,
        contentVersionBefore: diagApproveCurrent.content_version,
        approvedAt: now.toISOString(),
        approvedByUserId: actor.userId,
        optionCatalogueVersion: catalogueVersion(),
        approvedContentHash: hashDraftContent(approvedClone),
        incomeStatementYears,
        hasMarcAssessment: hasMarcAssessment ?? null,
      }),
      () => ({ approvedContent: approvedClone })
    );
    let approvedSnapshot = await withProspectusDiagError("approve.snapshot_build", () =>
      buildCompleteApprovedProspectusSnapshot({
        noteId,
        publicationId,
        contentVersion: nextVersion,
        approvedContent: approvedClone,
        approvedAt: now,
        approvedByUserId: actor.userId,
        optionCatalogueVersion: catalogueVersion(),
      })
    );

    // Freeze rendered HTML at approve so publish/investor never rebuild.
    const page1Note = await loadProspectusPageOneNote(prisma, noteId);
    const page1Input = await mapProspectusPageOneDataToInput(page1Note);
    page1Input.publicationContent = publication;
    // Prefer frozen track-record already in approved snapshot for HTML parity.
    page1Input.trackRecordMode = "frozen_publication_snapshot";
    page1Input.page1TrackRecordSnapshot =
      approvedSnapshot.page_1 as typeof page1Input.page1TrackRecordSnapshot;
    const page1 = buildProspectusPageOne(page1Input);
    const page2Data = await loadProspectusPageTwoData(prisma, noteId);
    const page2Input = mapProspectusPageTwoDataToInput(page2Data);
    page2Input.publicationContent = publication;
    const page2 = buildProspectusPageTwo(page2Input);
    approvedSnapshot = withApprovedSnapshotHtml(approvedSnapshot, {
      page1: buildProspectusPageOneHtml(page1),
      page2: buildProspectusPageTwoHtml(page2),
      page3: buildProspectusPageThreeHtml(page3),
      page4: buildProspectusPageFourHtml(),
      page5: buildProspectusPageFiveHtml(),
    });

    // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
    const diagApprovedSnapshot = approvedSnapshot;
    prospectusDiag(
      "prospectus.approve.snapshot_built",
      () => ({
        noteId,
        publicationId: diagApprovedSnapshot.publication_id,
        contentVersion: diagApprovedSnapshot.content_version,
        renderFingerprint: diagApprovedSnapshot.render_fingerprint,
        calculatedAt: diagApprovedSnapshot.calculated_at,
        snapshotHash: diagHash(diagApprovedSnapshot),
        page1Hash: diagHash(diagApprovedSnapshot.page_1),
        page2Hash: diagHash(diagApprovedSnapshot.page_2),
        noteIdentityHash: diagHash(diagApprovedSnapshot.note_identity),
        publicationContentHash: diagHash(
          diagApprovedSnapshot.publication_content
        ),
        htmlChars: Object.fromEntries(
          Object.entries(diagApprovedSnapshot.html).map(([page, body]) => [
            page,
            typeof body === "string" ? body.length : null,
          ])
        ),
      }),
      () => ({ approvedSnapshot: approvedSnapshotDiag(diagApprovedSnapshot) })
    );
    prospectusDiag("prospectus.approve.before_write", () => ({
      noteId,
      auditAction: "PROSPECTUS_REVIEW_APPROVE",
      beforeStatus: diagApproveCurrent.status,
      targetStatus: ProspectusReviewStatus.READY_FOR_PUBLISH,
      contentVersionBefore: diagApproveCurrent.content_version,
      contentVersionAfter: nextVersion,
      updatedAtBefore: diagApproveCurrent.updated_at?.toISOString?.() ?? null,
      renderFingerprint: diagApprovedSnapshot.render_fingerprint,
      publicationId,
      approvedAt: now.toISOString(),
      approvedByUserId: actor.userId,
      approvedContentHash: hashDraftContent(approvedClone),
      approvedSnapshotHash: diagHash(diagApprovedSnapshot),
      // approved_content and approved_snapshot bodies: see the snapshot_input and
      // snapshot_built payload events.
      review: rowDiag(diagApproveCurrent),
    }));
    const before = mapReview(current);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.noteProspectusPublication.create({
        data: {
          id: publicationId,
          note_id: noteId,
          prospectus_review_id: current!.id,
          content_version: nextVersion,
          snapshot: approvedSnapshot as unknown as Prisma.InputJsonValue,
          render_fingerprint: approvedSnapshot.render_fingerprint,
          approved_by_user_id: actor.userId,
          approved_at: now,
          // Final investor PDF is generated during Note publish,
          // after listing opens/closes timestamps exist.
        },
      });

      const row = await tx.noteProspectusReview.update({
        where: { note_id: noteId },
        data: {
          status: ProspectusReviewStatus.READY_FOR_PUBLISH,
          draft_content: approvedClone as unknown as Prisma.InputJsonValue,
          approved_content: approvedClone as unknown as Prisma.InputJsonValue,
          approved_snapshot: approvedSnapshot as unknown as Prisma.InputJsonValue,
          approved_publication_id: publicationId,
          render_fingerprint: approvedSnapshot.render_fingerprint,
          approved_by_user_id: actor.userId,
          approved_at: now,
          updated_by_user_id: actor.userId,
          option_catalogue_version: catalogueVersion(),
          content_version: nextVersion,
        },
      });
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      prospectusDiag(
        "prospectus.approve.after_write",
        () => ({
          noteId,
          committed: false,
          status: row.status,
          updatedAt: row.updated_at?.toISOString?.() ?? null,
          contentVersion: row.content_version,
          renderFingerprint: row.render_fingerprint,
          // Persisted copy vs the in-memory object that was hashed at approve.
          persistedApprovedContentHash:
            row.approved_content != null ? diagHash(row.approved_content) : null,
          inMemoryApprovedContentHash: hashDraftContent(approvedClone),
          review: rowDiag(row),
        }),
        () => ({
          persistedReview: { ...row, approved_snapshot: approvedSnapshotDiag(row.approved_snapshot) },
        })
      );
      await logProspectusAction(
        tx,
        noteId,
        "PROSPECTUS_REVIEW_APPROVE",
        actor,
        asJson({
          ...before,
          previousPublicationId: before.approvedPublicationId,
          previousContentVersion: before.contentVersion,
        }),
        asJson({
          ...mapReview(row),
          publicationId,
          contentVersion: nextVersion,
        })
      );
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      prospectusDiag(
        "prospectus.approve.audit_written",
        () => ({
          noteId,
          auditAction: "PROSPECTUS_REVIEW_APPROVE",
          targetType: AUDIT_TARGET_TYPE.NOTE_PROSPECTUS,
          actorUserId: actor.userId,
          correlationId: actor.correlationId ?? null,
          beforeStatus: before.status,
          afterStatus: mapReview(row).status,
          previousPublicationId: before.approvedPublicationId,
          publicationId,
          previousContentVersion: before.contentVersion,
          contentVersion: nextVersion,
          changedFields: changedFieldsOf(
            before as unknown as Record<string, unknown>,
            mapReview(row) as unknown as Record<string, unknown>
          ),
        }),
        () => ({ beforeState: before, afterState: mapReview(row) })
      );
      return row;
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation (.catch only logs and rethrows)
    }).catch(prospectusDiagRethrow("approve.transaction_write"));
    // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
    prospectusDiag("prospectus.approve.transaction_committed", () => ({
      noteId,
      committed: true,
      status: updated.status,
      updatedAt: updated.updated_at?.toISOString?.() ?? null,
      contentVersion: updated.content_version,
      renderFingerprint: updated.render_fingerprint,
      publicationId: updated.approved_publication_id,
      review: rowDiag(updated),
    }));
    if (note.source_application_id) {
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      const diagSourceApplicationId = note.source_application_id;
      await withProspectusDiagError("approve.post_merge", () =>
        mergeApplicationAdminFinancialSupplementsIntoOrg({
          applicationId: diagSourceApplicationId,
          diagSource: { noteId },
        })
      );
    } else {
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      prospectusDiag("prospectus.approve.post_merge.end", () => ({
        noteId,
        skipped: true,
        reason: "note has no source application",
      }));
    }
    return mapReview(updated);
  }

  /**
   * Final investor PDF generation during Note publish.
   * Listing opens/closes are written during publish; we rebuild Page 1 HTML with real dates.
   *
   * NOTE: This intentionally does not mark the Prospectus as PUBLISHED; caller persists and flips states.
   */
  async generateFinalProspectusPdfForPublish(input: {
    noteId: string;
    actor: ActorContext;
    approvedSnapshot: ProspectusApprovedSnapshot;
    publicationId: string;
    reviewId: string;
    listingDates?: { opensAt: Date; closesAt: Date };
  }): Promise<{
    updatedSnapshot: ProspectusApprovedSnapshot;
    pdfArtifact: ProspectusPdfArtifact;
  }> {
    const { noteId, actor, approvedSnapshot, publicationId, reviewId, listingDates } = input;

    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: {
        listing: { select: { opens_at: true, closes_at: true } },
      },
    });
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");

    const opensAt = listingDates?.opensAt ?? note.listing?.opens_at;
    const closesAt = listingDates?.closesAt ?? note.listing?.closes_at;
    if (!opensAt || !closesAt) {
      throw new AppError(
        409,
        "PROSPECTUS_FINALIZATION_MISSING_LISTING_DATES",
        "Listing opens_at/closes_at must exist before final Prospectus PDF generation"
      );
    }

    const publication = approvedSnapshot.publication_content;
    // Approved snapshots store a frozen wrapper around resolved publication content.
    // Page builders expect the resolved publication shape (e.g. `keyInvestorHighlights`).
    const publicationContent =
      (publication as any)?.resolvedPublicationContent ?? (publication as any);

    // Rebuild Page 1 with real listing dates; other pages use the same frozen publication content.
    const page1Note = await loadProspectusPageOneNote(prisma, noteId);
    if (listingDates) {
      page1Note.listing = {
        opens_at: listingDates.opensAt,
        closes_at: listingDates.closesAt,
      };
    }
    const page1Input = await mapProspectusPageOneDataToInput(page1Note);
    page1Input.publicationContent = publicationContent as any;
    page1Input.trackRecordMode = "frozen_publication_snapshot";
    page1Input.page1TrackRecordSnapshot =
      approvedSnapshot.page_1 as typeof page1Input.page1TrackRecordSnapshot;
    const page1 = buildProspectusPageOne(page1Input);

    const page2Data = await loadProspectusPageTwoData(prisma, noteId);
    const page2Input = mapProspectusPageTwoDataToInput(page2Data);
    page2Input.publicationContent = publicationContent as any;
    const page2 = buildProspectusPageTwo(page2Input);

    const page3Data = await loadProspectusPageThreeData(prisma, noteId);
    const page3Input = mapProspectusPageThreeDataToInput(page3Data);
    page3Input.publicationContent = publicationContent as any;
    const page3 = buildProspectusPageThree(page3Input);

    const page1Html = buildProspectusPageOneHtml(page1);
    const page2Html = buildProspectusPageTwoHtml(page2);
    const page3Html = buildProspectusPageThreeHtml(page3);
    const updatedSnapshot = withApprovedSnapshotHtml(approvedSnapshot, {
      page1: page1Html,
      page2: page2Html,
      page3: page3Html,
      page4: buildProspectusPageFourHtml(),
      page5: buildProspectusPageFiveHtml(),
    });
    updatedSnapshot.publication_id = publicationId;
    updatedSnapshot.note_identity = {
      ...(updatedSnapshot.note_identity ?? {}),
      listing_opens_at: opensAt.toISOString(),
      listing_closes_at: closesAt.toISOString(),
    };

    // SnapshotHash must be unique per final listing dates so S3 keys don't collide across retries.
    const listingSalt = `${opensAt.toISOString()}|${closesAt.toISOString()}`;
    const finalSnapshotHash = createHash("sha256")
      .update(`${updatedSnapshot.render_fingerprint}|${listingSalt}`)
      .digest("hex");

    const pdfArtifact = await generateAndStoreProspectusPdf({
      noteId,
      publicationId,
      snapshotHash: finalSnapshotHash,
      html: updatedSnapshot.html,
    });

    // Persist-only actions remain in caller. Return artifacts for DB updates.
    void reviewId; // kept for future audit correlation
    void actor; // caller logs publish action

    return { updatedSnapshot, pdfArtifact };
  }

  /**
   * Read-only preview from saved review content (draft or approved).
   * Does not create/update review rows, snapshots, or audit save events.
   */
  async preview(noteId: string, _actor: ActorContext) {
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: { id: true },
    });
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");

    const review = await prisma.noteProspectusReview.findUnique({
      where: { note_id: noteId },
    });
    if (!review) {
      throw new AppError(404, "PROSPECTUS_REVIEW_NOT_FOUND", "Prospectus review not found");
    }

    const status = mapReview(review).status;
    const useApproved =
      (normalizeProspectusWorkflowStatus(status) === "APPROVED" ||
        normalizeProspectusWorkflowStatus(status) === "READY_FOR_PUBLISH") &&
      review.approved_content != null;
    const content = useApproved
      ? asStoredContent(review.approved_content)
      : asStoredContent(review.draft_content);
    const sourceLabel = useApproved ? ("approved" as const) : ("draft" as const);
    const bannerText = useApproved
      ? "Prospectus content is ready for publish — not yet published"
      : "Draft Prospectus — not yet approved";

    // IMPORTANT: When previewing approved content, we must render Page 1 from the
    // same frozen Page 1 snapshot used at final publish-time. Otherwise, the
    // current/unpublished Note can cause Page 1 issuer track record/historical
    // notes to be re-calculated from live data, diverging from the frozen snapshot.
    const approvedSnapshot = useApproved
      ? parseApprovedSnapshot(review.approved_snapshot)
      : null;
    const frozenPage1Snapshot = approvedSnapshot?.page_1 ?? null;
    // Page 2/3 are derived from the shared Stage 4A financial comparison freeze.
    // During APPROVED/READY_FOR_PUBLISH Preview, we must use the frozen approved
    // financial data even when the Note itself is not yet published.
    const frozenFinancialComparisonFromApprovedSnapshot =
      (approvedSnapshot as any)?.page_2?.financial_comparison ?? null;

    return this.renderPreviewHtml(noteId, content, {
      status,
      previewSource: sourceLabel,
      bannerText,
      frozenPage1Snapshot,
      frozenFinancialComparisonFromApprovedSnapshot,
    });
  }

  /**
   * Live preview from unsaved officer form payload.
   * Uses request draftContent for editable fields; system/note data from server only.
   * Never writes to the database.
   */
  async previewUnsaved(noteId: string, rawInput: unknown, _actor: ActorContext) {
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        paymaster_snapshot: true,
        invoice_snapshot: true,
        purpose_snapshot: true,
        contract_snapshot: true,
        profit_rate_percent: true,
        maturity_date: true,
        listing: { select: { opens_at: true } },
      },
    });
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");

    const input: SaveProspectusReviewDraftInput = saveProspectusReviewDraftSchema.parse(rawInput);
    const draftErrors = validateDraftContent(input.draftContent);
    if (draftErrors.length > 0) {
      throw new AppError(422, "PROSPECTUS_REVIEW_INVALID", "Draft content is invalid", {
        details: draftErrors,
      });
    }

    const draftToRender = stripLegacyPaymentBasisShariahKeys(
      normalizeProspectusReviewSelections(
        input.draftContent as ProspectusReviewStoredContent,
        recommendationInputFromNote(note),
        aboutInvoiceRecommendationInputFromNote(note)
      )
    );

    const review = await prisma.noteProspectusReview.findUnique({
      where: { note_id: noteId },
      select: { status: true },
    });
    const status = normalizeProspectusWorkflowStatus(
      review?.status ?? ProspectusReviewStatus.DRAFT
    );

    return this.renderPreviewHtml(noteId, draftToRender, {
      status,
      previewSource: "unsaved",
      bannerText: "Live Preview — unsaved changes (not saved)",
    });
  }

  /** Shared Page 1–3 HTML builders for preview and approval paths. */
  private async renderPreviewHtml(
    noteId: string,
    content: ProspectusReviewStoredContent,
    meta: {
      status: ProspectusReviewStatus | string;
      previewSource: "draft" | "approved" | "unsaved";
      bannerText: string;
      /**
       * When previewing approved content, force Page 1 to use the frozen approved
       * Page 1 track record snapshot (publish-time parity).
       *
       * When null/undefined, we preserve existing behavior (draft/live preview uses
       * Note-derived live unpublished preview track record).
       */
      frozenPage1Snapshot?: unknown | null;
      /**
       * Only set for APPROVED/READY_FOR_PUBLISH preview when an approved_snapshot exists.
       * Forces Page 2/3 to use the approved frozen financial data (Stage 4A) instead of
       * rebuilding from LIVE application/CTOS financials.
       */
      frozenFinancialComparisonFromApprovedSnapshot?: unknown | null;
    }
  ) {
    const publication = toProspectusPublicationContent(content);
    const banner = `<div data-prospectus-preview-banner="${meta.previewSource}" data-preview-source="${meta.previewSource}">${meta.bannerText}</div>`;

    const page1Note = await loadProspectusPageOneNote(prisma, noteId);
    const page1Input = await mapProspectusPageOneDataToInput(page1Note);

    // Approved preview: force frozen Page 1 track record snapshot to match final PDF.
    if (meta.frozenPage1Snapshot) {
      page1Input.trackRecordMode = "frozen_publication_snapshot";
      page1Input.page1TrackRecordSnapshot = meta.frozenPage1Snapshot as any;
    }
    page1Input.publicationContent = publication;
    const page1 = buildProspectusPageOne(page1Input);

    const page2Data = await loadProspectusPageTwoData(prisma, noteId);
    const page2Input = mapProspectusPageTwoDataToInput(page2Data);
    page2Input.publicationContent = publication;

    if (
      meta.frozenFinancialComparisonFromApprovedSnapshot != null &&
      page2Input.financialMode === "live_unpublished_preview"
    ) {
      page2Input.financialMode = "frozen_publication_snapshot";
      page2Input.frozenFinancialComparison =
        meta.frozenFinancialComparisonFromApprovedSnapshot as any;
    }
    const page2 = buildProspectusPageTwo(page2Input);

    const page3Data = await loadProspectusPageThreeData(prisma, noteId);
    const page3Input = mapProspectusPageThreeDataToInput(page3Data);
    page3Input.publicationContent = publication;

    if (
      meta.frozenFinancialComparisonFromApprovedSnapshot != null &&
      page3Input.financialMode === "live_unpublished_preview"
    ) {
      page3Input.financialMode = "frozen_publication_snapshot";
      page3Input.frozenFinancialComparison =
        meta.frozenFinancialComparisonFromApprovedSnapshot as any;
    }
    const page3 = buildProspectusPageThree(page3Input);

    const page1Html = buildProspectusPageOneHtml(page1);
    const page2Html = buildProspectusPageTwoHtml(page2);
    const page3Html = buildProspectusPageThreeHtml(page3);
    const page4Html = buildProspectusPageFourHtml();
    const page5Html = buildProspectusPageFiveHtml();

    return {
      status: meta.status,
      previewSource: meta.previewSource,
      draftMarker: meta.bannerText,
      html: {
        page1: `${banner}${page1Html}`,
        page2: `${banner}${page2Html}`,
        page3: `${banner}${page3Html}`,
        page4: `${banner}${page4Html}`,
        page5: `${banner}${page5Html}`,
        allPages: combineProspectusPagesHtml({
          page1: page1Html,
          page2: page2Html,
          page3: page3Html,
          page4: page4Html,
          page5: page5Html,
        }),
      },
    };
  }

  /**
   * @deprecated Publish must copy approved_snapshot — not rebuild publication content.
   * Kept for tests that inspect freeze shape; prefer getApprovedSnapshotForPublish.
   */
  async buildFrozenPublicationContentForPublish(
    noteId: string
  ): Promise<ProspectusFrozenPublicationContent | null> {
    const review = await prisma.noteProspectusReview.findUnique({ where: { note_id: noteId } });
    if (
      !review ||
      (review.status !== ProspectusReviewStatus.APPROVED &&
        review.status !== ProspectusReviewStatus.READY_FOR_PUBLISH) ||
      !review.approved_content
    ) {
      return null;
    }
    const snapshot = parseApprovedSnapshot(review.approved_snapshot);
    if (snapshot?.publication_content) {
      return snapshot.publication_content;
    }
    const content = saveProspectusReviewDraftSchema.shape.draftContent.parse(
      review.approved_content
    );
    const stored = content as ProspectusReviewStoredContent;
    return {
      version: `content.${review.content_version}`,
      optionCatalogueVersion: review.option_catalogue_version,
      approvedAt: (review.approved_at ?? new Date()).toISOString(),
      approvedBy: review.approved_by_user_id ?? "",
      content: cloneReviewContent(stored),
      resolvedPublicationContent: toProspectusPublicationContent(stored),
    };
  }
}

export const prospectusReviewService = new ProspectusReviewService();

export { mergePublicationContentIntoSnapshot };
