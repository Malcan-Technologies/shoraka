/**
 * SECTION: Prospectus Review service (Draft → Approved → Published)
 * WHY: Direct approve, change-based invalidation, complete freeze at approve, copy-only publish
 */

import { randomBytes } from "node:crypto";
import {
  NoteStatus,
  Prisma,
  ProspectusReviewStatus,
  type NoteProspectusReview,
} from "@prisma/client";
import {
  buildProspectusHighlightRecommendations,
  isSoukscoreRiskRating,
  normalizeProspectusWorkflowStatus,
  type ProspectusHighlightRecommendationInput,
} from "@cashsouk/types";
import { AppError } from "../../../lib/http/error-handler";
import { prisma } from "../../../lib/prisma";
import { toAdminIssuerTrackRecordRows } from "../prospectus/prospectus-issuer-track-record";
import { toAdminHistoricalNoteTable } from "../prospectus/prospectus-historical-note-table";
import { toAdminIssuerProfileRows } from "../prospectus/prospectus-issuer-profile";
import { toAdminInvoicePaymasterRows } from "../prospectus/prospectus-invoice-paymaster";
import { toAdminPaymasterTrackRecordRows } from "../prospectus/prospectus-paymaster-track-record";
import { toAdminFinancialComparisonTable } from "../prospectus/prospectus-financial-comparison-metrics";
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
import {
  buildProspectusPageThree,
  mapProspectusPageThreeDataToInput,
} from "../prospectus/prospectus-page-three-mapper";
import { loadProspectusPageThreeData } from "../prospectus/prospectus-page-three-prisma";
import { getActiveProspectusCatalogues } from "./prospectus-option-catalogues";
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
  normalizeHighlightSelections,
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
  profit_rate_percent: Prisma.Decimal | number | null;
  maturity_date: Date | null;
  listing: { opens_at: Date | null } | null;
}): ProspectusHighlightRecommendationInput {
  const invoice = asRecord(note.invoice_snapshot);
  const offer = asRecord(invoice?.offer_details);
  const riskRating = isSoukscoreRiskRating(offer?.risk_rating) ? offer.risk_rating : null;
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

async function loadNoteRecommendationInput(
  noteId: string
): Promise<ProspectusHighlightRecommendationInput> {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      paymaster_snapshot: true,
      invoice_snapshot: true,
      profit_rate_percent: true,
      maturity_date: true,
      listing: { select: { opens_at: true } },
    },
  });
  return note ? recommendationInputFromNote(note) : {};
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
  await tx.noteAdminAction.create({
    data: {
      note_id: noteId,
      action_type: actionType,
      actor_user_id: actor.userId,
      before_state: beforeState,
      after_state: afterState,
      ip_address: actor.ipAddress,
      user_agent: actor.userAgent,
      correlation_id: actor.correlationId,
    },
  });
  await tx.noteEvent.create({
    data: {
      note_id: noteId,
      event_type: actionType,
      actor_user_id: actor.userId,
      actor_role: actor.role,
      portal: actor.portal,
      ip_address: actor.ipAddress,
      user_agent: actor.userAgent,
      correlation_id: actor.correlationId,
      metadata: { beforeState, afterState },
    },
  });
}

function isNotePublished(note: { status: NoteStatus; published_at: Date | null }) {
  return note.status === NoteStatus.PUBLISHED || note.published_at != null;
}

