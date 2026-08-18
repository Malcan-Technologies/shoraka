import { buildNoteActivityCsv, formatNoteActivityEventLabel } from "./note-activity-csv";
import type { NoteAuditLogDto } from "@cashsouk/types";

function event(overrides: Partial<NoteAuditLogDto> = {}): NoteAuditLogDto {
  return {
    id: "evt-1",
    noteId: "note-1",
    eventType: "NOTE_PUBLISHED",
    occurredAt: "2026-08-18T09:00:00.000Z",
    createdAt: "2026-08-18T09:00:00.000Z",
    actor: {
      type: "USER",
      userId: "user-1",
      displayName: "Ada Admin",
      email: "ada@example.com",
    },
    organizationId: null,
    organizationKind: null,
    target: { type: "NOTE", id: "note-1" },
    source: "admin",
    portal: "admin",
    ipAddress: null,
    userAgent: null,
    correlationId: "corr-1",
    metadata: { listingId: "lst-1" },
    ...overrides,
  };
}

describe("formatNoteActivityEventLabel", () => {
  it("maps known types and rewrites Shoraka to Tawarruq", () => {
    expect(formatNoteActivityEventLabel("NOTE_PUBLISHED")).toBe("Published to marketplace");
    expect(formatNoteActivityEventLabel("NOTE_CAMPAIGN_PAUSED")).toBe("Campaign paused");
    expect(formatNoteActivityEventLabel("FAIL_FUNDING")).toBe("Funding failed");
    expect(formatNoteActivityEventLabel("PROSPECTUS_REVIEW_APPROVE")).toBe("Prospectus approved");
    expect(formatNoteActivityEventLabel("PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH")).toBe(
      "Prospectus approval cleared after unpublish"
    );
    expect(formatNoteActivityEventLabel("SHORAKA_ORDER_SUBMITTED")).toBe(
      "Tawarruq order submitted"
    );
    expect(formatNoteActivityEventLabel("DEFAULT_NOTICE_GENERATED")).toBe("Default notice generated");
    expect(formatNoteActivityEventLabel("CUSTOM_EVENT_TYPE")).toBe("Custom Event Type");
  });
});

describe("buildNoteActivityCsv", () => {
  it("quotes cells and serialises metadata", () => {
    const csv = buildNoteActivityCsv([
      event({
        eventType: "NOTE_CREATED",
        metadata: { message: "Issuer said ready" },
      }),
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("occurredAt");
    expect(lines[0]).toContain("event");
    expect(lines[1]).toContain("Note created");
    expect(lines[1]).toContain("NOTE_CREATED");
    expect(lines[1]).toContain("Issuer said ready");
  });

  it("exports an empty table with only the header", () => {
    expect(buildNoteActivityCsv([]).split("\n")).toHaveLength(1);
  });
});
