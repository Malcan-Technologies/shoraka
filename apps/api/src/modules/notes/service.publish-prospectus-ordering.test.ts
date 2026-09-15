/**
 * SECTION: Publish-time Prospectus finalization ordering
 * WHY: Ensure Note becomes PUBLISHED only after final Prospectus PDF generation succeeds.
 */

/// <reference types="jest" />

import { NoteFundingStatus, NoteListingStatus, NoteStatus } from "@prisma/client";
import { noteService } from "./service";
import { prisma } from "../../lib/prisma";
import { prospectusReviewService } from "./prospectus-review/prospectus-review.service";
import {
  notifyNotePublished,
  notifyNotePublishedToInvestors,
} from "../notification/note-lifecycle-notifications";

import type { ProspectusApprovedSnapshot } from "./prospectus-review/prospectus-approved-snapshot";

const approvedSnapshot = {
  publication_content: {},
  render_fingerprint: "fp",
  note_identity: {},
  page_1: {},
  page_2: {},
  publication_id: "pub_1",
  content_version: 1,
  calculated_at: new Date("2026-07-19T00:00:00.000Z").toISOString(),
  approvedBy: "admin-1",
  html: { page1: "<p>DNA</p>", page2: "<p>p2</p>", page3: "<p>p3</p>" },
} as unknown as ProspectusApprovedSnapshot;

const actor = {
  userId: "admin-1",
  role: "ADMIN" as const,
  portal: "ADMIN" as const,
  ipAddress: "127.0.0.1",
  userAgent: "test",
  correlationId: "corr-1",
  auditContext: {},
} as any;

jest.mock("../../lib/prisma", () => {
  const tx = {
    note: {
      updateMany: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(async () => ({ id: "note-1" })),
    },
    noteListing: {
      upsert: jest.fn(),
    },
    contract: {
      findUnique: jest.fn(async () => ({ contract_details: {} })),
    },
    noteProspectusReview: {
      updateMany: jest.fn(),
    },
    noteProspectusPublication: {
      updateMany: jest.fn(),
    },
    $queryRaw: jest.fn(async () => []),
  };

  return {
    prisma: {
      platformFinanceSetting: {
        upsert: jest.fn(async () => ({ platform_fee_rate_cap_percent: 100 })),
      },
      $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
      note: tx.note,
      noteListing: tx.noteListing,
      noteProspectusReview: tx.noteProspectusReview,
      noteProspectusPublication: tx.noteProspectusPublication,
    },
  };
});

jest.mock("./repository", () => ({
  noteRepository: {
    findById: jest.fn(async () => ({
      id: "note-1",
      status: NoteStatus.DRAFT,
      funding_status: NoteFundingStatus.NOT_OPEN,
      listing_status: NoteListingStatus.NOT_LISTED,
      source_contract_id: "contract-1",
      prospectus_review: { id: "rev-1" },
      issuer_organization_id: "org-1",
      platform_fee_rate_percent: 0,
      service_fee_rate_percent: 0,
    })),
  },
}));

jest.mock("./prospectus-review/prospectus-review.service", () => {
  return {
    prospectusReviewService: {
      getApprovedSnapshotForPublish: jest.fn(async () => ({
        snapshot: approvedSnapshot,
        publicationId: "pub-1",
        reviewId: "rev-1",
      })),
      generateFinalProspectusPdfForPublish: jest.fn(),
    },
  };
});

jest.mock("../applications/split-origination-guards", () => ({
  assertFacilityIsEnabled: jest.fn(),
  assertSourceFacilityEnabled: jest.fn(),
}));

jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

jest.mock("../notification/note-lifecycle-notifications", () => ({
  notifyNotePublished: jest.fn(),
  notifyNotePublishedToInvestors: jest.fn(),
  resolveNoteNotificationTitle: jest.fn(() => "Note published"),
}));

jest.mock("./mapper", () => ({
  mapNoteListItem: jest.fn(() => ({})),
  mapNoteDetail: jest.fn(async (note: any) => note),
}));

