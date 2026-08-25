import { buildNoteActivityCsv, formatNoteActivityEventLabel } from "./note-activity-csv";
import type { NoteEvent } from "@cashsouk/types";

function event(overrides: Partial<NoteEvent> = {}): NoteEvent {
  return {
    id: "evt-1",
    noteId: "note-1",
    eventType: "NOTE_PUBLISHED",
    actorUserId: "user-1",
    actorName: "Ada Admin",
    actorRole: "ADMIN",
    portal: "admin",
    correlationId: "corr-1",
    metadata: { listingId: "lst-1" },
    createdAt: "2026-08-18T09:00:00.000Z",
    ...overrides,
  };
}

describe("formatNoteActivityEventLabel", () => {
  it("maps known types and rewrites Shoraka to Tawarruq", () => {
    expect(formatNoteActivityEventLabel("NOTE_PUBLISHED")).toBe("Note Published");
    expect(formatNoteActivityEventLabel("PAUSE_LISTING")).toBe("Campaign paused");
    expect(formatNoteActivityEventLabel("FAIL_FUNDING")).toBe("Funding unsuccessful");
    expect(formatNoteActivityEventLabel("PROSPECTUS_REVIEW_APPROVE")).toBe("Prospectus approved");
    expect(formatNoteActivityEventLabel("PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH")).toBe(
      "Prospectus approval cleared after unpublish"
    );
    expect(formatNoteActivityEventLabel("SHORAKA_ORDER_SUBMITTED")).toBe(
      "Tawarruq Order Submitted"
    );
    expect(formatNoteActivityEventLabel("WITHDRAWAL_TRUSTEE_EMAIL_SENT")).toBe(
      "Withdrawal Trustee Email Sent"
    );
    expect(formatNoteActivityEventLabel("SERVICE_FEE_TRUSTEE_EMAIL_SENT")).toBe(
      "Settlement Trustee Email Sent"
    );
    expect(formatNoteActivityEventLabel("CUSTOM_EVENT_TYPE")).toBe("Custom Event Type");
    expect(
      formatNoteActivityEventLabel("WITHDRAWAL_TRUSTEE_EMAIL_SENT", { resend: true })
    ).toBe("Withdrawal Trustee Email Redelivered");
    expect(
      formatNoteActivityEventLabel("SERVICE_FEE_TRUSTEE_EMAIL_SENT", { resend: true })
    ).toBe("Settlement Trustee Email Redelivered");
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
    expect(lines[0]).toContain("createdAt");
    expect(lines[0]).toContain("event");
    expect(lines[0]).toContain("actor");
    expect(lines[1]).toContain("Note created");
    expect(lines[1]).toContain("NOTE_CREATED");
    expect(lines[1]).toContain("Issuer said ready");
    expect(lines[1]).toContain("Ada Admin");
  });

  it("exports an empty table with only the header", () => {
    expect(buildNoteActivityCsv([]).split("\n")).toHaveLength(1);
  });

  it("exports trustee-email delivery and redelivery labels with forensic metadata", () => {
    const csv = buildNoteActivityCsv([
      event({
        eventType: "WITHDRAWAL_TRUSTEE_EMAIL_SENT",
        metadata: { withdrawalId: "wd-1", messageId: "ses-1" },
      }),
      event({
        id: "evt-2",
        eventType: "SERVICE_FEE_TRUSTEE_EMAIL_SENT",
        metadata: { settlementId: "set-1", messageId: "ses-2", resend: true },
      }),
    ]);
    expect(csv).toContain("Withdrawal Trustee Email Sent");
    expect(csv).toContain("WITHDRAWAL_TRUSTEE_EMAIL_SENT");
    expect(csv).toContain("wd-1");
    expect(csv).toContain("Settlement Trustee Email Redelivered");
    expect(csv).toContain("SERVICE_FEE_TRUSTEE_EMAIL_SENT");
    expect(csv).toContain("set-1");
    expect(csv).toContain("ses-2");
  });

  it("keeps the internal withdrawal id and includes the display reference", () => {
    expect(formatNoteActivityEventLabel("WITHDRAWAL_SUBMITTED_TO_TRUSTEE")).toBe(
      "Withdrawal Submitted to Trustee"
    );
    const csv = buildNoteActivityCsv([
      event({
        eventType: "WITHDRAWAL_SUBMITTED_TO_TRUSTEE",
        metadata: {
          withdrawalId: "clyk2n9x0001qwertyuiop",
          withdrawalReference: "WDL-ARF-202608-A1Z",
        },
      }),
    ]);
    expect(csv).toContain("Withdrawal Submitted to Trustee");
    expect(csv).toContain("clyk2n9x0001qwertyuiop");
    expect(csv).toContain("WDL-ARF-202608-A1Z");
  });
});
