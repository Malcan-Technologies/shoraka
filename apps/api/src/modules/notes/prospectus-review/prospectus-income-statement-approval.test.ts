/**
 * SECTION: Approval requires Page 3 Income Statement officer rows per displayed year
 */

import { parseProspectusFinancialNumber } from "../prospectus/prospectus-financial-comparison-metrics";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";
import { validateApprovalContent } from "./prospectus-review.schemas";

describe("prospectus Income Statement approval validation", () => {
  it("allows draft without income officer years when years are not supplied", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page3.manualFinancialInputs = { years: {} };
    expect(validateApprovalContent(draft)).toEqual([]);
  });

  it("requires Gross Profit, EBITDA, and EBIT for each displayed year", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page3.manualFinancialInputs = {
      years: {
        "2023": {
          grossProfit: 1,
          ebitda: 1,
          ebit: 1,
          cashAndBank: 1,
          tradeReceivables: 1,
          totalEquity: 1,
          quickRatio: 1,
          operatingCashFlow: 1,
          freeCashFlow: 1,
          debtEquity: 1,
          returnOnAssets: 1,
          payablesDays: 1,
          assetTurnover: 1,
        },
      },
    };
    const errors = validateApprovalContent(draft, {
      incomeStatementYears: ["2022", "2023", "2024"],
    });
    expect(
      errors.some((e) => e.path === "page3.manualFinancialInputs.years.2022.grossProfit")
    ).toBe(true);
    expect(
      errors.some((e) => e.path === "page3.manualFinancialInputs.years.2024.ebit")
    ).toBe(true);
    expect(
      errors.some((e) => e.path === "page3.manualFinancialInputs.years.2023.grossProfit")
    ).toBe(false);
  });

  it("accepts zero and negative officer money values", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page3.manualFinancialInputs = {
      years: {
        "2022": {
          grossProfit: 0,
          ebitda: -10_000,
          ebit: 1,
          cashAndBank: 0,
          tradeReceivables: 1,
          totalEquity: 1,
          quickRatio: 1.1,
          operatingCashFlow: 0,
          freeCashFlow: 0,
          debtEquity: 0,
          returnOnAssets: 0,
          payablesDays: 0,
          assetTurnover: 0,
        },
      },
    };
    expect(
      validateApprovalContent(draft, { incomeStatementYears: ["2022"] })
    ).toEqual([]);
    expect(parseProspectusFinancialNumber(0)).toBe(0);
    expect(parseProspectusFinancialNumber(-10_000)).toBe(-10_000);
  });

  it("approves complete demo fixture years when those years are required", () => {
    const draft = buildCompleteProspectusReviewDraft();
    expect(
      validateApprovalContent(draft, {
        incomeStatementYears: ["2022", "2023", "2024"],
      })
    ).toEqual([]);
  });
});
