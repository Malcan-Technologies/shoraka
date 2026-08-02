import { formatReceiptNumber, getMalaysiaDateKey } from "./receipt-number";

describe("receipt-number", () => {
  it("formats RCP-YYYYMMDD-NNN", () => {
    expect(formatReceiptNumber("20260803", 1)).toBe("RCP-20260803-001");
    expect(formatReceiptNumber("20260803", 42)).toBe("RCP-20260803-042");
    expect(formatReceiptNumber("20260803", 999)).toBe("RCP-20260803-999");
  });

  it("rejects invalid sequences", () => {
    expect(() => formatReceiptNumber("20260803", 0)).toThrow();
    expect(() => formatReceiptNumber("20260803", 1000)).toThrow();
    expect(() => formatReceiptNumber("bad", 1)).toThrow();
  });

  it("resolves Malaysia date key", () => {
    const key = getMalaysiaDateKey(new Date("2026-08-03T10:00:00+08:00"));
    expect(key).toBe("20260803");
  });
});
