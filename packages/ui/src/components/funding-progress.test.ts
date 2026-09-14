import { DEFAULT_FUNDING_THRESHOLD_PERCENT, resolveFundingThresholdPercent } from "./funding-progress";

describe("funding threshold marker", () => {
  it("defaults missing values to 80%", () => {
    expect(DEFAULT_FUNDING_THRESHOLD_PERCENT).toBe(80);
    expect(resolveFundingThresholdPercent()).toBe(80);
    expect(resolveFundingThresholdPercent(null)).toBe(80);
  });

  it("keeps a custom minimum below 100%", () => {
    expect(resolveFundingThresholdPercent(75)).toBe(75);
  });

  it("hides the marker at 0 or 100", () => {
    expect(resolveFundingThresholdPercent(0)).toBeNull();
    expect(resolveFundingThresholdPercent(100)).toBeNull();
  });
});
