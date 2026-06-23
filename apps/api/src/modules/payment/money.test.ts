import { Prisma } from "@prisma/client";
import { myrDecimalToSen, myrToSen, senToMyr, senToMyrDecimal } from "./money";

describe("Curlec money conversion", () => {
  it("converts MYR to sen as integer", () => {
    expect(myrToSen(100)).toBe(10_000);
    expect(myrToSen(100.5)).toBe(10_050);
    expect(myrToSen("250.25")).toBe(25_025);
    expect(myrToSen(new Prisma.Decimal("100.00"))).toBe(10_000);
  });

  it("rounds sub-sen MYR amounts at the boundary", () => {
    expect(myrToSen(100.005)).toBe(10_001);
    expect(myrToSen(99.994)).toBe(9_999);
  });

  it("converts sen back to MYR", () => {
    expect(senToMyr(10_000)).toBe(100);
    expect(senToMyr(10_050)).toBe(100.5);
  });

  it("round-trips sen ↔ MYR without drift", () => {
    const amountsMyr = [100, 100.5, 250.25, 30_000, 0.01];
    for (const amount of amountsMyr) {
      expect(senToMyr(myrToSen(amount))).toBe(amount);
    }
  });

  it("stores sen as MYR Decimal(18,6)", () => {
    expect(senToMyrDecimal(10_000).toFixed(6)).toBe("100.000000");
    expect(senToMyrDecimal(10_001).toFixed(6)).toBe("100.010000");
  });

  it("converts Prisma Decimal MYR to sen for outbound API calls", () => {
    expect(myrDecimalToSen(new Prisma.Decimal("150.750000"))).toBe(15_075);
  });

  it("rejects invalid amounts", () => {
    expect(() => myrToSen(Number.NaN)).toThrow("Invalid MYR amount");
    expect(() => senToMyr(100.5)).toThrow("Sen amount must be an integer");
  });
});
