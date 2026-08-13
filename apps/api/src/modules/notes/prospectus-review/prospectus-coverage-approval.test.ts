/**
 * Page 3 Coverage officer fields — approval required; CTOS system rows not required as manuals.
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

  it("requires Page 3 coverage officer fields (OCF / FCF / Payables) per displayed year", () => {
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
          // payablesDays missing
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
          payablesDays: 46,
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
          payablesDays: 44,
        },
      },
    };
    const errors = validateApprovalContent(draft, {
      incomeStatementYears: ["2022", "2023", "2024"],
    });
    expect(
      errors.some((e) => e.path === "page3.manualFinancialInputs.years.2022.payablesDays")
    ).toBe(true);
    expect(
      errors.some((e) => e.path === "page3.manualFinancialInputs.years.2022.returnOnAssets")
    ).toBe(false);
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
          payablesDays: 0,
        },
      },
    };
    expect(validateApprovalContent(draft, { incomeStatementYears: ["2022"] })).toEqual([]);
  });

  it("does not require CTOS system coverage fields as officer manuals", () => {
    expect(PROSPECTUS_COVERAGE_OFFICER_FIELD_KEYS).not.toContain("debtEquity");
    expect(PROSPECTUS_COVERAGE_OFFICER_FIELD_KEYS).not.toContain("returnOnAssets");
    expect(PROSPECTUS_COVERAGE_OFFICER_FIELD_KEYS).not.toContain("assetTurnover");
    expect(PROSPECTUS_COVERAGE_OFFICER_FIELD_KEYS).not.toContain("interestCoverage");
    expect(PROSPECTUS_COVERAGE_OFFICER_FIELD_KEYS).not.toContain("dscr");
    expect(PROSPECTUS_COVERAGE_OFFICER_FIELD_KEYS).not.toContain("receivablesDays");
    const draft = buildCompleteProspectusReviewDraft();
    expect(
      validateApprovalContent(draft, {
        incomeStatementYears: ["2022", "2023", "2024"],
      })
    ).toEqual([]);
  });
});
