import type { NoteEvent } from "@cashsouk/types";
import {
  extractNoteTimelineDetails,
  noteDocumentFileName,
} from "./note-timeline-details";

function event(overrides: Partial<NoteEvent> = {}): NoteEvent {
  return {
    id: "evt-1",
    noteId: "note-1",
    eventType: "NOTE_PUBLISHED",
    actorUserId: "user-1",
    actorName: null,
    actorRole: "ADMIN",
    portal: "ADMIN",
    correlationId: "corr-1",
    metadata: null,
    createdAt: "2026-05-12T14:15:42.000Z",
    ...overrides,
  };
}

describe("extractNoteTimelineDetails", () => {
  it("curates overdue-check fields and drops calculator noise", () => {
    const { compact, prose } = extractNoteTimelineDetails(
      event({
        eventType: "OVERDUE_LATE_CHARGE_CHECKED",
        metadata: {
          overdue: false,
          dueDate: "2026-09-09T00:00:00.000Z",
          checkDate: "2026-05-12T14:15:42.000Z",
          daysLate: 0,
          receiptAmount: 1000,
          totalTawidhCap: 12,
          message: "Payment is not overdue after the grace period.",
        },
      })
    );

    expect(compact).toEqual([
      { key: "dueDate", label: "Due date", value: "09 Sep 2026" },
      { key: "overdue", label: "Overdue", value: "No" },
      { key: "daysLate", label: "Days late", value: "0" },
      { key: "checkDate", label: "Checked", value: expect.stringMatching(/12 May 2026/) },
    ]);
    expect(prose).toEqual([
      {
        key: "message",
        label: "Message",
        value: "Payment is not overdue after the grace period.",
      },
    ]);
  });

  it("shows trustee-email resend metadata as Redelivered instead of Yes", () => {
    const withdrawal = extractNoteTimelineDetails(
      event({
        eventType: "WITHDRAWAL_TRUSTEE_EMAIL_SENT",
        metadata: {
          withdrawalId: "wd-1",
          withdrawalReference: "WD-1",
          messageId: "ses-2",
          resend: true,
        },
      })
    );
    expect(withdrawal.compact).toEqual(
      expect.arrayContaining([
        { key: "withdrawalId", label: "Withdrawal Id", value: "wd-1" },
        { key: "withdrawalReference", label: "Withdrawal Reference", value: "WD-1" },
        { key: "messageId", label: "Message Id", value: "ses-2" },
        { key: "resend", label: "Redelivery", value: "Redelivered" },
      ])
    );
    expect(withdrawal.compact.find((row) => row.key === "resend")?.value).not.toBe("Yes");

    const historicalWithdrawal = extractNoteTimelineDetails(
      event({
        eventType: "WITHDRAWAL_TRUSTEE_EMAIL_SENT",
        metadata: { withdrawalId: "wd-old", messageId: "ses-old" },
      })
    );
    expect(historicalWithdrawal.compact).toEqual([
      { key: "withdrawalId", label: "Withdrawal Id", value: "wd-old" },
      { key: "messageId", label: "Message Id", value: "ses-old" },
    ]);

    const settlement = extractNoteTimelineDetails(
      event({
        eventType: "SETTLEMENT_TRUSTEE_EMAIL_SENT",
        metadata: { settlementId: "set-1", settlementReference: "STL-1", messageId: "ses-3" },
      })
    );
    expect(settlement.compact).toEqual([
      { key: "settlementId", label: "Settlement Id", value: "set-1" },
      { key: "settlementReference", label: "Settlement Reference", value: "STL-1" },
      { key: "messageId", label: "Message Id", value: "ses-3" },
    ]);

    const legacySettlement = extractNoteTimelineDetails(
      event({
        eventType: "SERVICE_FEE_TRUSTEE_EMAIL_SENT",
        metadata: { settlementId: "set-legacy", messageId: "ses-legacy", resend: true },
      })
    );
    expect(legacySettlement.compact).toEqual(
      expect.arrayContaining([
        { key: "settlementId", label: "Settlement Id", value: "set-legacy" },
        { key: "messageId", label: "Message Id", value: "ses-legacy" },
        { key: "resend", label: "Redelivery", value: "Redelivered" },
      ])
    );
    expect(legacySettlement.compact.find((row) => row.key === "settlementReference")).toBeUndefined();
  });

  it("preserves settlement trustee letter metadata for live and legacy generated IDs", () => {
    const live = extractNoteTimelineDetails(
      event({
        eventType: "SETTLEMENT_TRUSTEE_LETTER_GENERATED",
        metadata: { settlementId: "set-1", s3Key: "note-letters/n1/letter.pdf" },
      })
    );
    const legacy = extractNoteTimelineDetails(
      event({
        eventType: "SERVICE_FEE_TRUSTEE_LETTER_GENERATED",
        metadata: { settlementId: "set-legacy", s3Key: "note-letters/n1/legacy.pdf" },
      })
    );
    expect(live.compact).toEqual([{ key: "settlementId", label: "Settlement Id", value: "set-1" }]);
    expect(legacy.compact).toEqual([
      { key: "settlementId", label: "Settlement Id", value: "set-legacy" },
    ]);
    expect(live.compact.find((row) => row.key === "s3Key")).toBeUndefined();
    expect(legacy.compact.find((row) => row.key === "s3Key")).toBeUndefined();
  });

  it("builds an activation sentence with the actor and note title", () => {
    const { compact, prose } = extractNoteTimelineDetails(
      event({ eventType: "ACTIVATE", actorName: "Jane Admin" }),
      "Acme Note 1"
    );

    expect(compact).toEqual([]);
    expect(prose).toEqual([
      {
        key: "message",
        label: "Message",
        value: "Jane Admin activated Acme Note 1. Servicing has started.",
      },
    ]);
  });

  it("falls back to generic actor/note wording when unavailable", () => {
    const { prose } = extractNoteTimelineDetails(event({ eventType: "ACTIVATE" }));

    expect(prose).toEqual([
      {
        key: "message",
        label: "Message",
        value: "An admin activated the note. Servicing has started.",
      },
    ]);
  });

  it("hides s3 keys from generic events", () => {
    const { compact, prose } = extractNoteTimelineDetails(
      event({
        eventType: "DEFAULT_LETTER_GENERATED",
        metadata: { s3Key: "note-letters/abc/default-1.pdf" },
      })
    );
    expect(compact).toEqual([]);
    expect(prose).toEqual([]);
  });

  it("shows withdrawal id and display reference for trustee submission", () => {
    const { compact, prose } = extractNoteTimelineDetails(
      event({
        eventType: "WITHDRAWAL_SUBMITTED_TO_TRUSTEE",
        metadata: {
          withdrawalId: "clyk2n9x0001qwertyuiop",
          withdrawalReference: "WDL-ARF-202608-A1Z",
        },
      })
    );
    expect(compact).toEqual([
      { key: "withdrawalId", label: "Withdrawal Id", value: "clyk2n9x0001qwertyuiop" },
      { key: "withdrawalReference", label: "Withdrawal Reference", value: "WDL-ARF-202608-A1Z" },
    ]);
    expect(prose).toEqual([]);
  });
});

describe("noteDocumentFileName", () => {
  it("uses the last path segment", () => {
    expect(noteDocumentFileName("note-letters/cmp2/default-1778595324212.pdf")).toBe(
      "default-1778595324212.pdf"
    );
  });
});
