/**
 * Optional Page 2 financial comparison overrides — validation + approval + hash.
 */

import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";
import { cloneReviewContent } from "./prospectus-review-content";
import { hashDraftContent } from "./prospectus-approved-snapshot";
import {
  validateApprovalContent,
  validateDraftContent,
} from "./prospectus-review.schemas";

describe("prospectus financial comparison optional overrides", () => {
  it("allows approval when all four override metrics are empty", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.financialComparison = { overrides: {} };
    expect(validateApprovalContent(draft)).toEqual([]);
  });

  it("rejects negative multiples and non-integer receivables days", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.financialComparison = {
      overrides: {
        "2024-12-31": {
          netDebtEquity: -1,
          interestCoverage: 2,
          dscr: 1,
          receivablesDays: 12.5,
        },
      },
    };
    const errors = validateDraftContent(draft);
    expect(errors.some((e) => e.path.includes("netDebtEquity"))).toBe(true);
    expect(errors.some((e) => e.path.includes("receivablesDays"))).toBe(true);
  });

  it("accepts valid entered overrides and changes draft fingerprint", () => {
    const approved = buildCompleteProspectusReviewDraft();
    approved.page2.financialComparison = {
      overrides: {
        "2024-12-31": {
          netDebtEquity: 0.4,
          interestCoverage: 2,
          dscr: 1.1,
          receivablesDays: 30,
        },
      },
    };
    expect(validateDraftContent(approved)).toEqual([]);
    expect(validateApprovalContent(approved)).toEqual([]);

    const next = cloneReviewContent(approved);
    next.page2.financialComparison!.overrides!["2024-12-31"]!.dscr = 1.2;
    expect(hashDraftContent(approved)).not.toBe(hashDraftContent(next));
    expect(hashDraftContent(approved)).toBe(hashDraftContent(cloneReviewContent(approved)));
  });
});
