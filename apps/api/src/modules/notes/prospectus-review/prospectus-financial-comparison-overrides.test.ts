/**
 * Page 2 Financial Comparison officer overrides — draft shape + approval for reused Coverage rows.
 */

import { buildProspectusPageThreeCoverageEfficiency } from "../prospectus/prospectus-page-three-coverage-efficiency";
import { financialSourceFromYearBlocks } from "../prospectus/prospectus-financial-comparison-test-helpers";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";
import { cloneReviewContent } from "./prospectus-review-content";
import { hashDraftContent } from "./prospectus-approved-snapshot";
import {
  resolvePage2FinancialOverrideForCalendarYear,
  validateApprovalContent,
  validateDraftContent,
} from "./prospectus-review.schemas";

const DISPLAYED_YEARS = ["2022", "2023", "2024"] as const;

describe("prospectus financial comparison overrides", () => {
  it("allows draft save and approval when overrides are empty and no financial years are required", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.financialComparison = { overrides: {} };
    expect(validateDraftContent(draft)).toEqual([]);
    expect(validateApprovalContent(draft)).toEqual([]);
  });

  it("rejects negative multiples and non-integer receivables days on draft", () => {
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

  it("blocks approval when Net Debt / Equity is missing for a displayed year", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.financialComparison = {
      overrides: {
        "2022": { interestCoverage: 12.1, dscr: 1.42, receivablesDays: 74 },
        "2023": {
          netDebtEquity: 0.28,
          interestCoverage: 13.3,
          dscr: 1.55,
          receivablesDays: 69,
        },
        "2024": {
          netDebtEquity: 0.22,
          interestCoverage: 14.6,
          dscr: 1.68,
          receivablesDays: 63,
        },
      },
    };
    const errors = validateApprovalContent(draft, { incomeStatementYears: DISPLAYED_YEARS });
    expect(
      errors.some(
        (e) =>
          e.path === "page2.financialComparison.overrides.2022.netDebtEquity" &&
          e.message ===
            "Net Debt / Equity (x) is required for FY2022 before approving the Prospectus."
      )
    ).toBe(true);
  });

  it("blocks approval when Interest Coverage is missing for a displayed year", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.financialComparison = {
      overrides: {
        "2022": { netDebtEquity: 0.35, dscr: 1.42, receivablesDays: 74 },
        "2023": {
          netDebtEquity: 0.28,
          interestCoverage: 13.3,
          dscr: 1.55,
          receivablesDays: 69,
        },
        "2024": {
          netDebtEquity: 0.22,
          interestCoverage: 14.6,
          dscr: 1.68,
          receivablesDays: 63,
        },
      },
    };
    const errors = validateApprovalContent(draft, { incomeStatementYears: DISPLAYED_YEARS });
    expect(
      errors.some(
        (e) =>
          e.path === "page2.financialComparison.overrides.2022.interestCoverage" &&
          e.message.includes("Interest Coverage") &&
          e.message.includes("FY2022")
      )
    ).toBe(true);
  });

  it("blocks approval when DSCR is missing for a displayed year", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.financialComparison = {
      overrides: {
        "2022": { netDebtEquity: 0.35, interestCoverage: 12.1, receivablesDays: 74 },
        "2023": {
          netDebtEquity: 0.28,
          interestCoverage: 13.3,
          dscr: 1.55,
          receivablesDays: 69,
        },
        "2024": {
          netDebtEquity: 0.22,
          interestCoverage: 14.6,
          dscr: 1.68,
          receivablesDays: 63,
        },
      },
    };
    const errors = validateApprovalContent(draft, { incomeStatementYears: DISPLAYED_YEARS });
    expect(
      errors.some(
        (e) =>
          e.path === "page2.financialComparison.overrides.2022.dscr" &&
          e.message.includes("DSCR")
      )
    ).toBe(true);
  });

  it("blocks approval when Receivables Days is missing for a displayed year", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.financialComparison = {
      overrides: {
        "2022": { netDebtEquity: 0.35, interestCoverage: 12.1, dscr: 1.42 },
        "2023": {
          netDebtEquity: 0.28,
          interestCoverage: 13.3,
          dscr: 1.55,
          receivablesDays: 69,
        },
        "2024": {
          netDebtEquity: 0.22,
          interestCoverage: 14.6,
          dscr: 1.68,
          receivablesDays: 63,
        },
      },
    };
    const errors = validateApprovalContent(draft, { incomeStatementYears: DISPLAYED_YEARS });
    expect(
      errors.some(
        (e) =>
          e.path === "page2.financialComparison.overrides.2022.receivablesDays" &&
          e.message.includes("Receivables Days")
      )
    ).toBe(true);
  });

  it("requires Net Debt / Equity and the three Coverage-reused fields for every displayed year", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.financialComparison = { overrides: {} };
    const errors = validateApprovalContent(draft, { incomeStatementYears: DISPLAYED_YEARS });
    for (const year of DISPLAYED_YEARS) {
      for (const field of [
        "netDebtEquity",
        "interestCoverage",
        "dscr",
        "receivablesDays",
      ] as const) {
        expect(
          errors.some((e) => e.path === `page2.financialComparison.overrides.${year}.${field}`)
        ).toBe(true);
      }
    }
    expect(
      errors.some((e) => e.path.includes("page3.manualFinancialInputs") && e.path.includes("dscr"))
    ).toBe(false);
    expect(
      errors.some(
        (e) =>
          e.path.includes("page3.manualFinancialInputs") && e.path.includes("netDebtEquity")
      )
    ).toBe(false);
    expect(
      errors.some((e) => e.path.includes("page3.manualFinancialInputs.years") && e.path.includes("interestCoverage"))
    ).toBe(false);
  });

  it("accepts zero Net Debt / Equity, Interest Coverage, DSCR, and Receivables Days", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.financialComparison = {
      overrides: {
        "2022": { netDebtEquity: 0, interestCoverage: 0, dscr: 0, receivablesDays: 0 },
        "2023": { netDebtEquity: 0, interestCoverage: 0, dscr: 0, receivablesDays: 0 },
        "2024": { netDebtEquity: 0, interestCoverage: 0, dscr: 0, receivablesDays: 0 },
      },
    };
    expect(
      validateApprovalContent(draft, { incomeStatementYears: DISPLAYED_YEARS })
    ).toEqual([]);
  });

  it("resolves ISO financial-year keys such as YYYY-12-31", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.financialComparison = {
      overrides: {
        "2022-12-31": {
          netDebtEquity: 0.35,
          interestCoverage: 12.1,
          dscr: 1.42,
          receivablesDays: 74,
        },
        "2023-12-31": {
          netDebtEquity: 0.28,
          interestCoverage: 13.3,
          dscr: 1.55,
          receivablesDays: 69,
        },
        "2024-12-31": {
          netDebtEquity: 0.22,
          interestCoverage: 14.6,
          dscr: 1.68,
          receivablesDays: 63,
        },
      },
    };
    expect(
      resolvePage2FinancialOverrideForCalendarYear(
        draft.page2.financialComparison.overrides,
        "2024"
      )?.key
    ).toBe("2024-12-31");
    expect(
      validateApprovalContent(draft, { incomeStatementYears: DISPLAYED_YEARS })
    ).toEqual([]);
  });

  it("allows draft save without Net Debt / Equity when approval years are not required", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.financialComparison = {
      overrides: {
        "2022": { interestCoverage: 12.1, dscr: 1.42, receivablesDays: 74 },
      },
    };
    expect(validateDraftContent(draft)).toEqual([]);
  });

  it("allows approval when complete Page 2 overrides are present", () => {
    const draft = buildCompleteProspectusReviewDraft();
    expect(
      validateApprovalContent(draft, { incomeStatementYears: DISPLAYED_YEARS })
    ).toEqual([]);
  });

  it("Page 3 Coverage reuses the same Page 2 override values as read-only", () => {
    const source = financialSourceFromYearBlocks({
      "2024": { plnpat: 1_200_000, bsqpuc: 2_000_000, turnover: 10_000_000 },
    });
    const overrides = {
      "2024-12-31": {
        interestCoverage: 12.1,
        dscr: 1.42,
        receivablesDays: 74,
      },
    };
    const page3 = buildProspectusPageThreeCoverageEfficiency({
      financialSource: source,
      page2FinancialOverrides: overrides,
      prospectusFinancialInputs: {
        years: {
          "2024": {
            operatingCashFlow: 1,
            freeCashFlow: 1,
            debtEquity: 1,
            returnOnAssets: 1,
            payablesDays: 1,
            assetTurnover: 1,
          },
        },
      },
    });
    expect(page3.rows.find((r) => r.key === "interest_coverage")?.values[0]).toBe("12.1x");
    expect(page3.rows.find((r) => r.key === "dscr")?.values[0]).toBe("1.42x");
    expect(page3.rows.find((r) => r.key === "receivables_days")?.values[0]).toBe("74");
  });

  it("changing a reused override changes the draft fingerprint (invalidates Approved)", () => {
    const approved = buildCompleteProspectusReviewDraft();
    expect(validateDraftContent(approved)).toEqual([]);
    expect(
      validateApprovalContent(approved, { incomeStatementYears: DISPLAYED_YEARS })
    ).toEqual([]);

    const next = cloneReviewContent(approved);
    const key = Object.keys(next.page2.financialComparison!.overrides!)[0]!;
    next.page2.financialComparison!.overrides![key]!.dscr = 9.9;
    expect(hashDraftContent(approved)).not.toBe(hashDraftContent(next));
    expect(hashDraftContent(approved)).toBe(hashDraftContent(cloneReviewContent(approved)));
  });
});
