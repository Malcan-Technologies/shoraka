jest.mock("./mapper", () => ({
  ...jest.requireActual<typeof import("./mapper")>("./mapper"),
  mapNoteDetail: jest.fn(() => ({ id: "note-1" })),
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

jest.mock("./audit/writer", () => {
  const actual = jest.requireActual<typeof import("./audit/writer")>("./audit/writer");
  return {
    ...actual,
    writeNoteAuditFromActor: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock("./repository", () => ({
  noteInclude: {},
  noteRepository: {
    findById: jest.fn(),
  },
}));

import {
  NoteFundingStatus,
  NoteListingStatus,
  NoteServicingStatus,
  NoteStatus,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import { parseNoteAuditMetadata } from "./audit/metadata";
import { writeNoteAuditFromActor } from "./audit/writer";
import { noteRepository } from "./repository";
import { NoteService } from "./service";

const adminActor = {
  userId: "admin-1",
  role: "ADMIN",
  portal: "ADMIN",
  ipAddress: "203.0.113.9",
  userAgent: "AdminAgent/1.0",
  correlationId: "corr-pause",
};

function listedNote(overrides: Record<string, unknown> = {}) {
  return {
    id: "note-1",
    status: NoteStatus.PUBLISHED,
    listing_status: NoteListingStatus.PUBLISHED,
    funding_status: NoteFundingStatus.OPEN,
    servicing_status: NoteServicingStatus.CURRENT,
    is_featured: true,
    investments: [{ id: "inv-1" }],
    issuer_organization_id: "issuer-org-1",
    ...overrides,
  };
}

describe("Note campaign pause/resume audit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("writes NOTE_CAMPAIGN_PAUSED with listing/featured axes and does not write NOTE_UNPUBLISHED", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue(listedNote());
    const resultNote = listedNote({
      listing_status: NoteListingStatus.UNPUBLISHED,
      is_featured: false,
    });
    const tx = {
      note: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(resultNote),
      },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (t: typeof tx) => unknown) =>
      fn(tx)
    );

    await new NoteService().pauseListing("note-1", adminActor);

    expect(writeNoteAuditFromActor).toHaveBeenCalledTimes(1);
    const [actor, input, db] = (writeNoteAuditFromActor as jest.Mock).mock.calls[0];
    expect(actor.userId).toBe("admin-1");
    expect(actor.role).toBe("ADMIN");
    expect(db).toBe(tx);
    expect(input.eventType).toBe("NOTE_CAMPAIGN_PAUSED");
    expect(input.targetType).toBe("NOTE");
    expect(input.targetId).toBe("note-1");
    expect(input.noteId).toBe("note-1");
    expect(input.metadata).toEqual({
      previousNoteStatus: NoteStatus.PUBLISHED,
      newNoteStatus: NoteStatus.PUBLISHED,
      previousListingStatus: NoteListingStatus.PUBLISHED,
      newListingStatus: NoteListingStatus.UNPUBLISHED,
      previousFundingStatus: NoteFundingStatus.OPEN,
      newFundingStatus: NoteFundingStatus.OPEN,
      previousServicingStatus: NoteServicingStatus.CURRENT,
      newServicingStatus: NoteServicingStatus.CURRENT,
      previousIsFeatured: true,
      newIsFeatured: false,
    });
  });

  it("does not write audit when the pause predicate misses", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue(listedNote());
    const tx = {
      note: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn(),
      },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (t: typeof tx) => unknown) =>
      fn(tx)
    );

    await expect(new NoteService().pauseListing("note-1", adminActor)).rejects.toBeInstanceOf(AppError);
    expect(writeNoteAuditFromActor).not.toHaveBeenCalled();
    expect(tx.note.update).not.toHaveBeenCalled();
  });

  it("writes NOTE_CAMPAIGN_RESUMED without featured fields and does not write NOTE_PUBLISHED", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue(
      listedNote({ listing_status: NoteListingStatus.UNPUBLISHED, is_featured: false })
    );
    const resultNote = listedNote({ listing_status: NoteListingStatus.PUBLISHED, is_featured: false });
    const tx = {
      note: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(resultNote),
      },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (t: typeof tx) => unknown) =>
      fn(tx)
    );

    await new NoteService().resumeListing("note-1", adminActor);

    expect(writeNoteAuditFromActor).toHaveBeenCalledTimes(1);
    const input = (writeNoteAuditFromActor as jest.Mock).mock.calls[0][1];
    expect(input.eventType).toBe("NOTE_CAMPAIGN_RESUMED");
    expect(input.targetType).toBe("NOTE");
    expect(input.targetId).toBe("note-1");
    expect(input.metadata).toEqual({
      previousNoteStatus: NoteStatus.PUBLISHED,
      newNoteStatus: NoteStatus.PUBLISHED,
      previousListingStatus: NoteListingStatus.UNPUBLISHED,
      newListingStatus: NoteListingStatus.PUBLISHED,
      previousFundingStatus: NoteFundingStatus.OPEN,
      newFundingStatus: NoteFundingStatus.OPEN,
      previousServicingStatus: NoteServicingStatus.CURRENT,
      newServicingStatus: NoteServicingStatus.CURRENT,
    });
    expect(input.metadata).not.toHaveProperty("previousIsFeatured");
    expect(input.metadata).not.toHaveProperty("newIsFeatured");
  });

  it("does not write audit when the resume predicate misses", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue(
      listedNote({ listing_status: NoteListingStatus.UNPUBLISHED })
    );
    const tx = {
      note: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn(),
      },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (t: typeof tx) => unknown) =>
      fn(tx)
    );

    await expect(new NoteService().resumeListing("note-1", adminActor)).rejects.toBeInstanceOf(AppError);
    expect(writeNoteAuditFromActor).not.toHaveBeenCalled();
  });
});

describe("campaign pause/resume metadata schema", () => {
  it("accepts pause featured flags and rejects them on resume", () => {
    expect(
      parseNoteAuditMetadata("NOTE_CAMPAIGN_PAUSED", {
        actorName: "Ada",
        actorEmail: "ada@example.com",
        previousListingStatus: "PUBLISHED",
        newListingStatus: "UNPUBLISHED",
        previousIsFeatured: true,
        newIsFeatured: false,
      })
    ).toMatchObject({ previousIsFeatured: true, newIsFeatured: false });

    const resumed = parseNoteAuditMetadata("NOTE_CAMPAIGN_RESUMED", {
      actorName: "Ada",
      actorEmail: "ada@example.com",
      previousListingStatus: "UNPUBLISHED",
      newListingStatus: "PUBLISHED",
      previousIsFeatured: false,
      newIsFeatured: false,
    });
    expect(resumed).not.toHaveProperty("previousIsFeatured");
    expect(resumed).not.toHaveProperty("newIsFeatured");
  });
});
