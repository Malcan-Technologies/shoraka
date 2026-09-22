/**
 * SECTION: Admin campaign extend
 * WHY: Guards, PDF-before-write, and pinned vs marketplace publication behaviour.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NoteFundingStatus, NoteStatus, ProspectusReviewStatus } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";
import { noteService } from "./service";
import { prospectusReviewService } from "./prospectus-review/prospectus-review.service";
import { noteRepository } from "./repository";
import type { ProspectusApprovedSnapshot } from "./prospectus-review/prospectus-approved-snapshot";
import { notifyNoteCampaignExtended } from "../notification/note-lifecycle-notifications";

const approvedSnapshot = {
  publication_id: "pub_old",
  content_version: 3,
  render_fingerprint: "fp",
  calculated_at: "2026-07-19T00:00:00.000Z",
  page_1: {},
  page_2: {},
  publication_content: {},
  note_identity: {},
  html: { page1: "<p>p1</p>", page2: "<p>p2</p>", page3: "<p>p3</p>" },
} as unknown as ProspectusApprovedSnapshot;

const currentOpensAt = new Date("2026-09-11T00:00:00.000Z");
const currentClosesAt = new Date("2026-09-25T00:00:00.000Z");
const newClosesAt = new Date("2026-10-10T00:00:00.000Z");

const publishedNote = {
  id: "note-1",
  status: NoteStatus.PUBLISHED,
  funding_status: NoteFundingStatus.OPEN,
  funded_amount: 10_000,
  target_amount: 100_000,
  maturity_date: null,
  listing: { opens_at: currentOpensAt, closes_at: currentClosesAt },
};

const actor = {
  userId: "admin-1",
  role: "ADMIN" as const,
  portal: "ADMIN" as const,
  correlationId: "corr-1",
};

function sqlText(arg: unknown): string {
  if (Array.isArray(arg)) return arg.join(" ");
  if (arg && typeof arg === "object" && "strings" in arg) {
    const strings = (arg as { strings?: unknown }).strings;
    if (Array.isArray(strings)) return strings.join(" ");
  }
  return String(arg ?? "");
}

function mockLockedRows(options?: {
  fundedAmount?: number;
  targetAmount?: number;
  closesAt?: Date | null;
  status?: NoteStatus;
  fundingStatus?: NoteFundingStatus;
}) {
  const fundedAmount = options?.fundedAmount ?? 10_000;
  const targetAmount = options?.targetAmount ?? 100_000;
  const closesAt = options?.closesAt === undefined ? currentClosesAt : options.closesAt;
  const status = options?.status ?? NoteStatus.PUBLISHED;
  const fundingStatus = options?.fundingStatus ?? NoteFundingStatus.OPEN;
  return jest.fn(async (strings: TemplateStringsArray) => {
    const sql = sqlText(strings);
    if (sql.includes("FROM notes")) {
      return [
        {
          status,
          funding_status: fundingStatus,
          funded_amount: fundedAmount,
          target_amount: targetAmount,
        },
      ];
    }
    if (sql.includes("FROM note_listings")) {
      return closesAt ? [{ closes_at: closesAt }] : [];
    }
    return [];
  });
}

const tx = {
  note: {
    updateMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  noteListing: { updateMany: jest.fn() },
  noteProspectusPublication: { create: jest.fn() },
  noteProspectusReview: { update: jest.fn() },
  noteAdminAction: { create: jest.fn() },
  noteEvent: { create: jest.fn() },
  $queryRaw: mockLockedRows(),
};

jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    noteProspectusReview: { findUnique: jest.fn() },
    noteProspectusPublication: { findUnique: jest.fn() },
    issuerOrganization: { findUnique: jest.fn() },
  },
}));

jest.mock("./repository", () => ({
  noteInclude: {},
  noteRepository: { findById: jest.fn() },
}));

jest.mock("./mapper", () => ({
  mapNoteDetail: jest.fn(async (note: { id: string }) => ({
    id: note.id,
    fundingStatus: "OPEN",
  })),
  mapNoteListItem: jest.fn(
    (note: { id?: string; listing?: { closes_at?: Date | null } | null }) => ({
      id: note.id ?? "note-1",
      listingClosesAt: note.listing?.closes_at ? note.listing.closes_at.toISOString() : null,
    })
  ),
}));

jest.mock("./prospectus-review/prospectus-review.service", () => ({
  prospectusReviewService: {
    generateFinalProspectusPdfForPublish: jest.fn(),
  },
}));

jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

jest.mock("../notification/note-lifecycle-notifications", () => ({
  notifyNoteFundingSucceeded: jest.fn(),
  notifyNoteFundingFailed: jest.fn(),
  notifyNoteCampaignExtended: jest.fn(),
  resolveNoteNotificationTitle: jest.fn(() => "Trade note"),
}));

jest.mock("../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));

const prismaAny = prisma as any;
const generatePdf = prospectusReviewService.generateFinalProspectusPdfForPublish as jest.Mock;

function expectNoAuditRows() {
  expect(tx.noteAdminAction.create).not.toHaveBeenCalled();
  expect(tx.noteEvent.create).not.toHaveBeenCalled();
  expect(notifyNoteCampaignExtended).not.toHaveBeenCalled();
}

function mockPublishedReview() {
  prismaAny.noteProspectusReview.findUnique.mockResolvedValue({
    id: "rev-1",
    status: ProspectusReviewStatus.PUBLISHED,
    content_version: 3,
    approved_publication_id: "pub_old",
    approved_snapshot: approvedSnapshot,
  });
  prismaAny.noteProspectusPublication.findUnique.mockResolvedValue({
    id: "pub_old",
    approved_by_user_id: "admin-1",
    approved_at: new Date("2026-09-10T00:00:00.000Z"),
    published_at: new Date("2026-09-11T00:00:00.000Z"),
  });
}

describe("NoteService.extendListing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (noteRepository.findById as jest.Mock).mockResolvedValue(publishedNote);
    tx.$queryRaw = mockLockedRows();
    tx.note.updateMany.mockResolvedValue({ count: 1 });
    tx.noteListing.updateMany.mockResolvedValue({ count: 1 });
    tx.noteProspectusPublication.create.mockResolvedValue({ id: "pub_new" });
    tx.noteProspectusReview.update.mockResolvedValue({ id: "rev-1" });
    tx.noteAdminAction.create.mockResolvedValue({ id: "action-1" });
    tx.noteEvent.create.mockResolvedValue({ id: "event-1" });
    tx.note.findUniqueOrThrow.mockResolvedValue({
      id: "note-1",
      title: "Trade note",
      note_reference: "NOTE-1",
      issuer_organization_id: "iss-1",
      funding_status: NoteFundingStatus.OPEN,
      listing: { closes_at: newClosesAt },
    });
    generatePdf.mockResolvedValue({
      updatedSnapshot: { ...approvedSnapshot, html: approvedSnapshot.html },
      pdfArtifact: {
        storageBucket: "b",
        storageKey: "k",
        contentType: "application/pdf",
        sizeBytes: 12,
        sha256: "a".repeat(64),
        generatedAt: new Date("2026-09-21T00:00:00.000Z"),
        generationStatus: "READY",
        snapshotHash: "hash-new",
        pageCount: 5,
      },
    });
  });

  it("rejects notes that are not published and open", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue({
      ...publishedNote,
      funding_status: NoteFundingStatus.FAILED,
    });
    await expect(
      noteService.extendListing("note-1", { closesAt: newClosesAt, reason: "Still filling" }, actor)
    ).rejects.toMatchObject({ code: "NOTE_LISTING_NOT_EXTENDABLE", statusCode: 409 });
    expect(generatePdf).not.toHaveBeenCalled();
    expect(prismaAny.$transaction).not.toHaveBeenCalled();
    expectNoAuditRows();
  });

  it("rejects fully funded notes", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue({
      ...publishedNote,
      funded_amount: 100_000,
      target_amount: 100_000,
    });
    await expect(
      noteService.extendListing("note-1", { closesAt: newClosesAt, reason: "Still filling" }, actor)
    ).rejects.toMatchObject({ code: "NOTE_FULLY_FUNDED", statusCode: 409 });
    expect(generatePdf).not.toHaveBeenCalled();
    expectNoAuditRows();
  });

  it("rejects a close that is not strictly later", async () => {
    await expect(
      noteService.extendListing(
        "note-1",
        { closesAt: currentClosesAt, reason: "Still filling" },
        actor
      )
    ).rejects.toMatchObject({ code: "NOTE_LISTING_CLOSE_NOT_LATER", statusCode: 422 });
    expectNoAuditRows();
  });

  it("rejects a close on or after a fixed maturity date", async () => {
    const maturity = new Date("2026-10-01T00:00:00.000Z");
    (noteRepository.findById as jest.Mock).mockResolvedValue({
      ...publishedNote,
      maturity_date: maturity,
    });
    await expect(
      noteService.extendListing(
        "note-1",
        { closesAt: new Date("2026-10-01T00:00:00.000Z"), reason: "Still filling" },
        actor
      )
    ).rejects.toMatchObject({ code: "NOTE_LISTING_CLOSE_AFTER_MATURITY", statusCode: 422 });
    expectNoAuditRows();
  });

  it("rejects a missing reason", async () => {
    await expect(
      noteService.extendListing("note-1", { closesAt: newClosesAt, reason: "   " }, actor)
    ).rejects.toMatchObject({ code: "REASON_REQUIRED", statusCode: 400 });
    expect(generatePdf).not.toHaveBeenCalled();
    expectNoAuditRows();
  });

  it("leaves listing and publications untouched when PDF generation fails", async () => {
    mockPublishedReview();
    generatePdf.mockRejectedValue(new Error("chromium down"));
    await expect(
      noteService.extendListing("note-1", { closesAt: newClosesAt, reason: "Still filling" }, actor)
    ).rejects.toMatchObject({
      code: "PROSPECTUS_FINALIZATION_FAILED",
      statusCode: 500,
      message:
        "Unable to extend the campaign. The updated Prospectus could not be generated. The listing was not changed. Please try again.",
    });
    expect(prismaAny.$transaction).not.toHaveBeenCalled();
    expectNoAuditRows();
  });

  it("maps prospectus AppErrors to extend-specific copy without writing", async () => {
    mockPublishedReview();
    generatePdf.mockRejectedValue(
      new AppError(
        500,
        "PROSPECTUS_PDF_RENDER_FAILED",
        "Unable to publish Note. The final Prospectus could not be generated. The Note was not published. Please try again."
      )
    );
    await expect(
      noteService.extendListing("note-1", { closesAt: newClosesAt, reason: "Still filling" }, actor)
    ).rejects.toMatchObject({
      code: "PROSPECTUS_FINALIZATION_FAILED",
      statusCode: 500,
      message:
        "Unable to extend the campaign. The updated Prospectus could not be generated. The listing was not changed. Please try again.",
    });
    expect(prismaAny.$transaction).not.toHaveBeenCalled();
    expectNoAuditRows();
  });

  it("rejects at persist when the new close elapsed during PDF generation", async () => {
    mockPublishedReview();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-21T00:00:00.000Z"));
    generatePdf.mockImplementation(async () => {
      jest.setSystemTime(new Date("2026-10-11T00:00:00.000Z"));
      return {
        updatedSnapshot: { ...approvedSnapshot, html: approvedSnapshot.html },
        pdfArtifact: {
          storageBucket: "b",
          storageKey: "k",
          contentType: "application/pdf",
          sizeBytes: 12,
          sha256: "a".repeat(64),
          generatedAt: new Date("2026-09-21T00:00:00.000Z"),
          generationStatus: "READY",
          snapshotHash: "hash-new",
          pageCount: 5,
        },
      };
    });
    try {
      await expect(
        noteService.extendListing("note-1", { closesAt: newClosesAt, reason: "Still filling" }, actor)
      ).rejects.toMatchObject({ code: "NOTE_LISTING_CLOSE_NOT_LATER", statusCode: 422 });
      expect(tx.note.updateMany).not.toHaveBeenCalled();
      expect(tx.noteListing.updateMany).not.toHaveBeenCalled();
      expectNoAuditRows();
    } finally {
      jest.useRealTimers();
    }
  });

  it("rejects at persist when the locked note became fully funded during PDF generation", async () => {
    mockPublishedReview();
    tx.$queryRaw = mockLockedRows({ fundedAmount: 100_000, targetAmount: 100_000 });
    await expect(
      noteService.extendListing("note-1", { closesAt: newClosesAt, reason: "Still filling" }, actor)
    ).rejects.toMatchObject({ code: "NOTE_FULLY_FUNDED", statusCode: 409 });
    expect(generatePdf).toHaveBeenCalled();
    expect(tx.note.updateMany).not.toHaveBeenCalled();
    expect(tx.noteListing.updateMany).not.toHaveBeenCalled();
    expectNoAuditRows();
  });

  it("renders the replacement PDF then writes closes_at, a new publication, and the review pointer", async () => {
    mockPublishedReview();
    await noteService.extendListing("note-1", { closesAt: newClosesAt, reason: "Still filling" }, actor);

    expect(generatePdf).toHaveBeenCalledWith(
      expect.objectContaining({
        noteId: "note-1",
        listingDates: { opensAt: currentOpensAt, closesAt: newClosesAt },
      })
    );
    expect(generatePdf.mock.invocationCallOrder[0]).toBeLessThan(
      prismaAny.$transaction.mock.invocationCallOrder[0]
    );
    const lockSql = tx.$queryRaw.mock.calls.map((call: unknown[]) => sqlText(call[0]));
    expect(lockSql[0]).toContain("FROM notes");
    expect(lockSql[0]).toContain("FOR UPDATE");
    expect(lockSql[1]).toContain("FROM note_listings");
    expect(lockSql[1]).toContain("FOR UPDATE");
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.note.updateMany.mock.invocationCallOrder[0]
    );
    expect(tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(
      tx.note.updateMany.mock.invocationCallOrder[0]
    );
    expect(tx.note.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "note-1",
          status: NoteStatus.PUBLISHED,
          funding_status: NoteFundingStatus.OPEN,
        },
      })
    );
    expect(tx.noteListing.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { note_id: "note-1", closes_at: currentClosesAt },
        data: { closes_at: newClosesAt },
      })
    );
    expect(tx.noteProspectusPublication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          published_at: expect.any(Date),
          approved_by_user_id: "admin-1",
          pdf_snapshot_hash: "hash-new",
        }),
      })
    );
    const createdId = tx.noteProspectusPublication.create.mock.calls[0][0].data.id;
    expect(createdId).toMatch(/^pub_/);
    expect(tx.noteProspectusReview.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          approved_publication_id: createdId,
          content_version: 4,
        }),
      })
    );
    expect(tx.noteProspectusPublication.create.mock.calls[0][0].data.id).not.toBe("pub_old");
  });

  it("writes one forensic row and one timeline event after persist in the same transaction", async () => {
    mockPublishedReview();
    await noteService.extendListing("note-1", { closesAt: newClosesAt, reason: "Still filling" }, actor);

    expect(tx.noteAdminAction.create).toHaveBeenCalledTimes(1);
    expect(tx.noteEvent.create).toHaveBeenCalledTimes(1);

    const forensicData = tx.noteAdminAction.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(forensicData).toEqual(
      expect.objectContaining({
        note_id: "note-1",
        action_type: "EXTEND_LISTING",
        actor_user_id: "admin-1",
        actor_type: "ADMIN",
        portal: "ADMIN",
        source: "API",
        correlation_id: "corr-1",
        reason: "Still filling",
        before_state: expect.objectContaining({
          listingClosesAt: currentClosesAt.toISOString(),
        }),
        after_state: expect.objectContaining({
          listingClosesAt: newClosesAt.toISOString(),
        }),
        metadata: expect.objectContaining({
          changedFields: expect.arrayContaining(["listingClosesAt"]),
        }),
      })
    );
    expect(forensicData).not.toHaveProperty("created_at");

    const createdPublicationId = tx.noteProspectusPublication.create.mock.calls[0][0].data.id as string;
    const eventData = tx.noteEvent.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(eventData).toEqual(
      expect.objectContaining({
        note_id: "note-1",
        event_type: "EXTEND_LISTING",
        actor_user_id: "admin-1",
        actor_role: "ADMIN",
        portal: "ADMIN",
        source: "API",
        correlation_id: "corr-1",
        metadata: expect.objectContaining({
          reason: "Still filling",
          previousClosesAt: currentClosesAt.toISOString(),
          newClosesAt: newClosesAt.toISOString(),
          previousPublicationId: "pub_old",
          newPublicationId: createdPublicationId,
          beforeState: expect.objectContaining({
            listingClosesAt: currentClosesAt.toISOString(),
          }),
          afterState: expect.objectContaining({
            listingClosesAt: newClosesAt.toISOString(),
          }),
        }),
      })
    );

    expect(tx.note.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.noteAdminAction.create.mock.invocationCallOrder[0]
    );
    expect(tx.noteListing.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.noteAdminAction.create.mock.invocationCallOrder[0]
    );
    expect(tx.noteProspectusPublication.create.mock.invocationCallOrder[0]).toBeLessThan(
      tx.noteAdminAction.create.mock.invocationCallOrder[0]
    );
    expect(tx.noteProspectusReview.update.mock.invocationCallOrder[0]).toBeLessThan(
      tx.noteAdminAction.create.mock.invocationCallOrder[0]
    );
    expect(tx.noteAdminAction.create.mock.invocationCallOrder[0]).toBeLessThan(
      tx.noteEvent.create.mock.invocationCallOrder[0]
    );
    expect(notifyNoteCampaignExtended).toHaveBeenCalledTimes(1);
    expect(notifyNoteCampaignExtended).toHaveBeenCalledWith({
      notificationService: expect.anything(),
      noteId: "note-1",
      issuerOrganizationId: "iss-1",
      noteTitle: "Trade note",
      closesAt: newClosesAt,
    });
  });
});

describe("listing expiry expiredAsOf guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(noteService as any, "logAdminAction").mockResolvedValue(undefined);
  });

  function expiryTx(options?: {
    fundedAmount?: number;
    closesAt?: Date;
    updateMany?: jest.Mock;
  }) {
    const updateMany = options?.updateMany ?? jest.fn();
    const inner = {
      ...tx,
      $queryRaw: mockLockedRows({
        fundedAmount: options?.fundedAmount ?? 90_000,
        targetAmount: 100_000,
        closesAt: options?.closesAt ?? new Date(Date.now() + 86_400_000),
      }),
      note: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "note-1",
          funding_status: NoteFundingStatus.OPEN,
        }),
        updateMany,
      },
      noteInvestment: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
      },
    };
    prismaAny.$transaction.mockImplementation(async (cb: (t: typeof inner) => unknown) =>
      cb(inner)
    );
    return inner;
  }

  it("serializes extend and expiry on note then listing FOR UPDATE locks", () => {
    const source = readFileSync(join(__dirname, "./service.ts"), "utf8");
    expect(source).toContain(
      "SELECT status, funding_status, funded_amount, target_amount FROM notes WHERE id = ${noteId} FOR UPDATE"
    );
    expect(source).toContain(
      "SELECT closes_at FROM note_listings WHERE note_id = ${noteId} FOR UPDATE"
    );
    const helperIdx = source.indexOf("async function lockNoteAndListingForUpdate");
    const skipIdx = source.indexOf("async function shouldSkipListingExpiryAction");
    const extendIdx = source.indexOf("async extendListing");
    const closeIdx = source.indexOf("async closeFunding");
    const failIdx = source.indexOf("async failFunding");
    expect(source.slice(skipIdx, extendIdx)).toContain("lockNoteAndListingForUpdate(tx,");
    expect(source.slice(extendIdx, closeIdx)).toContain("lockNoteAndListingForUpdate(tx,");
    expect(source.slice(closeIdx, failIdx)).toContain("shouldSkipListingExpiryAction");
    expect(source.slice(failIdx, failIdx + 2_000)).toContain("shouldSkipListingExpiryAction");
    expect(helperIdx).toBeGreaterThan(-1);
    expect(helperIdx).toBeLessThan(skipIdx);
  });

  it("no-ops closeFunding when a locked listing close moved into the future", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue({
      ...publishedNote,
      funded_amount: 90_000,
      minimum_funding_percent: 80,
      source_contract_id: null,
    });
    const inner = expiryTx();

    const result = await noteService.closeFunding("note-1", actor, {
      expiredAsOf: new Date(),
    });
    expect(result).toEqual({ id: "note-1", fundingStatus: "OPEN" });
    expect(inner.note.updateMany).not.toHaveBeenCalled();
    const lockSql = inner.$queryRaw.mock.calls.map((call: unknown[]) => sqlText(call[0]));
    expect(lockSql[0]).toContain("FROM notes");
    expect(lockSql[0]).toContain("FOR UPDATE");
    expect(lockSql[1]).toContain("FROM note_listings");
    expect(lockSql[1]).toContain("FOR UPDATE");
  });

  it("no-ops failFunding when a locked listing close moved into the future", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue({
      ...publishedNote,
      funded_amount: 10_000,
      minimum_funding_percent: 80,
      source_contract_id: null,
    });
    const inner = expiryTx({ fundedAmount: 10_000 });

    const result = await noteService.failFunding("note-1", actor, {
      expiredAsOf: new Date(),
    });
    expect(result).toEqual({ id: "note-1", fundingStatus: "OPEN" });
    expect(inner.note.updateMany).not.toHaveBeenCalled();
  });

  it("still closes a fully funded listing after waiting on the listing lock", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue({
      ...publishedNote,
      funded_amount: 100_000,
      target_amount: 100_000,
      minimum_funding_percent: 80,
      source_contract_id: null,
    });
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    expiryTx({
      fundedAmount: 100_000,
      closesAt: new Date(Date.now() + 86_400_000),
      updateMany,
    });

    await expect(
      noteService.closeFunding("note-1", actor, { expiredAsOf: new Date() })
    ).rejects.toMatchObject({ code: "NOTE_FUNDING_NOT_OPEN" });
    expect(updateMany).toHaveBeenCalled();
  });

  it("proceeds with expiry close when the locked listing is still expired", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue({
      ...publishedNote,
      funded_amount: 90_000,
      minimum_funding_percent: 80,
      source_contract_id: null,
    });
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    expiryTx({
      fundedAmount: 90_000,
      closesAt: new Date(Date.now() - 60_000),
      updateMany,
    });

    await expect(
      noteService.closeFunding("note-1", actor, { expiredAsOf: new Date() })
    ).rejects.toMatchObject({ code: "NOTE_FUNDING_NOT_OPEN" });
    expect(updateMany).toHaveBeenCalled();
  });
});
