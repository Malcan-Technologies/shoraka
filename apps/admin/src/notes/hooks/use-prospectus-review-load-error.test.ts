import {
  NOTE_FINANCIAL_SNAPSHOT_MISSING_CODE,
  ProspectusReviewLoadError,
  isNoteFinancialSnapshotMissingError,
} from "./prospectus-review-error-utils";

describe("ProspectusReviewLoadError", () => {
  it("keeps the API error code so the page can recognise a missing financial snapshot", () => {
    const error = new ProspectusReviewLoadError("msg", NOTE_FINANCIAL_SNAPSHOT_MISSING_CODE);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("msg");
    expect(error.code).toBe("NOTE_FINANCIAL_SNAPSHOT_MISSING");
    expect(isNoteFinancialSnapshotMissingError(error)).toBe(true);
  });

  it("does not treat other load errors or plain errors as the snapshot-missing state", () => {
    expect(isNoteFinancialSnapshotMissingError(new ProspectusReviewLoadError("x", "NOTE_NOT_FOUND"))).toBe(false);
    expect(isNoteFinancialSnapshotMissingError(new ProspectusReviewLoadError("x", null))).toBe(false);
    expect(isNoteFinancialSnapshotMissingError(new Error("NOTE_FINANCIAL_SNAPSHOT_MISSING"))).toBe(false);
    expect(isNoteFinancialSnapshotMissingError(undefined)).toBe(false);
  });
});
