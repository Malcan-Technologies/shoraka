import {
  deriveNoteStatus,
  noteToneToStatusToken,
  NOTE_STATUS_BADGE_TONE_CLASS,
  presentNoteStatusForViewer,
  type NoteStatusInput,
} from "./note-status-badge";

const baseInput: NoteStatusInput = {
  status: "DRAFT",
  listingStatus: "NOT_LISTED",
  fundingStatus: "NOT_OPEN",
  servicingStatus: "CURRENT",
  fundingPercent: 0,
  minimumFundingPercent: 80,
  hasPostedSettlement: false,
  pendingResidual: false,
  settlementTrusteePending: false,
  pendingDisbursement: false,
};

describe("noteToneToStatusToken", () => {
  it("maps draft and progress to grey/blue not yellow/indigo", () => {
    expect(noteToneToStatusToken("draft")).toBe("neutral");
    expect(noteToneToStatusToken("progress")).toBe("submitted");
    expect(noteToneToStatusToken("info")).toBe("submitted");
    expect(noteToneToStatusToken("warning")).toBe("action");
    expect(noteToneToStatusToken("active")).toBe("active");
    expect(noteToneToStatusToken("success")).toBe("success");
    expect(noteToneToStatusToken("destructive")).toBe("rejected");
  });
});

describe("NOTE_STATUS_BADGE_TONE_CLASS", () => {
  it("uses grey for draft and blue for progress", () => {
    expect(NOTE_STATUS_BADGE_TONE_CLASS.draft).toContain("bg-status-neutral-bg");
    expect(NOTE_STATUS_BADGE_TONE_CLASS.progress).toContain("bg-status-submitted-bg");
    expect(NOTE_STATUS_BADGE_TONE_CLASS.progress).not.toContain("in-progress");
  });
});

describe("deriveNoteStatus", () => {
  it("paints draft grey", () => {
    const derived = deriveNoteStatus(baseInput);
    expect(derived.label).toBe("Draft");
    expect(derived.tone).toBe("draft");
    expect(noteToneToStatusToken(derived.tone)).toBe("neutral");
  });

  it("paints awaiting disbursement blue", () => {
    const derived = deriveNoteStatus({ ...baseInput, status: "FUNDING", fundingStatus: "FUNDED" });
    expect(derived.label).toBe("Awaiting disbursement");
    expect(derived.tone).toBe("info");
  });

  it("paints funding open as progress (blue token)", () => {
    const derived = deriveNoteStatus({
      ...baseInput,
      status: "PUBLISHED",
      listingStatus: "PUBLISHED",
      fundingStatus: "OPEN",
      fundingPercent: 40,
    });
    expect(derived.label).toBe("Funding open");
    expect(derived.tone).toBe("progress");
    expect(noteToneToStatusToken(derived.tone)).toBe("submitted");
  });
});

describe("presentNoteStatusForViewer", () => {
  it("paints Active · partial yellow for issuer and blue for investor", () => {
    const derived = deriveNoteStatus({
      ...baseInput,
      status: "ACTIVE",
      servicingStatus: "PARTIAL",
    });
    expect(derived.tone).toBe("info");
    expect(presentNoteStatusForViewer(derived, "issuer").tone).toBe("warning");
    expect(presentNoteStatusForViewer(derived, "investor").tone).toBe("info");
  });
});