// Ensure no audit/logging side effects in this ordering test.
jest.spyOn(noteService as any, "logAdminAction").mockImplementation(async () => {});

describe("publish-time Prospectus finalization ordering", () => {
  const prismaAny = prisma as any;
  const prospectusReviewServiceAny = prospectusReviewService as any;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaAny.note.updateMany.mockResolvedValue({ count: 1 });
    prismaAny.note.update.mockResolvedValue({
      id: "note-1",
      issuer_organization_id: "org-1",
      status: NoteStatus.PUBLISHED,
      listing_status: NoteListingStatus.PUBLISHED,
      funding_status: NoteFundingStatus.OPEN,
      published_at: new Date(),
    });
    prismaAny.noteProspectusReview.updateMany.mockResolvedValue({ count: 1 });
    prismaAny.noteProspectusPublication.updateMany.mockResolvedValue({ count: 1 });
  });

  it("does not publish the Note when final Prospectus PDF generation fails", async () => {
    prospectusReviewServiceAny.generateFinalProspectusPdfForPublish.mockRejectedValue(
      new Error("PDF generation failed")
    );

    await expect(noteService.publish("note-1", actor)).rejects.toThrow("PDF generation failed");

    // Phase 3 should never execute: no note status PUBLISHED update should occur.
    const publishedCalls = (prismaAny.note.updateMany.mock.calls ?? []).filter(
      (call: any[]) => call?.[0]?.data?.status === NoteStatus.PUBLISHED
    );
    expect(publishedCalls).toHaveLength(0);

    expect(notifyNotePublished).not.toHaveBeenCalled();
    expect(notifyNotePublishedToInvestors).not.toHaveBeenCalled();
  });

  it("publishes Note only after listing dates exist and final Prospectus generation succeeds", async () => {
    // Successful finalization artifact.
    prospectusReviewServiceAny.generateFinalProspectusPdfForPublish.mockResolvedValue({
      pdfArtifact: {
        storageBucket: "b",
        storageKey: "k",
        contentType: "application/pdf",
        sizeBytes: 1,
        sha256: "a".repeat(64),
        generatedAt: new Date("2026-07-19T00:00:00.000Z"),
        generationStatus: "READY",
        snapshotHash: "sh",
        pageCount: 3,
      },
      updatedSnapshot: approvedSnapshot,
    });

    const result = await noteService.publish("note-1", actor);
    expect(result).toBeDefined();

    // Listing dates are written in Phase 1 (their upsert happens before finalization).
    expect(prospectusReviewServiceAny.generateFinalProspectusPdfForPublish).toHaveBeenCalledTimes(1);
    expect(prismaAny.note.updateMany).toHaveBeenCalled();

    const finalizeOrder =
      prospectusReviewServiceAny.generateFinalProspectusPdfForPublish.mock.invocationCallOrder[0];

    // Phase 1 writes listing opens/closes (noteListing upsert) before finalization.
    expect(prismaAny.noteListing.upsert).toHaveBeenCalled();
    const listingOrder = prismaAny.noteListing.upsert.mock.invocationCallOrder[0];
    expect(listingOrder).toBeLessThan(finalizeOrder);

    // And ensure Phase 3 publishes after finalization.
    const updateCalls = prismaAny.note.updateMany.mock.calls.map((call: any[], idx: number) => ({
      idx,
      order: prismaAny.note.updateMany.mock.invocationCallOrder[idx],
      data: call?.[0]?.data,
    }));
    const publishedCall = updateCalls.find((c: any) => c.data?.status === NoteStatus.PUBLISHED);
    expect(publishedCall).toBeDefined();
    expect(publishedCall.order).toBeGreaterThan(finalizeOrder);

    expect(notifyNotePublished).toHaveBeenCalled();
    expect(notifyNotePublishedToInvestors).toHaveBeenCalled();
  });
});

