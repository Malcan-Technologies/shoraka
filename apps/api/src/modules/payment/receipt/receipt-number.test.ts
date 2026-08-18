import { getMalaysiaDateKey } from "./receipt-number";

describe("receipt-number", () => {
  it("resolves Malaysia date key", () => {
    const key = getMalaysiaDateKey(new Date("2026-08-03T10:00:00+08:00"));
    expect(key).toBe("20260803");
  });
});
