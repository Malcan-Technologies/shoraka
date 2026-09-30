import {
  computeNetDebtEquity,
  resolveCtosGearingRatio,
  resolveFinancialReviewResult,
} from "@cashsouk/types";

describe("Admin Financial Summary CTOS omission-risk wiring", () => {
  describe("Debt / Equity (Total Liabilities ÷ Net Worth)", () => {
    const totlib = 3_100_000;
    const networth = 2_500_000;
    const expected = 1.24;

    it("A) CTOS gear present wins (returns CTOS value)", () => {
      const v = resolveCtosGearingRatio({
        gear: expected,
        totlib,
        networth,
      });
      expect(v).not.toBeNull();
      expect(v!).toBeCloseTo(expected, 10);
    });

    it("B) CTOS gear missing but totlib + networth available falls back to totlib/networth", () => {
      const v = resolveCtosGearingRatio({
        gear: null,
        totlib,
        networth,
      });
      expect(v).not.toBeNull();
      expect(v!).toBeCloseTo(expected, 10);
    });

    it("C) Total Liabilities missing cannot be calculated", () => {
      const v = resolveCtosGearingRatio({
        gear: null,
        totlib: null,
        networth,
      });
      expect(v).toBeNull();
    });

    it("D) Net Worth missing/zero cannot be calculated", () => {
      const vNull = resolveCtosGearingRatio({
        gear: null,
        totlib,
        networth: null,
      });
      expect(vNull).toBeNull();

      const vZero = resolveCtosGearingRatio({
        gear: null,
        totlib,
        networth: 0,
      });
      expect(vZero).toBeNull();
    });
  });

  describe("Net Debt / Equity", () => {
    it("A) Calculates correctly when all raw inputs + Net Worth are available", () => {
      const v = computeNetDebtEquity({
        curlib_borrowing: 1_200_000,
        ncl_loan: 500_000,
        cashAndBank: 700_000,
        networth: 2_500_000,
      });
      expect(v).not.toBeNull();
      expect(v!).toBeCloseTo(0.4, 10);
    });

    it("B) Net Worth omitted but derivable from Total Assets − Total Liabilities still calculates", () => {
      // CTOS year without a networth figure: the shared result derives it from the components.
      const result = resolveFinancialReviewResult({
        financialStatements: { questionnaire: { financial_year_end: "2026-12-31" } },
        ctosFinancials: [
          {
            financial_year: 2024,
            dates: { pldd: "2024-12-31", bsdd: null },
            account: {
              bsfatot: 2_500_000,
              othass: 0,
              bscatot: 0,
              bsclbank: 0,
              curlib: 0,
              bsslltd: 0,
              bsclstd: 0,
              curlib_borrowing: 1_200_000,
              ncl_loan: 500_000,
              cashAndBank: 700_000,
            },
          },
        ],
        referenceDate: new Date("2026-09-25T00:00:00.000Z"),
        ctosFetchState: "has_data",
      });
      const values = result.years.find((y) => y.year === 2024 && y.kind === "ctos")?.calculated_values;
      expect(values?.networth).toBe(2_500_000);
      expect(values?.netDebtEquity).toBeCloseTo(0.4, 10);
    });

    it("C) Cash & Bank missing cannot be calculated", () => {
      const v = computeNetDebtEquity({
        curlib_borrowing: 1_200_000,
        ncl_loan: 500_000,
        cashAndBank: null,
        networth: 2_500_000,
      });
      expect(v).toBeNull();
    });

    it("D) Current Borrowings missing cannot be calculated", () => {
      const v = computeNetDebtEquity({
        curlib_borrowing: null,
        ncl_loan: 500_000,
        cashAndBank: 700_000,
        networth: 2_500_000,
      });
      expect(v).toBeNull();
    });

    it("E) Non-current Loans missing cannot be calculated", () => {
      const v = computeNetDebtEquity({
        curlib_borrowing: 1_200_000,
        ncl_loan: null,
        cashAndBank: 700_000,
        networth: 2_500_000,
      });
      expect(v).toBeNull();
    });

    it("F) Net Worth missing/zero cannot be calculated", () => {
      const vNull = computeNetDebtEquity({
        curlib_borrowing: 1_200_000,
        ncl_loan: 500_000,
        cashAndBank: 700_000,
        networth: null,
      });
      expect(vNull).toBeNull();

      const vZero = computeNetDebtEquity({
        curlib_borrowing: 1_200_000,
        ncl_loan: 500_000,
        cashAndBank: 700_000,
        networth: 0,
      });
      expect(vZero).toBeNull();
    });
  });
});

