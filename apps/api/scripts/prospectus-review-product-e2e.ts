#!/usr/bin/env tsx
/**
 * Local product-review E2E for Prospectus Review (API/service layer).
 *
 * Seeds PROSPECTUS-DEMO-001, then walks:
 * Draft → Save → Preview → Approve → Publish → freeze/stability checks.
 *
 * Usage:
 *   pnpm --filter @cashsouk/api seed-prospectus-review-note
 *   pnpm --filter @cashsouk/api prospectus-review:product-e2e
 *
 * Dev-only. Never run in production.
 */
import { NoteStatus, PrismaClient, ProspectusReviewStatus, UserRole } from "@prisma/client";
import { seedProspectusReviewNote } from "./seed-prospectus-review-note";
import { buildCompleteProspectusReviewDraft } from "../src/modules/notes/prospectus-review/prospectus-review.demo-fixtures";
import {
  publicationContentFromFrozenSnapshot,
  parseFrozenPublicationContent,
} from "../src/modules/notes/prospectus-review/prospectus-frozen-publication";
import { prospectusReviewService } from "../src/modules/notes/prospectus-review/prospectus-review.service";
import { noteService } from "../src/modules/notes/service";
import { prisma as appPrisma } from "../src/lib/prisma";

const prisma = new PrismaClient();

