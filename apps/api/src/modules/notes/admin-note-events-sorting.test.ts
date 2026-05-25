import { sortAdminNoteEvents } from "./admin-note-events-sorting";

describe("admin note events sorting", () => {
  it("orders same-timestamp events deterministically for newest-first", () => {
    const createdAt = "2026-05-25T00:00:00.000Z";

    const events = [
      {
        id: "b",
        eventType: "CLOSE_FUNDING",
        createdAt,
      },
      {
        id: "a",
        eventType: "ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED",
        createdAt,
      },
    ];

    const sorted = sortAdminNoteEvents(events, "newest-first");

    // Later lifecycle event should appear above earlier lifecycle event.
    expect(sorted.map((e) => e.eventType)).toEqual([
      "ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED",
      "CLOSE_FUNDING",
    ]);
  });

  it("orders same-timestamp events deterministically for oldest-first", () => {
    const createdAt = "2026-05-25T00:00:00.000Z";

    const events = [
      {
        id: "b",
        eventType: "ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED",
        createdAt,
      },
      {
        id: "a",
        eventType: "CLOSE_FUNDING",
        createdAt,
      },
    ];

    const sorted = sortAdminNoteEvents(events, "oldest-first");

    expect(sorted.map((e) => e.eventType)).toEqual([
      "CLOSE_FUNDING",
      "ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED",
    ]);
  });

  it("falls back to id ordering when timestamp and priority tie", () => {
    const createdAt = "2026-05-25T00:00:00.000Z";

    const events = [
      { id: "z", eventType: "UNKNOWN_EVENT_TYPE", createdAt },
      { id: "a", eventType: "UNKNOWN_EVENT_TYPE", createdAt },
    ];

    const sorted = sortAdminNoteEvents(events, "newest-first");

    expect(sorted.map((e) => e.id)).toEqual(["a", "z"]);
  });
});

