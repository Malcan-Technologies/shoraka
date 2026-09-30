import fs from "node:fs";
import path from "node:path";
import {
  NOTE_FINANCIAL_SNAPSHOT_MISSING_CODE,
  NOTE_FINANCIAL_SNAPSHOT_MISSING_MESSAGE,
  prospectusReviewErrorMessage,
} from "./prospectus-review-error-utils";

describe("prospectusReviewErrorMessage", () => {
  it("uses first detail.message when details has one actionable validation error", () => {
    const msg = prospectusReviewErrorMessage({
      message: "Draft content is invalid",
      details: [{ path: "page3.manualFinancialInputs.years.2024.payablesDays", message: "Receivables Days must be a whole number" }],
    });
    expect(msg).toBe("Receivables Days must be a whole number");
  });

  it("uses first detail.message when details has multiple errors (deterministic)", () => {
    const msg = prospectusReviewErrorMessage({
      message: "Approval validation failed",
      details: [
        { path: "page2.marcAssessment", message: "MARC assessment is required." },
        { path: "page2.creditInsights.litigationCheckOptionKey", message: "Litigation Check is required." },
      ],
    });
    expect(msg).toBe("MARC assessment is required.");
  });

  it("falls back to top-level message when details are missing/unknown", () => {
    const msg = prospectusReviewErrorMessage({ message: "Draft content is invalid", details: undefined });
    expect(msg).toBe("Draft content is invalid");
  });

  it("falls back to top-level message when details are not an array of objects", () => {
    const msg = prospectusReviewErrorMessage({ message: "Network error", details: { not: "an array" } });
    expect(msg).toBe("Network error");
  });

  it("maps NOTE_FINANCIAL_SNAPSHOT_MISSING to the user-facing copy regardless of message/details", () => {
    const msg = prospectusReviewErrorMessage({
      code: NOTE_FINANCIAL_SNAPSHOT_MISSING_CODE,
      message: "This note has no financial snapshot. Recreate the note from an application with an approved Financial review.",
      details: [{ path: "x", message: "ignored" }],
    });
    expect(msg).toBe(NOTE_FINANCIAL_SNAPSHOT_MISSING_MESSAGE);
    expect(msg).toBe(
      "This Note was created before the required financial snapshot was available. Prospectus review cannot continue for this Note."
    );
    // Operations cannot create another Note for the same invoice, so the copy must not ask for one.
    expect(msg.toLowerCase()).not.toContain("recreate");
  });

  it("does not map other error codes", () => {
    expect(prospectusReviewErrorMessage({ code: "NOTE_NOT_FOUND", message: "Note not found" })).toBe(
      "Note not found"
    );
  });
});

describe("Prospectus Review flows use prospectusReviewErrorMessage", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "use-prospectus-review.ts"),
    "utf8"
  );

  it("covers Save Draft error path", () => {
    expect(source).toContain("function useSaveProspectusReviewDraft");
    expect(source).toContain("useSaveProspectusReviewDraft");
    expect(source).toContain("throw new Error(prospectusReviewErrorMessage(res.error");
  });

  it("covers Approve error path", () => {
    expect(source).toContain("function useApproveProspectusReview");
    expect(source).toContain("prospectusReviewErrorMessage(res.error");
  });

  it("covers the review load (GET) error path, keeping the API error code and not retrying a missing snapshot", () => {
    expect(source).toContain("function useProspectusReview(");
    const loadFn = source.slice(source.indexOf("function useProspectusReview("), source.indexOf("function useSaveProspectusReviewDraft"));
    expect(loadFn).toContain("prospectusReviewErrorMessage(apiError)");
    expect(loadFn).toContain("new ProspectusReviewLoadError(");
    expect(loadFn).toContain("!isNoteFinancialSnapshotMissingError(error) && failureCount < 3");
    expect(loadFn).not.toContain("throw new Error(res.error.message)");
  });

  it("the Prospectus page renders the snapshot-missing state before the loading skeleton", () => {
    const page = fs.readFileSync(
      path.join(__dirname, "../../app/notes/[id]/prospectus/page.tsx"),
      "utf8"
    );
    const missingState = page.indexOf("isNoteFinancialSnapshotMissingError(error)");
    const genericError = page.indexOf('"Failed to load review"');
    const skeleton = page.indexOf("if (isLoading || !data || !draft)");
    expect(missingState).toBeGreaterThan(-1);
    expect(missingState).toBeLessThan(genericError);
    expect(genericError).toBeLessThan(skeleton);
    expect(page).toContain("NOTE_FINANCIAL_SNAPSHOT_MISSING_TITLE");
    expect(page).toContain("NOTE_FINANCIAL_SNAPSHOT_MISSING_MESSAGE");
  });

  it("covers Preview error path (GET + POST)", () => {
    expect(source).toContain("function useProspectusReviewPreview");
    expect(source).toContain("function usePreviewProspectusReview");
    expect(source).toContain("prospectusReviewErrorMessage(res.error");
  });
});

