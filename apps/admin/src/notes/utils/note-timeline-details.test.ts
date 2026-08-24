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

  it("shows resend metadata as Resent instead of Yes", () => {
    const { compact } = extractNoteTimelineDetails(
      event({
        eventType: "WITHDRAWAL_TRUSTEE_EMAIL_SENT",
        metadata: { withdrawalId: "wd-1", messageId: "ses-2", resend: true },
      })
    );
    expect(compact).toEqual(
      expect.arrayContaining([{ key: "resend", label: "Resend", value: "Resent" }])
    );
    expect(compact.find((row) => row.key === "resend")?.value).not.toBe("Yes");
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
});

describe("noteDocumentFileName", () => {
  it("uses the last path segment", () => {
    expect(noteDocumentFileName("note-letters/cmp2/default-1778595324212.pdf")).toBe(
      "default-1778595324212.pdf"
    );
  });
});
