import type { NoteAuditLogDto } from "@cashsouk/types";
import {
  extractNoteTimelineDetails,
  noteDocumentFileName,
} from "./note-timeline-details";

function event(overrides: Partial<NoteAuditLogDto> = {}): NoteAuditLogDto {
  return {
    id: "evt-1",
    noteId: "note-1",
    eventType: "NOTE_PUBLISHED",
    occurredAt: "2026-05-12T14:15:42.000Z",
    createdAt: "2026-05-12T14:15:42.000Z",
    actor: {
      type: "ADMIN",
      userId: "user-1",
      displayName: "Ada Admin",
      email: "ada@example.com",
    },
    organizationId: "org-1",
    organizationKind: "ISSUER",
    target: { type: "NOTE", id: "note-1" },
    source: "admin",
    portal: "admin",
    ipAddress: null,
    userAgent: null,
    correlationId: "corr-1",
    metadata: {},
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

  it("curates servicing-status change fields from NoteAuditLog metadata", () => {
    const { compact, prose } = extractNoteTimelineDetails(
      event({
        eventType: "NOTE_SERVICING_STATUS_CHANGED",
        metadata: {
          previousServicingStatus: "CURRENT",
          newServicingStatus: "LATE",
          previousNoteStatus: "ACTIVE",
          newNoteStatus: "ACTIVE",
          reasonCode: "OVERDUE",
        },
      })
    );

    expect(compact).toEqual(
      expect.arrayContaining([
        { key: "previousServicingStatus", label: "Previous Servicing Status", value: "Current" },
        { key: "newServicingStatus", label: "New Servicing Status", value: "Late" },
        { key: "reasonCode", label: "Reason Code", value: "Overdue" },
      ])
    );
    expect(prose).toEqual([]);
  });

  it("hides s3 keys from generic events", () => {
    const { compact, prose } = extractNoteTimelineDetails(
      event({
        eventType: "DEFAULT_NOTICE_GENERATED",
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
