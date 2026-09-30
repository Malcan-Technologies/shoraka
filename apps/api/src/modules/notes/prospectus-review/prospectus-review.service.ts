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
import { logger } from "../../../lib/logger";
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
import type { ProspectusPageOne } from "../prospectus/prospectus-page-one.types";
import type {
  ProspectusPageTwo,
  ProspectusPageTwoFinancialMode,
} from "../prospectus/prospectus-page-two.types";
import type { ProspectusPage2FinancialComparisonSnapshot } from "../prospectus/prospectus-snapshot.types";
import { getActiveProspectusCatalogues } from "./prospectus-option-catalogues";
import {
  approvedFinancialHtmlForPublish,
  buildApprovedFinancialPages,
  buildApprovedPageOne,
  completeApprovedFinancialFreeze,
  parseApprovedFinancialFreeze,
  renderApprovedFinancialPagesHtml,
  type ProspectusFinancialPages,
} from "./prospectus-approved-render";
import { mergePublicationContentIntoSnapshot } from "./prospectus-frozen-publication";
import {
  buildCompleteApprovedProspectusSnapshot,
  computeCurrentRenderFingerprint,
  hashDraftContent,
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

function approvalClearedData(actorUserId: string, draftContent: ProspectusReviewStoredContent) {
  return {
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
  };
}

async function clearApprovalEligibility(
  tx: Prisma.TransactionClient,
  noteId: string,
  actorUserId: string,
  draftContent: ProspectusReviewStoredContent
) {
  return tx.noteProspectusReview.update({
    where: { note_id: noteId },
    data: approvalClearedData(actorUserId, draftContent),
  });
}

/**
 * Compare-and-set clear: only while the row is still the approval this request loaded (approved
 * status, same render_fingerprint and content_version). Null when another request moved it on.
 */
async function clearLoadedApprovalEligibility(
  tx: Prisma.TransactionClient,
  loaded: NoteProspectusReview,
  loadedFingerprint: string,
  actorUserId: string
): Promise<NoteProspectusReview | null> {
  const { count } = await tx.noteProspectusReview.updateMany({
    where: {
      note_id: loaded.note_id,
      status: { in: [ProspectusReviewStatus.APPROVED, ProspectusReviewStatus.READY_FOR_PUBLISH] },
      render_fingerprint: loadedFingerprint,
      content_version: loaded.content_version,
    },
    data: approvalClearedData(actorUserId, asStoredContent(loaded.draft_content)),
  });
  if (count === 0) return null;
  return tx.noteProspectusReview.findUniqueOrThrow({ where: { note_id: loaded.note_id } });
}

/**
 * Source drift while approved → Draft, exactly once across concurrent GETs. A request that loses
 * the compare-and-set writes nothing and returns the row as it now is.
 */
async function invalidateApprovalOnSourceDrift(
  loaded: NoteProspectusReview,
  loadedFingerprint: string,
  currentFingerprint: string,
  actor: ActorContext
): Promise<NoteProspectusReview> {
  const noteId = loaded.note_id;
  const invalidated = await prisma.$transaction(async (tx) => {
    const row = await clearLoadedApprovalEligibility(tx, loaded, loadedFingerprint, actor.userId);
    if (!row) return null;
    await logProspectusAction(
      tx,
      noteId,
      "PROSPECTUS_APPROVAL_INVALIDATED_SOURCE",
      actor,
      asJson(mapReview(loaded)),
      asJson(mapReview(row))
    );
    return row;
  });
  if (!invalidated) {
    return prisma.noteProspectusReview.findUniqueOrThrow({ where: { note_id: noteId } });
  }
  logger.warn(
    {
      noteId,
      storedFingerprint: loadedFingerprint,
      currentFingerprint,
      contentVersionBefore: loaded.content_version,
      contentVersionAfter: invalidated.content_version,
      correlationId: actor.correlationId,
    },
    "Prospectus approval invalidated by source drift"
  );
  return invalidated;
}

/**
 * Unpublish (zero investors) reopens the prospectus as Draft with fields preserved.
 * Does not bump content_version — the next Approve creates the new publication version.
 * Prior `note_prospectus_publications` rows are kept for audit; live `published_at` is cleared.
 */
async function reopenProspectusDraftAfterUnpublish(
  tx: Prisma.TransactionClient,
  noteId: string,
  actor: ActorContext
) {
  const review = await tx.noteProspectusReview.findUnique({ where: { note_id: noteId } });
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

/**
 * The frozen financial comparison exactly as it will be read back from storage (JSON round
 * trip + strict parse), so the approved HTML equals any later render of the stored snapshot.
 */
function financialFreezeAsStored(
  snapshot: ProspectusApprovedSnapshot
): ProspectusPage2FinancialComparisonSnapshot {
  const stored = JSON.parse(JSON.stringify({ page_2: snapshot.page_2 })) as Pick<
    ProspectusApprovedSnapshot,
    "page_2"
  >;
  const freeze = parseApprovedFinancialFreeze(stored);
  if (!freeze) {
    throw new AppError(
      500,
      "PROSPECTUS_FINANCIAL_FREEZE_INVALID",
      "Prospectus financial freeze could not be built"
    );
  }
  return freeze;
}

/** Approval validation against the real (non-placeholder) years of the frozen Page 3. */
async function assertApprovalContentValid(
  note: {
    status: NoteStatus;
    published_at: Date | null;
    prospectus_snapshot: unknown;
    issuer_organization_id: string;
  },
  approvedClone: ProspectusReviewStoredContent,
  financialPages: ProspectusFinancialPages
): Promise<void> {
  const incomeStatementYears = financialPages.page3.incomeStatement.years
    .filter((year) => !year.isPlaceholder)
    .map((year) => String(year.year));

  let hasMarcAssessment: boolean | undefined = undefined;
  try {
    const marcSnapshot = await resolveMarcSnapshotForProspectus(note);
    hasMarcAssessment = isCompleteIssuerMarcAssessment(marcSnapshot ?? null);
  } catch {
    // Mirror frontend semantics: undefined = not evaluated yet (do not enforce).
    hasMarcAssessment = undefined;
  }

  const errors = validateApprovalContent(approvedClone, {
    incomeStatementYears,
    hasMarcAssessment,
  });
  if (errors.length > 0) {
    throw new AppError(422, "PROSPECTUS_REVIEW_INVALID", "Approval validation failed", {
      details: errors,
    });
  }
}

/** Approve-time HTML: Page 1 from the frozen track record, Page 2 / 3 from the frozen page_2. */
async function renderApprovedSnapshotHtml(
  noteId: string,
  snapshot: ProspectusApprovedSnapshot,
  publication: ReturnType<typeof toProspectusPublicationContent>,
  financialPages: ProspectusFinancialPages
): Promise<ProspectusApprovedSnapshot["html"]> {
  const page1 = await buildApprovedPageOne({
    noteId,
    page1Snapshot: snapshot.page_1,
    publicationContent: publication,
  });
  return {
    page1: buildProspectusPageOneHtml(page1),
    ...renderApprovedFinancialPagesHtml(financialPages),
    page4: buildProspectusPageFourHtml(),
    page5: buildProspectusPageFiveHtml(),
  };
}

/**
 * GET view-models. An approved version-2 freeze on an unpublished Note renders from the approved
 * snapshot (no financial read, no source / year selection). Anything else keeps the live path.
 */
async function buildReviewReadPages(input: {
  noteId: string;
  contentForProfile: ProspectusReviewStoredContent;
  approvedSnapshot: ProspectusApprovedSnapshot | null;
}): Promise<{ page1: ProspectusPageOne; page2: ProspectusPageTwo }> {
  const { noteId, contentForProfile, approvedSnapshot } = input;
  const frozenFinancialComparison = completeApprovedFinancialFreeze(approvedSnapshot);
  if (approvedSnapshot && frozenFinancialComparison) {
    const page1 = await buildApprovedPageOne({ noteId, page1Snapshot: approvedSnapshot.page_1 });
    const { page2 } = await buildApprovedFinancialPages({
      noteId,
      frozenFinancialComparison,
      publicationContent: toProspectusPublicationContent(contentForProfile),
    });
    return { page1, page2 };
  }

  const page1Note = await loadProspectusPageOneNote(prisma, noteId);
  const page1 = buildProspectusPageOne(await mapProspectusPageOneDataToInput(page1Note));
  const page2Data = await loadProspectusPageTwoData(prisma, noteId);
  const page2Input = mapProspectusPageTwoDataToInput(page2Data);
  if (!page2Input.isPublished) {
    page2Input.publicationContent = toProspectusPublicationContent(contentForProfile);
  }
  return { page1, page2: buildProspectusPageTwo(page2Input) };
}

async function buildLivePreviewPageOne(
  noteId: string,
  publication: ReturnType<typeof toProspectusPublicationContent>
): Promise<ProspectusPageOne> {
  const page1Input = await mapProspectusPageOneDataToInput(
    await loadProspectusPageOneNote(prisma, noteId)
  );
  page1Input.publicationContent = publication;
  return buildProspectusPageOne(page1Input);
}

/** Legacy approved freeze (no freeze_version) replaces live financials on an unpublished Note. */
function applyLegacyFrozenFinancialComparison(
  input: {
    financialMode: ProspectusPageTwoFinancialMode;
    frozenFinancialComparison: ProspectusPage2FinancialComparisonSnapshot | null;
  },
  legacyFrozenFinancialComparison: unknown | null
): void {
  if (legacyFrozenFinancialComparison == null || input.financialMode !== "live_unpublished_preview") {
    return;
  }
  input.financialMode = "frozen_publication_snapshot";
  input.frozenFinancialComparison =
    legacyFrozenFinancialComparison as ProspectusPage2FinancialComparisonSnapshot;
}

/** Draft / legacy-approved preview Page 2 / 3 (unchanged path). */
async function buildPreviewFinancialPages(
  noteId: string,
  publication: ReturnType<typeof toProspectusPublicationContent>,
  legacyFrozenFinancialComparison: unknown | null
): Promise<ProspectusFinancialPages> {
  const page2Input = mapProspectusPageTwoDataToInput(await loadProspectusPageTwoData(prisma, noteId));
  page2Input.publicationContent = publication;
  applyLegacyFrozenFinancialComparison(page2Input, legacyFrozenFinancialComparison);

  const page3Input = mapProspectusPageThreeDataToInput(
    await loadProspectusPageThreeData(prisma, noteId)
  );
  page3Input.publicationContent = publication;
  applyLegacyFrozenFinancialComparison(page3Input, legacyFrozenFinancialComparison);
  return { page2: buildProspectusPageTwo(page2Input), page3: buildProspectusPageThree(page3Input) };
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
      throw new AppError(409, "PROSPECTUS_REVIEW_REQUIRED", PUBLISH_BLOCKED);
    }
    const snapshot = parseApprovedSnapshot(review.approved_snapshot);
    if (!snapshot || !review.approved_content || !review.approved_publication_id) {
      throw new AppError(409, "PROSPECTUS_REVIEW_REQUIRED", PUBLISH_BLOCKED);
    }
    if (review.render_fingerprint !== snapshot.render_fingerprint) {
      throw new AppError(409, "PROSPECTUS_REVIEW_REQUIRED", PUBLISH_BLOCKED);
    }

    const currentFp = await computeCurrentRenderFingerprint({
      noteId,
      approvedContent: asStoredContent(review.approved_content),
      approvedSnapshot: snapshot,
    });
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
    await reopenProspectusDraftAfterUnpublish(tx, noteId, actor);
  }

  async getOrCreateReview(noteId: string, actor: ActorContext) {
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
    }

    if (!isNoteListed(note) && review.status === ProspectusReviewStatus.PUBLISHED) {
      const healed = await prisma.$transaction(async (tx) =>
        reopenProspectusDraftAfterUnpublish(tx, noteId, actor)
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
        // Key-order independent: jsonb reorders keys, and an unneeded write here bumps
        // updated_at, which is the optimistic-lock token for save and approve.
        if (
          hashDraftContent(asStoredContent(review.draft_content)) !==
          hashDraftContent(cloneReviewContent(normalized))
        ) {
          review = await prisma.noteProspectusReview.update({
            where: { note_id: noteId },
            data: {
              draft_content: normalized as unknown as Prisma.InputJsonValue,
              option_catalogue_version: catalogueVersion(),
            },
          });
        }
      }
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
        const currentFp = await computeCurrentRenderFingerprint({
          noteId,
          approvedContent: asStoredContent(review.approved_content),
          approvedSnapshot: snapshot,
        });
        if (currentFp !== review.render_fingerprint) {
          review = await invalidateApprovalOnSourceDrift(
            review,
            review.render_fingerprint,
            currentFp,
            actor
          );
        }
      }
    }

    const mapped = mapReview(review);
    mapped.draftContent = normalizeProspectusReviewSelections(
      mapped.draftContent,
      recommendationInput,
      aboutInvoiceInput
    );

    const workflow = normalizeProspectusWorkflowStatus(review.status);
    const isApprovedWorkflow = workflow === "APPROVED" || workflow === "READY_FOR_PUBLISH";
    // Use saved draft/approved officer content so Admin Issuer Profile matches Preview.
    const contentForProfile =
      isApprovedWorkflow && mapped.approvedContent != null
        ? mapped.approvedContent
        : mapped.draftContent;
    const approvedSnapshot =
      isApprovedWorkflow && mapped.approvedContent != null && !isNoteListed(note)
        ? parseApprovedSnapshot(review.approved_snapshot)
        : null;
    const { page1, page2 } = await buildReviewReadPages({
      noteId,
      contentForProfile,
      approvedSnapshot,
    });
    const publishBlocked =
      !isNoteListed(note) && workflow !== "APPROVED" ? PUBLISH_BLOCKED : null;

    return {
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
  }

  async saveDraft(noteId: string, rawInput: unknown, actor: ActorContext) {
    const input: SaveProspectusReviewDraftInput = saveProspectusReviewDraftSchema.parse(rawInput);
    const draftErrors = validateDraftContent(input.draftContent);
    if (draftErrors.length > 0) {
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
        await reopenProspectusDraftAfterUnpublish(tx, noteId, actor);
      });
      current = await prisma.noteProspectusReview.findUniqueOrThrow({
        where: { note_id: noteId },
      });
    }

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

    // APPROVED/READY_FOR_PUBLISH + identical content → keep (no version bump needed for noop).
    if (
      (current.status === ProspectusReviewStatus.APPROVED ||
        current.status === ProspectusReviewStatus.READY_FOR_PUBLISH) &&
      !contentChanged
    ) {
      return mapReview(current);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (
        (current!.status === ProspectusReviewStatus.APPROVED ||
          current!.status === ProspectusReviewStatus.READY_FOR_PUBLISH) &&
        contentChanged
      ) {
        const row = await clearApprovalEligibility(tx, noteId, actor.userId, draftToStore);
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
    });

    return mapReview(updated);
  }

  async approve(
    noteId: string,
    actor: ActorContext,
    rawDraft?: unknown,
    expectedUpdatedAt?: string
  ) {
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
        await reopenProspectusDraftAfterUnpublish(tx, noteId, actor);
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
    const publication = toProspectusPublicationContent(approvedClone);
    const now = new Date();
    const nextVersion = current.content_version + 1;
    const publicationId = `pub_${randomBytes(16).toString("hex")}`;
    const frozenSnapshot = await buildCompleteApprovedProspectusSnapshot({
      noteId,
      publicationId,
      contentVersion: nextVersion,
      approvedContent: approvedClone,
      approvedAt: now,
      approvedByUserId: actor.userId,
      optionCatalogueVersion: catalogueVersion(),
    });
    // Page 2 / Page 3 come from the page_2 that is stored — never a second live resolution.
    const financialPages = await buildApprovedFinancialPages({
      noteId,
      frozenFinancialComparison: financialFreezeAsStored(frozenSnapshot),
      publicationContent: publication,
    });
    await assertApprovalContentValid(note, approvedClone, financialPages);

    // Freeze rendered HTML at approve so publish/investor never rebuild.
    const approvedSnapshot = withApprovedSnapshotHtml(
      frozenSnapshot,
      await renderApprovedSnapshotHtml(noteId, frozenSnapshot, publication, financialPages)
    );

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
      return row;
    });
    if (note.source_application_id) {
      await mergeApplicationAdminFinancialSupplementsIntoOrg({
        applicationId: note.source_application_id,
      });
    }
    return mapReview(updated);
  }

  /**
   * Final investor PDF generation during Note publish (and campaign extend).
   * Listing opens/closes are written during publish; we rebuild Page 1 HTML with real dates.
   * Pages 2–5 keep the approved HTML: no live Page 2 / Page 3 resolution after approval.
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

    // Only Page 1 is re-rendered (real listing dates, frozen track record). Pages 2–5 are the
    // approved HTML byte for byte; an empty approved Page 2 / 3 renders from the frozen page_2.
    const page1 = await buildApprovedPageOne({
      noteId,
      page1Snapshot: approvedSnapshot.page_1,
      publicationContent,
      listingDates,
    });
    const financialHtml = await approvedFinancialHtmlForPublish({
      noteId,
      approvedSnapshot,
      publicationContent,
    });
    const updatedSnapshot = withApprovedSnapshotHtml(approvedSnapshot, {
      page1: buildProspectusPageOneHtml(page1),
      page2: financialHtml.page2,
      page3: financialHtml.page3,
      page4: approvedSnapshot.html.page4 || buildProspectusPageFourHtml(),
      page5: approvedSnapshot.html.page5 || buildProspectusPageFiveHtml(),
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
      select: { id: true, status: true, published_at: true },
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
    // Page 2/3 likewise come from the approved financial freeze, not live financials.
    const approvedSnapshot = useApproved
      ? parseApprovedSnapshot(review.approved_snapshot)
      : null;

    return this.renderPreviewHtml(noteId, content, {
      status,
      previewSource: sourceLabel,
      bannerText,
      approvedSnapshot,
      noteListed: isNoteListed(note),
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

  /** Shared Page 1–5 HTML builders for saved, approved and unsaved preview. */
  private async renderPreviewHtml(
    noteId: string,
    content: ProspectusReviewStoredContent,
    meta: {
      status: ProspectusReviewStatus | string;
      previewSource: "draft" | "approved" | "unsaved";
      bannerText: string;
      /**
       * Only set for APPROVED/READY_FOR_PUBLISH preview. Page 1 uses its frozen track record
       * (publish-time parity); Page 2/3 use its frozen financial comparison (Stage 4A).
       * Absent → draft/live preview (Note-derived live track record and financials).
       */
      approvedSnapshot?: ProspectusApprovedSnapshot | null;
      noteListed?: boolean;
    }
  ) {
    const publication = toProspectusPublicationContent(content);
    const banner = `<div data-prospectus-preview-banner="${meta.previewSource}" data-preview-source="${meta.previewSource}">${meta.bannerText}</div>`;

    const approvedSnapshot = meta.approvedSnapshot ?? null;
    const page1 = approvedSnapshot?.page_1
      ? await buildApprovedPageOne({
          noteId,
          page1Snapshot: approvedSnapshot.page_1,
          publicationContent: publication,
        })
      : await buildLivePreviewPageOne(noteId, publication);
    // Complete (version 2) freeze on an unpublished Note: no financial read at all.
    const completeFreeze = meta.noteListed ? null : completeApprovedFinancialFreeze(approvedSnapshot);
    const { page2, page3 } = completeFreeze
      ? await buildApprovedFinancialPages({
          noteId,
          frozenFinancialComparison: completeFreeze,
          publicationContent: publication,
        })
      : await buildPreviewFinancialPages(
          noteId,
          publication,
          (approvedSnapshot?.page_2 as { financial_comparison?: unknown } | undefined)
            ?.financial_comparison ?? null
        );

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
