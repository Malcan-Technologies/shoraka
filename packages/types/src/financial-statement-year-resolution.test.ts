import { buildNormalizedFinancialStatementYearSet } from "./financial-statement-year-resolution";

describe("buildNormalizedFinancialStatementYearSet (CTOS extras preservation)", () => {
  it("keeps CTOS bsqres/bsqupro/bsqmint/plminin mapped into CashSouk comrep raw keys", () => {
    const normalized = buildNormalizedFinancialStatementYearSet({
      financialStatements: {
        questionnaire: { financial_year_end: "2027-12-31" },
        unaudited_by_year: {},
        admin_input_by_year: {},
      },
      ctosFinancials: [
        {
          financial_year: 2024,
          dates: { pldd: "2024-12-31", bsdd: null },
          account: {
            bsqres: 100_000,
            bsqupro: 200_000,
            bsqmint: 300_000,
            plminin: 400_000,
          },
        },
      ],
      ref: new Date("2026-09-23T00:00:00+08:00"),
    });

    expect(normalized).toHaveLength(1);
    const year = normalized[0]!;
    expect(year.year).toBe(2024);
    expect(year.recordSource).toBe("ctos_audited");

    expect(year.rawFinancials).toMatchObject({
      equity_share_premium: 100_000,
      equity_accumulated_profit: 200_000,
      equity_minority: 300_000,
      pl_minority: 400_000,
    });
  });
});

