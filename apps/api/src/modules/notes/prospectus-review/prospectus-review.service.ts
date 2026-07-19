/**
 * SECTION: Prospectus Review service (draft / approve / reopen / preview / publish gate)
 */

import {
  NoteStatus,
  Prisma,
  ProspectusReviewStatus,
  type NoteProspectusReview,
} from "@prisma/client";
import { AppError } from "../../../lib/http/error-handler";
import { prisma } from "../../../lib/prisma";
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
import {
  mergePublicationContentIntoSnapshot,
} from "./prospectus-frozen-publication";
import {
  catalogueVersion,
  emptyProspectusReviewContent,
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

/** Notes created on/after this instant require an APPROVED prospectus review to publish. */
export const PROSPECTUS_REVIEW_REQUIRED_FROM = new Date("2026-07-19T00:00:00.000Z");

function asStoredContent(value: unknown): ProspectusReviewStoredContent {
  return value as unknown as ProspectusReviewStoredContent;
}

function mapReview(row: NoteProspectusReview) {
  return {
    id: row.id,
    noteId: row.note_id,
    status: row.status,
    contentVersion: row.content_version,
    optionCatalogueVersion: row.option_catalogue_version,
    draftContent: asStoredContent(row.draft_content),
    approvedContent: row.approved_content
      ? asStoredContent(row.approved_content)
      : null,
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

export class ProspectusReviewService {
  noteRequiresProspectusReview(note: { created_at: Date; prospectus_review?: { id: string } | null }) {
    if (note.prospectus_review) return true;
    return note.created_at.getTime() >= PROSPECTUS_REVIEW_REQUIRED_FROM.getTime();
  }

  async assertPublishAllowed(noteId: string) {
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        created_at: true,
        prospectus_review: { select: { id: true, status: true } },
      },
    });
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (!this.noteRequiresProspectusReview(note)) return;
    if (!note.prospectus_review || note.prospectus_review.status !== ProspectusReviewStatus.APPROVED) {
      throw new AppError(
        409,
        "PROSPECTUS_REVIEW_REQUIRED",
        "Prospectus review must be approved before publishing this Note"
      );
    }
  }

  async getOrCreateReview(noteId: string, actor: ActorContext) {
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: { id: true, note_reference: true, status: true, title: true },
    });
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");

    let review = await prisma.noteProspectusReview.findUnique({ where: { note_id: noteId } });
    if (!review) {
      const empty = emptyProspectusReviewContent();
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

    return {
      note: {
        id: note.id,
        noteReference: note.note_reference,
        title: note.title,
        status: note.status,
      },
      review: mapReview(review),
      catalogues: getActiveProspectusCatalogues(),
      publishBlockedReason:
        note.status === NoteStatus.DRAFT &&
        review.status !== ProspectusReviewStatus.APPROVED
          ? "Prospectus review must be approved before publish"
          : null,
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

    const existing = await prisma.noteProspectusReview.findUnique({ where: { note_id: noteId } });
    if (!existing) {
      await this.getOrCreateReview(noteId, actor);
    }
    const current = await prisma.noteProspectusReview.findUniqueOrThrow({
      where: { note_id: noteId },
    });

    if (current.status === ProspectusReviewStatus.APPROVED) {
      throw new AppError(
        409,
        "PROSPECTUS_REVIEW_LOCKED",
        "Approved review is locked. Reopen for editing first."
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

    const before = mapReview(current);
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.noteProspectusReview.update({
        where: {
          note_id: noteId,
          updated_at: current.updated_at,
        },
        data: {
          draft_content: input.draftContent as unknown as Prisma.InputJsonValue,
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

  async approve(noteId: string, actor: ActorContext) {
    const current = await prisma.noteProspectusReview.findUnique({ where: { note_id: noteId } });
    if (!current) throw new AppError(404, "PROSPECTUS_REVIEW_NOT_FOUND", "Prospectus review not found");
    if (current.status === ProspectusReviewStatus.APPROVED) {
      throw new AppError(409, "PROSPECTUS_REVIEW_ALREADY_APPROVED", "Review is already approved");
    }

    const draft = asStoredContent(current.draft_content);
    const errors = validateApprovalContent(
      saveProspectusReviewDraftSchema.shape.draftContent.parse(draft)
    );
    if (errors.length > 0) {
      throw new AppError(422, "PROSPECTUS_REVIEW_INVALID", "Approval validation failed", {
        details: errors,
      });
    }

    const now = new Date();
    const before = mapReview(current);
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.noteProspectusReview.update({
        where: { note_id: noteId },
        data: {
          status: ProspectusReviewStatus.APPROVED,
          approved_content: draft as unknown as Prisma.InputJsonValue,
          approved_by_user_id: actor.userId,
          approved_at: now,
          updated_by_user_id: actor.userId,
          option_catalogue_version: catalogueVersion(),
          content_version: { increment: 1 },
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

  async reopen(noteId: string, actor: ActorContext) {
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: { status: true, published_at: true },
    });
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (note.status !== NoteStatus.DRAFT || note.published_at != null) {
      throw new AppError(
        409,
        "PROSPECTUS_REVIEW_REOPEN_FORBIDDEN",
        "Cannot reopen prospectus review after the Note is published. Amendment/republication is out of scope."
      );
    }

    const current = await prisma.noteProspectusReview.findUnique({ where: { note_id: noteId } });
    if (!current) throw new AppError(404, "PROSPECTUS_REVIEW_NOT_FOUND", "Prospectus review not found");
    if (current.status !== ProspectusReviewStatus.APPROVED) {
      throw new AppError(409, "PROSPECTUS_REVIEW_NOT_APPROVED", "Only approved reviews can be reopened");
    }

    const before = mapReview(current);
    const seed = current.approved_content
      ? asStoredContent(current.approved_content)
      : asStoredContent(current.draft_content);
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.noteProspectusReview.update({
        where: { note_id: noteId },
        data: {
          status: ProspectusReviewStatus.DRAFT,
          draft_content: seed as unknown as Prisma.InputJsonValue,
          updated_by_user_id: actor.userId,
          content_version: { increment: 1 },
        },
      });
      await logProspectusAction(
        tx,
        noteId,
        "PROSPECTUS_REVIEW_REOPEN",
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
    const content = payload.review.draftContent;
    const publication = toProspectusPublicationContent(content);

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

    const banner =
      '<div data-prospectus-preview-banner="draft">Draft Prospectus — not yet approved</div>';

    return {
      status: payload.review.status,
      draftMarker: "Draft Prospectus — not yet approved",
      html: {
        page1: `${banner}${buildProspectusPageOneHtml(page1)}`,
        page2: `${banner}${buildProspectusPageTwoHtml(page2)}`,
        page3: `${banner}${buildProspectusPageThreeHtml(page3)}`,
      },
    };
  }

  /**
   * Build frozen publication_content branch for Note.publish atomic write.
   * Re-validates approved content. Does not mutate Application/CTOS.
   */
  async buildFrozenPublicationContentForPublish(
    noteId: string
  ): Promise<ProspectusFrozenPublicationContent | null> {
    const review = await prisma.noteProspectusReview.findUnique({ where: { note_id: noteId } });
    if (!review || review.status !== ProspectusReviewStatus.APPROVED || !review.approved_content) {
      return null;
    }
    const content = saveProspectusReviewDraftSchema.shape.draftContent.parse(
      review.approved_content
    );
    const errors = validateApprovalContent(content);
    if (errors.length > 0) {
      throw new AppError(
        422,
        "PROSPECTUS_REVIEW_INVALID",
        "Approved prospectus content failed re-validation",
        { details: errors }
      );
    }
    return {
      version: `content.${review.content_version}`,
      optionCatalogueVersion: review.option_catalogue_version,
      approvedAt: (review.approved_at ?? new Date()).toISOString(),
      approvedBy: review.approved_by_user_id ?? "",
      content: content as ProspectusReviewStoredContent,
    };
  }
}

export const prospectusReviewService = new ProspectusReviewService();

export { mergePublicationContentIntoSnapshot };
