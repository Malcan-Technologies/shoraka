import { currencyAmountExceeds, formatCurrency, roundCurrencyAmount } from "./currency";

describe("roundCurrencyAmount", () => {
  it("rounds to sen", () => {
    expect(roundCurrencyAmount(63_617.0568)).toBe(63_617.06);
    expect(roundCurrencyAmount(63_617.064)).toBe(63_617.06);
  });
});

describe("currencyAmountExceeds", () => {
  it("ignores sub-sen float noise", () => {
    expect(currencyAmountExceeds(63_617.06000000001, 63_617.06)).toBe(false);
  });

  it("detects a one-sen increase", () => {
    expect(currencyAmountExceeds(63_617.07, 63_617.06)).toBe(true);
  });
});

describe("formatCurrency", () => {
  it("shows sen for a ringgit-and-sen amount", () => {
    expect(formatCurrency(63_617.06)).toBe("RM 63,617.06");
  });
});
