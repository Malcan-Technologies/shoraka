jest.mock("../prisma", () => ({
  prisma: {
    note: { findMany: jest.fn() },
  },
}));

const mockCloseFunding = jest.fn();
const mockFailFunding = jest.fn();

jest.mock("../../modules/notes/service", () => ({
  noteService: {
    closeFunding: (...args: unknown[]) => mockCloseFunding(...args),
    failFunding: (...args: unknown[]) => mockFailFunding(...args),
  },
}));

import { prisma } from "../prisma";
import { runNoteListingExpiryJob } from "./note-listing-expiry";

describe("note listing expiry capacity routing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("closes funded listings and fails expired under-minimum listings", async () => {
    const past = new Date(Date.now() - 60_000);
    (prisma.note.findMany as jest.Mock).mockResolvedValue([
      {
        id: "note-funded",
        target_amount: 100_000,
        funded_amount: 100_000,
        minimum_funding_percent: 80,
        listing: { closes_at: past },
      },
      {
        id: "note-failed",
        target_amount: 100_000,
        funded_amount: 10_000,
        minimum_funding_percent: 80,
        listing: { closes_at: past },
      },
    ]);

    const result = await runNoteListingExpiryJob();

    expect(mockCloseFunding).toHaveBeenCalledWith(
      "note-funded",
      expect.objectContaining({
        userId: "SYS",
        correlationId: "cron:note-listing-expiry",
        auditContext: expect.objectContaining({
          actorType: "SYSTEM",
          source: "SYSTEM_JOB",
          actorUserId: "SYS",
          correlationId: "cron:note-listing-expiry",
        }),
      })
    );
    expect(mockFailFunding).toHaveBeenCalledWith(
      "note-failed",
      expect.objectContaining({
        userId: "SYS",
        auditContext: expect.objectContaining({
          actorType: "SYSTEM",
          source: "SYSTEM_JOB",
        }),
      })
    );
    expect(mockCloseFunding.mock.calls[0][1].portal).toBeUndefined();
    expect(mockFailFunding.mock.calls[0][1].portal).toBeUndefined();
    expect(result.notesAutoFunded).toEqual(["note-funded"]);
    expect(result.notesAutoFailed).toEqual(["note-failed"]);
  });
});
