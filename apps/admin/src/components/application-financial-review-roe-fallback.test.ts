jest.mock("@cashsouk/config", () => jest.requireActual("../../../../packages/config/src/currency"));

import { resolveFinancialReviewResult } from "@cashsouk/types";
import {
  findFinancialReviewResultYear,
  formatFinancialReviewCalculatedCell,
} from "./application-financial-review-calculated-cell";
import { getReturnOfEquityMissingReason } from "./application-financial-review-roe-fallback";

/** ROE cell text for one CTOS year, read from the shared Financial Review result. */
function ctosRoeCell(account: Record<string, number | null>): string {
  const result = resolveFinancialReviewResult({
    financialStatements: { questionnaire: { financial_year_end: "2026-12-31" } },
    ctosFinancials: [{ financial_year: 2024, dates: { pldd: "2024-12-31", bsdd: null }, account }],
    referenceDate: new Date("2026-09-25T00:00:00.000Z"),
    ctosFetchState: "has_data",
  });
  const year = findFinancialReviewResultYear(result, 2024, "ctos");
  return formatFinancialReviewCalculatedCell("return_of_equity", year?.calculated_values);
}

const COMPONENTS_WITH_NET_WORTH_2_7M = {
  bsfatot: 2_700_000,
  othass: 0,
  bscatot: 0,
  bsclbank: 0,
  curlib: 0,
  bsslltd: 0,
  bsclstd: 0,
};

describe("Admin Financial Summary ROE fallback (PAT ÷ Total Equity / Net Worth)", () => {
  it("fallback calculates ROE = 453,600 ÷ 2,700,000 × 100 = 16.80% when CTOS return_on_equity is absent", () => {
    expect(ctosRoeCell({ ...COMPONENTS_WITH_NET_WORTH_2_7M, plnpat: 453_600 })).toBe("16.80%");
  });

  it("CTOS finished return_on_equity wins over fallback even when PAT/net worth differ", () => {
    expect(
      ctosRoeCell({ ...COMPONENTS_WITH_NET_WORTH_2_7M, plnpat: 453_600, return_on_equity: 12.34 })
    ).toBe("12.34%");
  });

  it("failure cases: ROE shows accurate helper reasons when PAT or Net Worth is unavailable", () => {
    expect(getReturnOfEquityMissingReason({ pat: null, netWorth: 2_700_000 })).toBe(
      "Missing: Profit / Loss After Tax"
    );
    expect(getReturnOfEquityMissingReason({ pat: 453_600, netWorth: null })).toBe(
      "Missing: Total Equity / Net Worth"
    );
    expect(getReturnOfEquityMissingReason({ pat: 453_600, netWorth: 0 })).toBe(
      "Invalid: Total Equity / Net Worth is zero"
    );
  });
});
