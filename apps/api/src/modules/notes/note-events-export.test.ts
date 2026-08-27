/**
 * PASS A.5 — note history export completeness.
 *
 * noteInclude.events caps the note-detail timeline at take:50 for UI performance;
 * the compliance/audit export must return the COMPLETE event history independently.
 */
jest.mock("./mapper", () => ({
  ...jest.requireActual<typeof import("./mapper")>("./mapper"),
  mapNoteDetail: jest.fn(() => ({ id: "note-1" })),
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

jest.mock("../../lib/user-display-name", () => ({
  loadUserDisplayNameMap: jest.fn(async () => new Map()),
}));

jest.mock("./repository", () => ({
  noteInclude: { events: { orderBy: { created_at: "desc" }, take: 50 } },
  noteRepository: {
    findById: jest.fn(),
    findAllEventsByNoteId: jest.fn(),
  },
}));

jest.mock("../notification/note-lifecycle-notifications", () => {
  const actual =
    jest.requireActual<typeof import("../notification/note-lifecycle-notifications")>(
      "../notification/note-lifecycle-notifications"
    );
  return {
    ...actual,
    notifyNotePaymentReceived: jest.fn().mockResolvedValue(undefined),
    notifyNoteSettlementPosted: jest.fn().mockResolvedValue(undefined),
    notifyNoteIssuerRepaid: jest.fn().mockResolvedValue(undefined),
  };
});

import { noteInclude, noteRepository } from "./repository";
import { NoteService } from "./service";

function makeEvent(id: string, eventType: string, createdAt: Date) {
  return {
    id,
    note_id: "note-1",
    event_type: eventType,
    actor_user_id: null,
    actor_role: null,
    portal: null,
    ip_address: null,
    user_agent: null,
    correlation_id: null,
    metadata: null,
    created_at: createdAt,
    actor_type: null,
    target_type: null,
    target_id: null,
    source: null,
  };
}

describe("NoteService.listEvents — full unlimited event history", () => {
  const service = new NoteService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("the note-detail timeline include still caps at 50 (UI performance preserved)", () => {
    expect(noteInclude.events.take).toBe(50);
  });

  it("returns more than 50 events when the repository has more than 50 (no silent truncation)", async () => {
    const base = new Date("2026-01-01T00:00:00.000Z").getTime();
    const events = Array.from({ length: 75 }, (_, i) =>
      makeEvent(`evt-${i}`, "PAYMENT_RECEIVED", new Date(base + i * 1000))
    );

    (noteRepository.findById as jest.Mock).mockResolvedValue({ id: "note-1" });
    (noteRepository.findAllEventsByNoteId as jest.Mock).mockResolvedValue(events);

    const result = await service.listEvents("note-1");

    expect(result).toHaveLength(75);
    expect(noteRepository.findAllEventsByNoteId).toHaveBeenCalledWith("note-1");
  });

  it("orders events newest-first, matching the timeline's deterministic ordering", async () => {
    const oldest = makeEvent("evt-old", "NOTE_CREATED_FROM_INVOICE", new Date("2026-01-01T00:00:00Z"));
    const middle = makeEvent("evt-mid", "PUBLISH", new Date("2026-01-02T00:00:00Z"));
    const newest = makeEvent("evt-new", "PAYMENT_RECEIVED", new Date("2026-01-03T00:00:00Z"));

    (noteRepository.findById as jest.Mock).mockResolvedValue({ id: "note-1" });
    (noteRepository.findAllEventsByNoteId as jest.Mock).mockResolvedValue([
      oldest,
      newest,
      middle,
    ]);

    const result = await service.listEvents("note-1");

    expect(result.map((e) => e.id)).toEqual(["evt-new", "evt-mid", "evt-old"]);
  });

  it("throws NOTE_NOT_FOUND when the note does not exist, without querying events", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue(null);

    await expect(service.listEvents("missing")).rejects.toMatchObject({
      code: "NOTE_NOT_FOUND",
    });
    expect(noteRepository.findAllEventsByNoteId).not.toHaveBeenCalled();
  });
});
