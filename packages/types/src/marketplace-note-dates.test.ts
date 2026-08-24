import { resolveMarketplaceDaysToMaturity } from "./marketplace-note-dates";

describe("resolveMarketplaceDaysToMaturity", () => {
  const now = new Date("2026-08-24T04:00:00.000Z");

  it("counts Malaysia calendar days and clamps past dates for filters", () => {
    expect(resolveMarketplaceDaysToMaturity("2026-09-12T00:00:00.000Z", now)).toBe(19);
    expect(resolveMarketplaceDaysToMaturity("2026-08-24T00:00:00.000Z", now)).toBe(0);
    expect(resolveMarketplaceDaysToMaturity("2026-08-20T00:00:00.000Z", now)).toBe(0);
    expect(resolveMarketplaceDaysToMaturity(null, now)).toBeNull();
    expect(resolveMarketplaceDaysToMaturity("not-a-date", now)).toBeNull();
  });
});
