import { sortAdminNoteEvents } from "./admin-note-events-sorting";

describe("admin note events sorting", () => {
  it("orders same-timestamp events deterministically for newest-first", () => {
    const occurredAt = "2026-05-25T00:00:00.000Z";

    const events = [
      {
        id: "b",
        eventType: "NOTE_FUNDING_CLOSED",
        occurredAt,
      },
      {
        id: "a",
        eventType: "DISBURSEMENT_INITIATED",
        occurredAt,
      },
    ];

    const sorted = sortAdminNoteEvents(events, "newest-first");

    expect(sorted.map((e) => e.eventType)).toEqual([
      "DISBURSEMENT_INITIATED",
      "NOTE_FUNDING_CLOSED",
    ]);
  });

  it("places SHORAKA order submitted after disbursement initiated (newest-first)", () => {
    const occurredAt = "2026-05-25T00:00:00.000Z";

    const events = [
      {
        id: "b",
        eventType: "DISBURSEMENT_INITIATED",
        occurredAt,
      },
      {
        id: "a",
        eventType: "SHORAKA_ORDER_SUBMITTED",
        occurredAt,
      },
    ];

    const sorted = sortAdminNoteEvents(events, "newest-first");

    expect(sorted.map((e) => e.eventType)).toEqual([
      "SHORAKA_ORDER_SUBMITTED",
      "DISBURSEMENT_INITIATED",
    ]);
  });

  it("places SHORAKA certificate received before disbursement letter generated (newest-first)", () => {
    const occurredAt = "2026-05-25T00:00:00.000Z";

    const events = [
      {
        id: "b",
        eventType: "DISBURSEMENT_LETTER_GENERATED",
        occurredAt,
      },
      {
        id: "a",
        eventType: "SHORAKA_CERTIFICATE_RECEIVED",
        occurredAt,
      },
    ];

    const sorted = sortAdminNoteEvents(events, "newest-first");

    expect(sorted.map((e) => e.eventType)).toEqual([
      "DISBURSEMENT_LETTER_GENERATED",
      "SHORAKA_CERTIFICATE_RECEIVED",
    ]);
  });

  it("orders same-timestamp events deterministically for oldest-first", () => {
    const occurredAt = "2026-05-25T00:00:00.000Z";

    const events = [
      {
        id: "b",
        eventType: "DISBURSEMENT_INITIATED",
        occurredAt,
      },
      {
        id: "a",
        eventType: "NOTE_FUNDING_CLOSED",
        occurredAt,
      },
    ];

    const sorted = sortAdminNoteEvents(events, "oldest-first");

    expect(sorted.map((e) => e.eventType)).toEqual([
      "NOTE_FUNDING_CLOSED",
      "DISBURSEMENT_INITIATED",
    ]);
  });

  it("falls back to id ordering when timestamp and priority tie", () => {
    const occurredAt = "2026-05-25T00:00:00.000Z";

    const events = [
      { id: "z", eventType: "UNKNOWN_EVENT_TYPE", occurredAt },
      { id: "a", eventType: "UNKNOWN_EVENT_TYPE", occurredAt },
    ];

    const sorted = sortAdminNoteEvents(events, "newest-first");

    expect(sorted.map((e) => e.id)).toEqual(["a", "z"]);
  });
});
