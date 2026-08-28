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

  it("places SHORAKA order submitted after issuer disbursement created (newest-first)", () => {
    const createdAt = "2026-05-25T00:00:00.000Z";

    const events = [
      {
        id: "b",
        eventType: "ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED",
        createdAt,
      },
      {
        id: "a",
        eventType: "SHORAKA_ORDER_SUBMITTED",
        createdAt,
      },
    ];

    const sorted = sortAdminNoteEvents(events, "newest-first");

    // Later lifecycle step should appear above earlier lifecycle step in newest-first.
    expect(sorted.map((e) => e.eventType)).toEqual([
      "SHORAKA_ORDER_SUBMITTED",
      "ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED",
    ]);
  });

  it("places SHORAKA certificate fetched before withdrawal letter generated (newest-first)", () => {
    const createdAt = "2026-05-25T00:00:00.000Z";

    const events = [
      {
        id: "b",
        eventType: "WITHDRAWAL_LETTER_GENERATED",
        createdAt,
      },
      {
        id: "a",
        eventType: "SHORAKA_CERTIFICATE_FETCHED",
        createdAt,
      },
    ];

    const sorted = sortAdminNoteEvents(events, "newest-first");

    // Newest-first: later lifecycle step should appear above earlier lifecycle step.
    expect(sorted.map((e) => e.eventType)).toEqual(["WITHDRAWAL_LETTER_GENERATED", "SHORAKA_CERTIFICATE_FETCHED"]);
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

  it("orders settlement trustee letter before email at the same timestamp", () => {
    const createdAt = "2026-05-25T00:00:00.000Z";

    const sorted = sortAdminNoteEvents(
      [
        { id: "letter", eventType: "SETTLEMENT_TRUSTEE_LETTER_GENERATED", createdAt },
        { id: "email", eventType: "SETTLEMENT_TRUSTEE_EMAIL_SENT", createdAt },
      ],
      "oldest-first"
    );

    expect(sorted.map((e) => e.id)).toEqual(["letter", "email"]);
  });

  it("orders settlement trustee email before submit and complete at the same timestamp", () => {
    const createdAt = "2026-05-25T00:00:00.000Z";
    const steps = [
      "SETTLEMENT_TRUSTEE_LETTER_GENERATED",
      "SETTLEMENT_TRUSTEE_LETTER_SUBMITTED",
      "SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED",
    ] as const;

    for (const step of steps) {
      const sorted = sortAdminNoteEvents(
        [
          { id: "email", eventType: "SETTLEMENT_TRUSTEE_EMAIL_SENT", createdAt },
          { id: "step", eventType: step, createdAt },
        ],
        "oldest-first"
      );
      if (step === "SETTLEMENT_TRUSTEE_LETTER_GENERATED") {
        expect(sorted.map((e) => e.id)).toEqual(["step", "email"]);
      } else {
        expect(sorted.map((e) => e.id)).toEqual(["email", "step"]);
      }
    }
  });
});

