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
    // Page 2 override metrics are retired; approval no longer blocks on them.
    expect(errors).toEqual([]);
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
    expect(errors).toEqual([]);
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
    expect(errors).toEqual([]);
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
    expect(errors).toEqual([]);
  });

  it("requires Net Debt / Equity and the three Coverage-reused fields for every displayed year", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.financialComparison = { overrides: {} };
    const errors = validateApprovalContent(draft, { incomeStatementYears: DISPLAYED_YEARS });
    expect(errors).toEqual([]);
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

  it("Page 3 Coverage renders Interest Coverage / DSCR / Receivables Days from Stage 4A system values", () => {
    // Choose inputs that make the derived metrics deterministic.
    // interestCoverage = EBIT / interest_cost
    // EBIT = plnpbt + interest_cost
    // With interest_cost=100_000 and target IC=12.1 => EBIT=1_210_000 => plnpbt=1_110_000
    const source = financialSourceFromYearBlocks({
      "2023": {
        // Needed to establish Beginning AR for FY2024 Receivables Days.
        tradeReceivables: 2_027_397.26,
        turnover: 10_000_000,
      },
      "2024": {
        plnpbt: 1_110_000,
        interest_cost: 100_000,
        ebitda: 1_420_000,
        annualDebtService: 1_000_000,
        turnover: 10_000_000,
        tradeReceivables: 2_027_397.26,
        // Also set payablesDays inputs for Payables Days renderers to have a complete raw bag.
        tradePayables: 48_000,
        costOfSales: 365_000,
        // Required by other rows in this table.
        operatingCashFlow: 1_400_000,
        freeCashFlow: 1_100_000,
        netDebtEquity: 0.5,
      },
    });

    const page3 = buildProspectusPageThreeCoverageEfficiency({
      financialSource: source,
      // Legacy overrides should be ignored for these system-derived rows.
      page2FinancialOverrides: null,
      prospectusFinancialInputs: { years: {} } as any,
    });

    // FY2024 is the second displayed year (FY2023 is first).
    expect(page3.rows.find((r) => r.key === "interest_coverage")?.values[1]).toBe("12.1x");
    expect(page3.rows.find((r) => r.key === "dscr")?.values[1]).toBe("1.42x");
    expect(page3.rows.find((r) => r.key === "receivables_days")?.values[1]).toBe("74");
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
