import {
  computeNetDebtEquity,
  resolveCtosGearingRatio,
} from "@cashsouk/types";
import { resolveNetWorthFromComponentsForRoe } from "./application-financial-review-roe-fallback";

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
      const networth = resolveNetWorthFromComponentsForRoe({
        fixedAssets: 2_500_000,
        otherAssets: 0,
        currentAssets: 0,
        nonCurrentAssets: 0,
        currentLiabilities: 0,
        longTermLiabilities: 0,
        nonCurrentLiabilities: 0,
      });
      expect(networth).toBe(2_500_000);

      const v = computeNetDebtEquity({
        curlib_borrowing: 1_200_000,
        ncl_loan: 500_000,
        cashAndBank: 700_000,
        networth,
      });
      expect(v).not.toBeNull();
      expect(v!).toBeCloseTo(0.4, 10);
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

