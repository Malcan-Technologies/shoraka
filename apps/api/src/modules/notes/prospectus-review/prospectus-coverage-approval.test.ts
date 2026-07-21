/**
 * Page 3 Coverage officer fields — approval required; Page 2 reused metrics not duplicated.
 */

import { PROSPECTUS_COVERAGE_OFFICER_FIELD_KEYS } from "./prospectus-option-catalogues";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";
import { validateApprovalContent } from "./prospectus-review.schemas";

describe("prospectus coverage officer approval", () => {
  it("does not require coverage fields when no financial years are provided", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page3.manualFinancialInputs = { years: {} };
    expect(validateApprovalContent(draft)).toEqual([]);
  });

  it("requires all six Page 3 coverage officer fields per displayed year", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page3.manualFinancialInputs = {
      years: {
        "2022": {
          grossProfit: 1,
          ebitda: 1,
          ebit: 1,
          cashAndBank: 1,
          tradeReceivables: 1,
          totalEquity: 1,
          quickRatio: 1,
          operatingCashFlow: 1_400_000,
          freeCashFlow: 1_100_000,
          debtEquity: 0.24,
          // returnOnAssets missing
          payablesDays: 48,
          assetTurnover: 1.72,
        },
        "2023": {
          grossProfit: 1,
          ebitda: 1,
          ebit: 1,
          cashAndBank: 1,
          tradeReceivables: 1,
          totalEquity: 1,
          quickRatio: 1,
          operatingCashFlow: 1_700_000,
          freeCashFlow: 1_300_000,
          debtEquity: 0.2,
          returnOnAssets: 5.3,
          payablesDays: 46,
          assetTurnover: 1.82,
        },
        "2024": {
          grossProfit: 1,
          ebitda: 1,
          ebit: 1,
          cashAndBank: 1,
          tradeReceivables: 1,
          totalEquity: 1,
          quickRatio: 1,
          operatingCashFlow: 2_100_000,
          freeCashFlow: 1_600_000,
          debtEquity: 0.16,
          returnOnAssets: 5.8,
          payablesDays: 44,
          assetTurnover: 1.92,
        },
      },
    };
    const errors = validateApprovalContent(draft, {
      incomeStatementYears: ["2022", "2023", "2024"],
    });
    expect(
      errors.some((e) => e.path === "page3.manualFinancialInputs.years.2022.returnOnAssets")
    ).toBe(true);
    expect(
      errors.some((e) => e.path === "page3.manualFinancialInputs.years.2023.operatingCashFlow")
    ).toBe(false);
  });

  it("accepts zero as a provided coverage officer value", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page3.manualFinancialInputs = {
      years: {
        "2022": {
          grossProfit: 1,
          ebitda: 1,
          ebit: 1,
          cashAndBank: 1,
          tradeReceivables: 1,
          totalEquity: 1,
          quickRatio: 1,
          operatingCashFlow: 0,
          freeCashFlow: 0,
          debtEquity: 0,
          returnOnAssets: 0,
          payablesDays: 0,
          assetTurnover: 0,
        },
      },
    };
    expect(validateApprovalContent(draft, { incomeStatementYears: ["2022"] })).toEqual([]);
  });

  it("does not validate removed Page 3 interestCoverage / dscr / receivablesDays", () => {
    const draft = buildCompleteProspectusReviewDraft();
    expect(PROSPECTUS_COVERAGE_OFFICER_FIELD_KEYS).not.toContain("interestCoverage");
    expect(PROSPECTUS_COVERAGE_OFFICER_FIELD_KEYS).not.toContain("dscr");
    expect(PROSPECTUS_COVERAGE_OFFICER_FIELD_KEYS).not.toContain("receivablesDays");
    expect(
      validateApprovalContent(draft, {
        incomeStatementYears: ["2022", "2023", "2024"],
      })
    ).toEqual([]);
  });
});
