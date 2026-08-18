import {
  getNoteFundingAccentClass,
  getNoteFundingIndicatorClass,
  getNoteFundingProgressClass,
  getNoteFundingStatusLabel,
  getNoteFundingStatusToken,
  isNoteActiveLoan,
  isNoteFundingComplete,
  isNoteFundingOpen,
} from "./funding-progress";

describe("note funding progress colours", () => {
  it("treats OPEN as in-market funding", () => {
    expect(isNoteFundingOpen("OPEN")).toBe(true);
    expect(isNoteFundingOpen("FUNDED")).toBe(false);
    expect(isNoteFundingComplete({ fundingStatus: "OPEN" })).toBe(false);
  });

  it("treats repaid and closed funding as complete, including failed close", () => {
    expect(isNoteFundingComplete({ fundingStatus: "FUNDED" })).toBe(true);
    expect(isNoteFundingComplete({ fundingStatus: "CLOSED" })).toBe(true);
    expect(isNoteFundingComplete({ fundingStatus: "FAILED" })).toBe(true);
    expect(isNoteFundingComplete({ status: "REPAID", fundingStatus: "CLOSED" })).toBe(true);
    expect(isNoteFundingComplete({ fundingStatus: "NOT_OPEN" })).toBe(false);
  });

  it("fills the bar blue while open and green once funding has ended", () => {
    expect(getNoteFundingProgressClass({ fundingStatus: "OPEN" })).toBe("bg-status-submitted-bg");
    expect(getNoteFundingIndicatorClass({ fundingStatus: "OPEN" })).toBe(
      "bg-status-submitted-text"
    );
    expect(getNoteFundingProgressClass({ fundingStatus: "FUNDED" })).toBe("bg-muted");
    expect(getNoteFundingIndicatorClass({ fundingStatus: "FUNDED" })).toBe(
      "bg-status-success-text"
    );
    expect(getNoteFundingIndicatorClass({ fundingStatus: "CLOSED" })).toBe(
      "bg-status-success-text"
    );
    expect(getNoteFundingIndicatorClass({ fundingStatus: "FAILED" })).toBe(
      "bg-status-success-text"
    );
    expect(getNoteFundingProgressClass({ fundingStatus: "NOT_OPEN" })).toBe("bg-muted");
    expect(getNoteFundingIndicatorClass({ fundingStatus: "NOT_OPEN" })).toBe(
      "bg-status-neutral-text"
    );
  });

  it("accents funded copy blue when open and green when closed", () => {
    expect(getNoteFundingAccentClass({ fundingStatus: "OPEN" })).toBe(
      "text-status-submitted-text"
    );
    expect(getNoteFundingAccentClass({ fundingStatus: "FUNDED" })).toBe(
      "text-status-success-text"
    );
    expect(getNoteFundingAccentClass({ fundingStatus: "CLOSED" })).toBe(
      "text-status-success-text"
    );
    expect(getNoteFundingAccentClass({ status: "REPAID", fundingStatus: "CLOSED" })).toBe(
      "text-status-success-text"
    );
    expect(getNoteFundingAccentClass({ fundingStatus: "FAILED" })).toBeUndefined();
    expect(getNoteFundingAccentClass({ fundingStatus: "NOT_OPEN" })).toBeUndefined();
  });

  it("maps funding chips without the global FUNDED=yellow admin token", () => {
    expect(getNoteFundingStatusToken({ fundingStatus: "OPEN" })).toBe("submitted");
    expect(getNoteFundingStatusToken({ fundingStatus: "FUNDED" })).toBe("success");
    expect(getNoteFundingStatusToken({ fundingStatus: "CLOSED" })).toBe("success");
    expect(getNoteFundingStatusToken({ fundingStatus: "FAILED" })).toBe("rejected");
    expect(getNoteFundingStatusToken({ fundingStatus: "NOT_OPEN" })).toBe("neutral");
  });

  it("labels open vs closed funding", () => {
    expect(getNoteFundingStatusLabel({ fundingStatus: "OPEN" })).toBe("Funding Open");
    expect(getNoteFundingStatusLabel({ fundingStatus: "FUNDED" })).toBe("Funding Closed");
    expect(getNoteFundingStatusLabel({ fundingStatus: "CLOSED" })).toBe("Funding Closed");
    expect(getNoteFundingStatusLabel({ fundingStatus: "FAILED" })).toBe("FAILED");
  });

  it("treats only servicing-or-later statuses as a live funded loan", () => {
    expect(isNoteActiveLoan({ status: "DRAFT" })).toBe(false);
    expect(isNoteActiveLoan({ status: "PUBLISHED" })).toBe(false);
    expect(isNoteActiveLoan({ status: "FUNDING" })).toBe(false);
    expect(isNoteActiveLoan({ status: "FAILED_FUNDING" })).toBe(false);
    expect(isNoteActiveLoan({ status: "CANCELLED" })).toBe(false);
    expect(isNoteActiveLoan({ status: "ACTIVE" })).toBe(true);
    expect(isNoteActiveLoan({ status: "ARREARS" })).toBe(true);
    expect(isNoteActiveLoan({ status: "DEFAULTED" })).toBe(true);
    expect(isNoteActiveLoan({ status: "REPAID" })).toBe(true);
  });
});
