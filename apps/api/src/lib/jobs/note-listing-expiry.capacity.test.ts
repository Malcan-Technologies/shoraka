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
    mockCloseFunding.mockResolvedValue({ id: "note-funded", fundingStatus: "FUNDED" });
    mockFailFunding.mockResolvedValue({ id: "note-failed", fundingStatus: "FAILED" });

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
      }),
      { expiredAsOf: expect.any(Date) }
    );
    expect(mockCloseFunding.mock.calls[0][1].portal).toBeUndefined();
    expect(mockFailFunding.mock.calls[0][1].portal).toBeUndefined();
    expect(mockCloseFunding.mock.calls[0][2]).toBeUndefined();
    expect(result.notesAutoFunded).toEqual(["note-funded"]);
    expect(result.notesAutoFailed).toEqual(["note-failed"]);
  });

  it("does not count a date-expiry skip as auto-failed after an extend race", async () => {
    const past = new Date(Date.now() - 60_000);
    (prisma.note.findMany as jest.Mock).mockResolvedValue([
      {
        id: "note-extended",
        target_amount: 100_000,
        funded_amount: 10_000,
        minimum_funding_percent: 80,
        listing: { closes_at: past },
      },
    ]);
    mockFailFunding.mockResolvedValue({ id: "note-extended", fundingStatus: "OPEN" });

    const result = await runNoteListingExpiryJob();

    expect(mockFailFunding).toHaveBeenCalledWith(
      "note-extended",
      expect.any(Object),
      { expiredAsOf: expect.any(Date) }
    );
    expect(result.notesAutoFailed).toEqual([]);
    expect(result.notesAutoFunded).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("still auto-closes a fully funded listing even if the close date moved", async () => {
    const future = new Date(Date.now() + 86_400_000);
    (prisma.note.findMany as jest.Mock).mockResolvedValue([
      {
        id: "note-full",
        target_amount: 100_000,
        funded_amount: 100_000,
        minimum_funding_percent: 80,
        listing: { closes_at: future },
      },
    ]);
    mockCloseFunding.mockResolvedValue({ id: "note-full", fundingStatus: "FUNDED" });

    const result = await runNoteListingExpiryJob();

    expect(mockCloseFunding).toHaveBeenCalledWith("note-full", expect.any(Object));
    expect(mockCloseFunding.mock.calls[0][2]).toBeUndefined();
    expect(result.notesAutoFunded).toEqual(["note-full"]);
  });

  it("does not count a date-expiry skip as auto-funded after an extend race", async () => {
    const past = new Date(Date.now() - 60_000);
    (prisma.note.findMany as jest.Mock).mockResolvedValue([
      {
        id: "note-min-met",
        target_amount: 100_000,
        funded_amount: 90_000,
        minimum_funding_percent: 80,
        listing: { closes_at: past },
      },
    ]);
    mockCloseFunding.mockResolvedValue({ id: "note-min-met", fundingStatus: "OPEN" });

    const result = await runNoteListingExpiryJob();

    expect(mockCloseFunding).toHaveBeenCalledWith(
      "note-min-met",
      expect.any(Object),
      { expiredAsOf: expect.any(Date) }
    );
    expect(result.notesAutoFunded).toEqual([]);
    expect(result.notesAutoFailed).toEqual([]);
  });

  it("counts a zero-funded meets-minimum close as auto-failed", async () => {
    const past = new Date(Date.now() - 60_000);
    (prisma.note.findMany as jest.Mock).mockResolvedValue([
      {
        id: "note-zero",
        target_amount: 100_000,
        funded_amount: 0,
        minimum_funding_percent: 0,
        listing: { closes_at: past },
      },
    ]);
    mockCloseFunding.mockResolvedValue({ id: "note-zero", fundingStatus: "FAILED" });

    const result = await runNoteListingExpiryJob();

    expect(mockCloseFunding).toHaveBeenCalledWith(
      "note-zero",
      expect.any(Object),
      { expiredAsOf: expect.any(Date) }
    );
    expect(mockFailFunding).not.toHaveBeenCalled();
    expect(result.notesAutoFailed).toEqual(["note-zero"]);
    expect(result.notesAutoFunded).toEqual([]);
  });
});