async function clearApprovalEligibility(
  tx: Prisma.TransactionClient,
  noteId: string,
  actorUserId: string,
  draftContent: ProspectusReviewStoredContent
) {
  return tx.noteProspectusReview.update({
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
    if (!review || review.status !== ProspectusReviewStatus.APPROVED) {
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
    return {
      snapshot,
      publicationId: review.approved_publication_id,
      reviewId: review.id,
    };
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
        profit_rate_percent: true,
        maturity_date: true,
        listing: { select: { opens_at: true } },
      },
    });
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");

    const recommendationInput = recommendationInputFromNote(note);
    const highlightRecommendations =
      buildProspectusHighlightRecommendations(recommendationInput);

    let review = await prisma.noteProspectusReview.findUnique({ where: { note_id: noteId } });
    if (!review) {
      const empty = emptyProspectusReviewContent(recommendationInput);
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
    } else if (
      review.status !== ProspectusReviewStatus.APPROVED &&
      review.status !== ProspectusReviewStatus.PUBLISHED
    ) {
      const parsed = saveProspectusReviewDraftSchema.shape.draftContent.safeParse(
        review.draft_content
      );
      if (parsed.success) {
        const normalized = normalizeHighlightSelections(
          parsed.data as ProspectusReviewStoredContent,
          recommendationInput
        );
        if (JSON.stringify(review.draft_content) !== JSON.stringify(normalized)) {
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
      review.status === ProspectusReviewStatus.APPROVED &&
      !isNotePublished(note) &&
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
          review = await prisma.$transaction(async (tx) => {
            const before = mapReview(review!);
            const row = await clearApprovalEligibility(
              tx,
              noteId,
              actor.userId,
              asStoredContent(review!.draft_content)
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
        }
      }
    }

    const mapped = mapReview(review);
    mapped.draftContent = normalizeHighlightSelections(
      mapped.draftContent,
      recommendationInput
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
        workflow === "APPROVED" && mapped.approvedContent != null
          ? mapped.approvedContent
          : mapped.draftContent;
      page2Input.publicationContent = toProspectusPublicationContent(contentForProfile);
    }
    const page2 = buildProspectusPageTwo(page2Input);
    const publishBlocked =
      !isNotePublished(note) && workflow !== "APPROVED" && workflow !== "PUBLISHED"
        ? PUBLISH_BLOCKED
        : null;

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
    if (isNotePublished(note)) {
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
      throw new AppError(
        409,
        "PROSPECTUS_PUBLISHED_LOCKED",
        "Published Prospectus cannot be edited."
      );
    }

    if (input.expectedUpdatedAt) {
      const expected = new Date(input.expectedUpdatedAt);
      if (current.updated_at.getTime() !== expected.getTime()) {
        throw new AppError(
          409,
          "CONFLICT",
          "Prospectus review was updated by another user. Reload and try again."
        );
      }
    }

    const noteForRecs = await prisma.note.findUnique({
      where: { id: noteId },
      select: {
        paymaster_snapshot: true,
        invoice_snapshot: true,
        profit_rate_percent: true,
        maturity_date: true,
        listing: { select: { opens_at: true } },
      },
    });
    const draftToStore = stripLegacyPaymentBasisShariahKeys(
      normalizeHighlightSelections(
        input.draftContent as ProspectusReviewStoredContent,
        noteForRecs ? recommendationInputFromNote(noteForRecs) : {}
      )
    );

    const previousDraft = asStoredContent(current.draft_content);
    const contentChanged =
      hashDraftContent(draftToStore) !== hashDraftContent(previousDraft);

    const before = mapReview(current);

    // APPROVED + identical content → keep APPROVED (no version bump needed for noop).
    if (current.status === ProspectusReviewStatus.APPROVED && !contentChanged) {
      return mapReview(current);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (current!.status === ProspectusReviewStatus.APPROVED && contentChanged) {
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

  async approve(noteId: string, actor: ActorContext, rawDraft?: unknown) {
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: { status: true, published_at: true },
    });
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (isNotePublished(note)) {
      throw new AppError(
        409,
        "PROSPECTUS_PUBLISHED_LOCKED",
        "Published Prospectus cannot be re-approved."
      );
    }

    let current = await prisma.noteProspectusReview.findUnique({ where: { note_id: noteId } });
    if (!current) throw new AppError(404, "PROSPECTUS_REVIEW_NOT_FOUND", "Prospectus review not found");

    if (current.status === ProspectusReviewStatus.APPROVED) {
      throw new AppError(409, "PROSPECTUS_REVIEW_ALREADY_APPROVED", "Prospectus is already approved");
    }
    if (current.status === ProspectusReviewStatus.PUBLISHED) {
      throw new AppError(
        409,
        "PROSPECTUS_PUBLISHED_LOCKED",
        "Published Prospectus cannot be re-approved."
      );
    }

    // Optional: save latest draft body before approve.
    if (rawDraft != null) {
      await this.saveDraft(noteId, rawDraft, actor);
      current = await prisma.noteProspectusReview.findUniqueOrThrow({
        where: { note_id: noteId },
      });
    }

    const parsed = saveProspectusReviewDraftSchema.shape.draftContent.parse(
      current.draft_content
    );
    const approvedClone = stripLegacyPaymentBasisShariahKeys(
      normalizeHighlightSelections(
        parsed as ProspectusReviewStoredContent,
        await loadNoteRecommendationInput(noteId)
      )
    );
    const errors = validateApprovalContent(approvedClone);
    if (errors.length > 0) {
      throw new AppError(422, "PROSPECTUS_REVIEW_INVALID", "Approval validation failed", {
        details: errors,
      });
    }

    const now = new Date();
    const nextVersion = current.content_version + 1;
    const publicationId = `pub_${randomBytes(16).toString("hex")}`;
    let approvedSnapshot = await buildCompleteApprovedProspectusSnapshot({
      noteId,
      publicationId,
      contentVersion: nextVersion,
      approvedContent: approvedClone,
      approvedAt: now,
      approvedByUserId: actor.userId,
      optionCatalogueVersion: catalogueVersion(),
    });

    // Freeze rendered HTML at approve so publish/investor never rebuild.
    const publication = toProspectusPublicationContent(approvedClone);
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
    const page3Data = await loadProspectusPageThreeData(prisma, noteId);
    const page3Input = mapProspectusPageThreeDataToInput(page3Data);
    page3Input.publicationContent = publication;
    const page3 = buildProspectusPageThree(page3Input);
    approvedSnapshot = withApprovedSnapshotHtml(approvedSnapshot, {
      page1: buildProspectusPageOneHtml(page1),
      page2: buildProspectusPageTwoHtml(page2),
      page3: buildProspectusPageThreeHtml(page3),
    });

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
        },
      });

      const row = await tx.noteProspectusReview.update({
        where: { note_id: noteId },
        data: {
          status: ProspectusReviewStatus.APPROVED,
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
        asJson(before),
        asJson(mapReview(row))
      );
      return row;
    });
    return mapReview(updated);
  }

  async preview(noteId: string, actor: ActorContext) {
    const payload = await this.getOrCreateReview(noteId, actor);
    const status = payload.review.status;
    const useApproved =
      normalizeProspectusWorkflowStatus(status) === "APPROVED" &&
      payload.review.approvedContent != null;
    const content = useApproved
      ? payload.review.approvedContent!
      : payload.review.draftContent;
    const publication = toProspectusPublicationContent(content);
    const sourceLabel = useApproved ? "approved" : "draft";
    const bannerText = useApproved
      ? "Approved Prospectus Preview — not yet published"
      : "Draft Prospectus — not yet approved";
    const banner = `<div data-prospectus-preview-banner="${sourceLabel}" data-preview-source="${sourceLabel}">${bannerText}</div>`;

    const page1Note = await loadProspectusPageOneNote(prisma, noteId);
    const page1Input = await mapProspectusPageOneDataToInput(page1Note);
    page1Input.publicationContent = publication;
    const page1 = buildProspectusPageOne(page1Input);

    const page2Data = await loadProspectusPageTwoData(prisma, noteId);
    const page2Input = mapProspectusPageTwoDataToInput(page2Data);
    page2Input.publicationContent = publication;
    const page2 = buildProspectusPageTwo(page2Input);

    const page3Data = await loadProspectusPageThreeData(prisma, noteId);
    const page3Input = mapProspectusPageThreeDataToInput(page3Data);
    page3Input.publicationContent = publication;
    const page3 = buildProspectusPageThree(page3Input);

    return {
      status,
      previewSource: sourceLabel,
      draftMarker: bannerText,
      html: {
        page1: `${banner}${buildProspectusPageOneHtml(page1)}`,
        page2: `${banner}${buildProspectusPageTwoHtml(page2)}`,
        page3: `${banner}${buildProspectusPageThreeHtml(page3)}`,
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
    if (!review || review.status !== ProspectusReviewStatus.APPROVED || !review.approved_content) {
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
