import {
  PRODUCT_CODE_REGEX,
  assertValidProductCode,
  normalizeAndValidateProductCode,
  normalizeProductCode,
} from "./product-code";

describe("display-reference product code", () => {
  it("normalizes to trimmed uppercase", () => {
    expect(normalizeProductCode(" arf ")).toBe("ARF");
    expect(normalizeAndValidateProductCode(" wc1 ")).toBe("WC1");
  });

  it("accepts valid codes", () => {
    expect(() => assertValidProductCode("ARF")).not.toThrow();
    expect(() => assertValidProductCode("WC1")).not.toThrow();
    expect(PRODUCT_CODE_REGEX.test("ABCDEFGH")).toBe(true);
  });

  it("rejects invalid format", () => {
    expect(() => normalizeAndValidateProductCode("AR-F")).toThrow();
    expect(() => normalizeAndValidateProductCode("A")).toThrow();
    expect(() => normalizeAndValidateProductCode("ABCDEFGHI")).toThrow();
    expect(() => normalizeAndValidateProductCode("A B")).toThrow();
  });
});