type Actor = {
  userId: string;
  role: "ADMIN";
  portal: "ADMIN";
  ipAddress: string;
  userAgent: string;
  correlationId: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function getActor(): Promise<Actor> {
  const admin = await prisma.user.findFirst({
    where: { roles: { has: UserRole.ADMIN } },
    select: { user_id: true },
  });
  assert(admin, "No ADMIN user — run prisma seed first");
  return {
    userId: admin.user_id,
    role: "ADMIN",
    portal: "ADMIN",
    ipAddress: "127.0.0.1",
    userAgent: "prospectus-review-product-e2e",
    correlationId: `prospectus-e2e-${Date.now()}`,
  };
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("prospectus-review:product-e2e is blocked in production");
  }

  const seed = await seedProspectusReviewNote();
  const actor = await getActor();
  const noteId = seed.noteId;
  const report: Record<string, unknown> = {
    seed,
    steps: {} as Record<string, unknown>,
  };

  // Lazy create
  const initial = await prospectusReviewService.getOrCreateReview(noteId, actor);
  assert(initial.review.status === "DRAFT", "Expected DRAFT review");
  assert(!initial.review.approvedContent, "No approved content initially");
  (report.steps as Record<string, unknown>).lazyCreate = {
    status: initial.review.status,
    catalogueNotice: initial.catalogueNotice,
  };

  // Incomplete approve must fail
  let blockedApprove = false;
  try {
    await prospectusReviewService.approve(noteId, actor);
  } catch {
    blockedApprove = true;
  }
  assert(blockedApprove, "Approve from empty DRAFT must fail");

  // Save draft
  const draft = buildCompleteProspectusReviewDraft();
  const saved = await prospectusReviewService.saveDraft(
    noteId,
    { draftContent: draft, expectedUpdatedAt: initial.review.updatedAt },
    actor
  );
  assert(saved.status === "DRAFT", "Save must remain DRAFT");
  (report.steps as Record<string, unknown>).saveDraft = {
    status: saved.status,
    updatedAt: saved.updatedAt,
    contentVersion: saved.contentVersion,
  };

  // Stale concurrency
  let conflict = false;
  try {
    await prospectusReviewService.saveDraft(
      noteId,
      { draftContent: draft, expectedUpdatedAt: initial.review.updatedAt },
      actor
    );
  } catch (error) {
    conflict = Boolean(
      error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "CONFLICT"
    );
  }
  assert(conflict, "Stale save must return CONFLICT");
  (report.steps as Record<string, unknown>).concurrency = { conflict };

  // Publish blocked while DRAFT
  let publishBlockedDraft = false;
  try {
    await noteService.publish(noteId, actor);
  } catch (error) {
    publishBlockedDraft = Boolean(
      error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "PROSPECTUS_REVIEW_REQUIRED"
    );
  }
  assert(publishBlockedDraft, "Publish must be blocked before approval");

  // Draft preview (no submit step)
  const draftPreview = await prospectusReviewService.preview(noteId, actor);
  assert(draftPreview.previewSource === "draft", "Preview source must be draft before approval");
  assert(draftPreview.draftMarker.toLowerCase().includes("draft"), "Draft banner required");
  assert(
    !draftPreview.html.page1.includes(ISSUER_NAME_SNIPPET) &&
      !draftPreview.html.page2.includes(ISSUER_NAME_SNIPPET),
    "Issuer name must not appear in preview HTML"
  );
  assert(
    !draftPreview.html.page1.includes("202699990001"),
    "Registration number must not appear in preview"
  );
  assert(
    draftPreview.html.page1.includes("shariah-badge") ||
      draftPreview.html.page2.includes("shariah-badge") ||
      draftPreview.html.page3.includes("shariah-badge"),
    "Shared Shariah badge expected"
  );
  assert(
    !draftPreview.html.page1.includes("source-statement") &&
      !draftPreview.html.page2.includes("source-statement"),
    "Source Statement must be absent"
  );
  assert(
    !draftPreview.html.page1.includes("shared-footer") &&
      !draftPreview.html.page2.includes("shared-footer"),
    "Shared Footer must be absent"
  );
  (report.steps as Record<string, unknown>).draftPreview = {
    previewSource: draftPreview.previewSource,
    pages: Object.keys(draftPreview.html),
  };

  // Approve
  const approved = await prospectusReviewService.approve(noteId, actor);
  assert(approved.status === "APPROVED", "Approve → APPROVED");
  assert(approved.approvedAt, "approvedAt required");
  assert(approved.approvedByUserId === actor.userId, "approved actor required");
  (report.steps as Record<string, unknown>).approve = {
    status: approved.status,
    approvedAt: approved.approvedAt,
    catalogueVersion: approved.optionCatalogueVersion,
    contentVersion: approved.contentVersion,
  };

  const approvedPreview = await prospectusReviewService.preview(noteId, actor);
  assert(approvedPreview.previewSource === "approved", "Preview source must be approved");
  (report.steps as Record<string, unknown>).approvedPreview = {
    previewSource: approvedPreview.previewSource,
    marker: approvedPreview.draftMarker,
  };

  // Publish
  const published = await noteService.publish(noteId, actor);
  assert(published.status === NoteStatus.PUBLISHED || published.status === "PUBLISHED", "Note published");
  const noteRow = await prisma.note.findUniqueOrThrow({
    where: { id: noteId },
    include: { listing: true, prospectus_review: true },
  });
  assert(noteRow.published_at, "published_at required");
  assert(noteRow.listing?.status === "PUBLISHED", "listing published");
  const frozen = parseFrozenPublicationContent(noteRow.prospectus_snapshot);
  assert(frozen, "publication_content freeze required");
  assert(frozen.resolvedPublicationContent, "resolvedPublicationContent required");
  assert(frozen.resolvedPublicationContent.paymentBasisTemplate.paymentBasis, "payment basis frozen");
  const snapshotRecord = noteRow.prospectus_snapshot as Record<string, unknown>;
  assert(snapshotRecord.page_1, "page_1 branch preserved");
  assert(snapshotRecord.page_2, "page_2 branch preserved");
  (report.steps as Record<string, unknown>).publish = {
    noteStatus: noteRow.status,
    listingStatus: noteRow.listing?.status,
    publishedAt: noteRow.published_at?.toISOString(),
    frozenVersion: frozen.version,
    catalogueVersion: frozen.optionCatalogueVersion,
    hasResolved: Boolean(frozen.resolvedPublicationContent),
  };

  // Stability: mutate draft + application financials; published render must hold frozen wording
  const frozenWording =
    frozen.resolvedPublicationContent.paymentBasisTemplate.paymentBasis;
  await prisma.noteProspectusReview.update({
    where: { note_id: noteId },
    data: {
      draft_content: {
        ...draft,
        page1: {
          ...draft.page1,
          keyInvestorHighlights: draft.page1.keyInvestorHighlights.map((h) => ({
            ...h,
            title: h.key === "shariah" ? h.title : "MUTATED_AFTER_PUBLISH",
            description: h.key === "shariah" ? h.description : "MUTATED_AFTER_PUBLISH",
          })),
        },
      } as object,
    },
  });
  await prisma.application.update({
    where: { id: noteRow.source_application_id },
    data: {
      financial_statements: {
        questionnaire: { financial_year_end: "2024-12-31" },
        unaudited_by_year: {
          "2024": { turnover: 1, plnpat: 1, bsqpuc: 1, bscatot: 1, curlib: 1 },
        },
      },
    },
  });

  const afterMutate = await prisma.note.findUniqueOrThrow({ where: { id: noteId } });
  const fromFrozen = publicationContentFromFrozenSnapshot(afterMutate.prospectus_snapshot);
  assert(
    fromFrozen?.paymentBasisTemplate.paymentBasis === frozenWording,
    "Published wording must ignore later draft/application changes"
  );

  // Post-publish edits blocked; status is PUBLISHED
  const reviewAfter = await prisma.noteProspectusReview.findUniqueOrThrow({
    where: { note_id: noteId },
  });
  assert(reviewAfter.status === ProspectusReviewStatus.PUBLISHED, "Status must be PUBLISHED");
  assert(reviewAfter.status !== ProspectusReviewStatus.SUPERSEDED, "SUPERSEDED must not be set");
  assert(reviewAfter.approved_snapshot, "approved_snapshot retained");

  let saveBlocked = false;
  try {
    await prospectusReviewService.saveDraft(
      noteId,
      {
        draftContent: draft,
        expectedUpdatedAt: reviewAfter.updated_at.toISOString(),
      },
      actor
    );
  } catch (error) {
    saveBlocked = Boolean(
      error &&
        typeof error === "object" &&
        "code" in error &&
        typeof (error as { code: string }).code === "string"
    );
  }
  assert(saveBlocked, "Save after publish must be blocked");

  const noteSnapshot = afterMutate.prospectus_snapshot as Record<string, unknown>;
  const approvedSnap = reviewAfter.approved_snapshot as Record<string, unknown>;
  assert(
    JSON.stringify(noteSnapshot.html) === JSON.stringify(approvedSnap.html),
    "Published snapshot HTML must equal approved freeze (exact copy)"
  );

  const frozenHtml = (noteSnapshot.html ?? {}) as { page1?: string; page2?: string; page3?: string };
  assert(frozenHtml.page1, "Frozen page1 HTML required");
  assert(frozenHtml.page2, "Frozen page2 HTML required");
  assert(frozenHtml.page3, "Frozen page3 HTML required");
  assert(!frozenHtml.page1.includes(ISSUER_NAME_SNIPPET), "Published page1 hides issuer name");
  assert(!frozenHtml.page2.includes(ISSUER_NAME_SNIPPET), "Published page2 hides issuer name");
  assert(!frozenHtml.page3.includes(ISSUER_NAME_SNIPPET), "Published page3 hides issuer name");
  assert(
    frozenHtml.page1.includes("shariah-badge") ||
      frozenHtml.page2.includes("shariah-badge") ||
      frozenHtml.page3.includes("shariah-badge"),
    "Published Shariah badge visible"
  );

  (report.steps as Record<string, unknown>).stability = {
    frozenWordingUnchanged: true,
    postPublishSaveBlocked: true,
    publishedExactCopy: true,
    publishedRenderOk: true,
  };

  console.log("\nProspectus Review product E2E PASSED\n");
  console.log(JSON.stringify(report, null, 2));
}

const ISSUER_NAME_SNIPPET = "Northbridge Demo Trading";

const isDirectRun = process.argv[1]?.includes("prospectus-review-product-e2e");
if (isDirectRun) {
  main()
    .catch((error) => {
      console.error("\nProspectus Review product E2E FAILED\n");
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
      await appPrisma.$disconnect();
    });
}
