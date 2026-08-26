import { AppError } from "./http/error-handler";
import { assertInvoiceFinancingTenure, assertOfferFinancingTenure } from "./financing-tenure-guard";

const REFERENCE = new Date("2026-08-24T02:00:00.000Z");

describe("assertInvoiceFinancingTenure", () => {
  it("skips incomplete legacy details that have neither tenure nor due date", () => {
    expect(() =>
      assertInvoiceFinancingTenure({ number: "INV-1", value: 1000 }, REFERENCE)
    ).not.toThrow();
  });

  it("allows a document-only update of a legacy invoice that never stored tenure", () => {
    expect(() =>
      assertInvoiceFinancingTenure(
        { number: "INV-1", value: 1000, maturity_date: "2026-11-22" },
        REFERENCE,
        { allowLegacyMissing: true }
      )
    ).not.toThrow();
  });

  it("requires a published tenure that covers the due date", () => {
    expect(() =>
      assertInvoiceFinancingTenure(
        { maturity_date: "2026-11-22", financing_tenure_days: 90 },
        REFERENCE
      )
    ).not.toThrow();
    expect(() =>
      assertInvoiceFinancingTenure({ maturity_date: "2026-11-22" }, REFERENCE)
    ).toThrow(AppError);
    try {
      assertInvoiceFinancingTenure(
        { maturity_date: "2026-11-22", financing_tenure_days: 75 },
        REFERENCE
      );
      throw new Error("expected validation error");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toMatch(/at least 90 days/);
    }
  });

  it("rejects a past invoice due date even with a published tenure", () => {
    try {
      assertInvoiceFinancingTenure(
        { maturity_date: "2026-08-23", financing_tenure_days: 30 },
        REFERENCE
      );
      throw new Error("expected validation error");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Invoice due date cannot be in the past.");
    }
    expect(() =>
      assertInvoiceFinancingTenure(
        { maturity_date: "2026-08-24", financing_tenure_days: 30 },
        REFERENCE
      )
    ).not.toThrow();
  });
});

describe("assertOfferFinancingTenure", () => {
  it("stamps a valid admin override and rejects a shorter offer tenure", () => {
    expect(
      assertOfferFinancingTenure(105, { maturity_date: "2026-11-22" }, REFERENCE)
    ).toBe(105);
    expect(() =>
      assertOfferFinancingTenure(60, { maturity_date: "2026-11-22" }, REFERENCE)
    ).toThrow(/at least 90 days/);
    expect(() =>
      assertOfferFinancingTenure(30, { maturity_date: "2026-08-23" }, REFERENCE)
    ).toThrow("Invoice due date cannot be in the past.");
    expect(assertOfferFinancingTenure(30, { maturity_date: "2026-08-24" }, REFERENCE)).toBe(30);
  });
});
