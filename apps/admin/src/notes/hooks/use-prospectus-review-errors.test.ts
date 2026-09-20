import fs from "node:fs";
import path from "node:path";
import { prospectusReviewErrorMessage } from "./prospectus-review-error-utils";

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

  it("covers Preview error path (GET + POST)", () => {
    expect(source).toContain("function useProspectusReviewPreview");
    expect(source).toContain("function usePreviewProspectusReview");
    expect(source).toContain("prospectusReviewErrorMessage(res.error");
  });
});

