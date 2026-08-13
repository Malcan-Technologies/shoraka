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
  type ProspectusAboutInvoiceRecommendationInput,
  type ProspectusHighlightRecommendationInput,
} from "@cashsouk/types";
import { AppError } from "../../../lib/http/error-handler";
import { prisma } from "../../../lib/prisma";
import { toAdminIssuerTrackRecordRows } from "../prospectus/prospectus-issuer-track-record";
import { toAdminHistoricalNoteTable } from "../prospectus/prospectus-historical-note-table";
import { toAdminIssuerProfileRows } from "../prospectus/prospectus-issuer-profile";
import { toAdminInvoicePaymasterRows } from "../prospectus/prospectus-invoice-paymaster";
import { toAdminPaymasterTrackRecordRows } from "../prospectus/prospectus-paymaster-track-record";
import { toAdminFinancialComparisonTable, toAdminFrozenFinancialYears } from "../prospectus/prospectus-financial-comparison-metrics";
import { combineProspectusPagesHtml } from "../prospectus/combine-prospectus-pages-html";
import {
  generateAndStoreProspectusPdf,
  PROSPECTUS_PDF_STATUS_READY,
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
import {
  NOTE_AUDIT_TARGET_TYPE,
  writeNoteAuditFromActor,
} from "../audit/writer";
import { NOTE_PROSPECTUS_INVALIDATION_REASON } from "../audit/events";

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
    const publication = await prisma.noteProspectusPublication.findUnique({
      where: { id: review.approved_publication_id },
      select: {
        pdf_generation_status: true,
        pdf_storage_key: true,
      },
    });
    if (
      !publication ||
      publication.pdf_generation_status !== PROSPECTUS_PDF_STATUS_READY ||
      !publication.pdf_storage_key
    ) {
      throw new AppError(
        409,
        "PROSPECTUS_PDF_REQUIRED",
        "Approved Prospectus PDF is missing; re-approve to generate the PDF before publish"
      );
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
      review = await prisma.$transaction(async (tx) => {
        const created = await tx.noteProspectusReview.create({
          data: {
            note_id: noteId,
            status: ProspectusReviewStatus.DRAFT,
            option_catalogue_version: catalogueVersion(),
            draft_content: empty as unknown as Prisma.InputJsonValue,
            created_by_user_id: actor.userId,
            updated_by_user_id: actor.userId,
          },
        });
        await writeNoteAuditFromActor(
          actor,
          {
            eventType: "NOTE_PROSPECTUS_REVIEW_CREATED",
            noteId,
            targetType: NOTE_AUDIT_TARGET_TYPE.REVIEW,
            targetId: created.id,
            metadata: {
              reviewId: created.id,
              newStatus: created.status,
            },
          },
          tx
        );
        return created;
      });
    } else if (
      review.status !== ProspectusReviewStatus.APPROVED &&
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
            const row = await clearApprovalEligibility(
              tx,
              noteId,
              actor.userId,
              asStoredContent(review!.draft_content)
            );
            await writeNoteAuditFromActor(
              actor,
              {
                eventType: "NOTE_PROSPECTUS_INVALIDATED",
                noteId,
                targetType: NOTE_AUDIT_TARGET_TYPE.REVIEW,
                targetId: row.id,
                metadata: {
                  reviewId: row.id,
                  previousStatus: ProspectusReviewStatus.APPROVED,
                  newStatus: row.status,
                  reasonCode: NOTE_PROSPECTUS_INVALIDATION_REASON.SOURCE_CHANGED,
                },
              },
              tx
            );
            return row;
          });
        }
      }
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

    // APPROVED + identical content → keep APPROVED (no version bump needed for noop).
    if (current.status === ProspectusReviewStatus.APPROVED && !contentChanged) {
      return mapReview(current);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (current!.status === ProspectusReviewStatus.APPROVED && contentChanged) {
        const row = await clearApprovalEligibility(tx, noteId, actor.userId, draftToStore);
        await writeNoteAuditFromActor(
          actor,
          {
            eventType: "NOTE_PROSPECTUS_INVALIDATED",
            noteId,
            targetType: NOTE_AUDIT_TARGET_TYPE.REVIEW,
            targetId: row.id,
            metadata: {
              reviewId: row.id,
              previousStatus: ProspectusReviewStatus.APPROVED,
              newStatus: row.status,
              reasonCode: NOTE_PROSPECTUS_INVALIDATION_REASON.EDIT_AFTER_APPROVAL,
            },
          },
          tx
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
    const recBundles = await loadNoteRecommendationBundles(noteId);
    const approvedClone = stripLegacyPaymentBasisShariahKeys(
      normalizeProspectusReviewSelections(
        parsed as ProspectusReviewStoredContent,
        recBundles.highlights,
        recBundles.aboutInvoice
      )
    );
    // Resolve Page 2/3 years before approve so Income Statement officer rows are validated.
    const publication = toProspectusPublicationContent(approvedClone);
    const page3Data = await loadProspectusPageThreeData(prisma, noteId);
    const page3Input = mapProspectusPageThreeDataToInput(page3Data);
    page3Input.publicationContent = publication;
    const page3 = buildProspectusPageThree(page3Input);
    // Approval uses real financial years only — never padded display placeholders.
    const errors = validateApprovalContent(approvedClone, {
      incomeStatementYears: page3.incomeStatement.years
        .filter((year) => !year.isPlaceholder)
        .map((year) => String(year.year)),
    });
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
    });

    // PDF from exact frozen HTML — before APPROVED status; publish never regenerates.
    const pdfArtifact = await generateAndStoreProspectusPdf({
      noteId,
      publicationId,
      snapshotHash: approvedSnapshot.render_fingerprint,
      html: approvedSnapshot.html,
    });

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
          pdf_storage_bucket: pdfArtifact.storageBucket,
          pdf_storage_key: pdfArtifact.storageKey,
          pdf_content_type: pdfArtifact.contentType,
          pdf_size_bytes: pdfArtifact.sizeBytes,
          pdf_sha256: pdfArtifact.sha256,
          pdf_generated_at: pdfArtifact.generatedAt,
          pdf_generation_status: pdfArtifact.generationStatus,
          pdf_generation_error: null,
          pdf_snapshot_hash: pdfArtifact.snapshotHash,
          pdf_page_count: pdfArtifact.pageCount,
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
      await writeNoteAuditFromActor(
        actor,
        {
          eventType: "NOTE_PROSPECTUS_APPROVED",
          noteId,
          targetType: NOTE_AUDIT_TARGET_TYPE.REVIEW,
          targetId: row.id,
          metadata: {
            reviewId: row.id,
            publicationId,
            contentVersion: nextVersion,
            pdfSha256: pdfArtifact.sha256,
            previousStatus: current!.status,
            newStatus: row.status,
          },
        },
        tx
      );
      return row;
    });
    return mapReview(updated);
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
      normalizeProspectusWorkflowStatus(status) === "APPROVED" &&
      review.approved_content != null;
    const content = useApproved
      ? asStoredContent(review.approved_content)
      : asStoredContent(review.draft_content);
    const sourceLabel = useApproved ? ("approved" as const) : ("draft" as const);
    const bannerText = useApproved
      ? "Approved Prospectus Preview — not yet published"
      : "Draft Prospectus — not yet approved";

    return this.renderPreviewHtml(noteId, content, {
      status,
      previewSource: sourceLabel,
      bannerText,
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
    }
  ) {
    const publication = toProspectusPublicationContent(content);
    const banner = `<div data-prospectus-preview-banner="${meta.previewSource}" data-preview-source="${meta.previewSource}">${meta.bannerText}</div>`;

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

    const page1Html = buildProspectusPageOneHtml(page1);
    const page2Html = buildProspectusPageTwoHtml(page2);
    const page3Html = buildProspectusPageThreeHtml(page3);

    return {
      status: meta.status,
      previewSource: meta.previewSource,
      draftMarker: meta.bannerText,
      html: {
        page1: `${banner}${page1Html}`,
        page2: `${banner}${page2Html}`,
        page3: `${banner}${page3Html}`,
        allPages: combineProspectusPagesHtml({
          page1: page1Html,
          page2: page2Html,
          page3: page3Html,
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
