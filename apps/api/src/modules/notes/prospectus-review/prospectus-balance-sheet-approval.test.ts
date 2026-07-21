/**
 * SECTION: Approval requires Page 3 Balance Sheet officer rows per displayed year
 */

import { parseProspectusFinancialNumber } from "../prospectus/prospectus-financial-comparison-metrics";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";
import { validateApprovalContent } from "./prospectus-review.schemas";

describe("prospectus Balance Sheet approval validation", () => {
  it("allows draft without balance officer years when years are not supplied", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page3.manualFinancialInputs = { years: {} };
    expect(validateApprovalContent(draft)).toEqual([]);
  });

  it("requires Cash & Bank, Trade Receivables, Total Equity, and Quick Ratio for each year", () => {
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
          quickRatio: 1.1,
        },
      },
    };
    const errors = validateApprovalContent(draft, {
      incomeStatementYears: ["2022", "2023", "2024"],
    });
    expect(
      errors.some((e) => e.path === "page3.manualFinancialInputs.years.2022.cashAndBank")
    ).toBe(true);
    expect(
      errors.some((e) => e.path === "page3.manualFinancialInputs.years.2024.quickRatio")
    ).toBe(true);
    expect(
      errors.some((e) => e.path === "page3.manualFinancialInputs.years.2023.cashAndBank")
    ).toBe(false);
  });

  it("accepts zero money and positive/negative quick ratio numbers without storing x", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page3.manualFinancialInputs = {
      years: {
        "2022": {
          grossProfit: 1,
          ebitda: 1,
          ebit: 1,
          cashAndBank: 0,
          tradeReceivables: -10_000,
          totalEquity: 1,
          quickRatio: -0.5,
        },
      },
    };
    expect(
      validateApprovalContent(draft, { incomeStatementYears: ["2022"] })
    ).toEqual([]);
    expect(parseProspectusFinancialNumber(0)).toBe(0);
    expect(parseProspectusFinancialNumber(-0.5)).toBe(-0.5);
    expect(String(draft.page3.manualFinancialInputs.years["2022"]!.quickRatio)).not.toMatch(
      /x/i
    );
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
