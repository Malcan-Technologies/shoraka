import {
  MARKETPLACE_TENURE_FILTER_LABELS,
  marketplaceTenureFilterLabel,
  matchesMarketplaceTenureFilter,
} from "./marketplace-tenure-filter";

describe("marketplace tenure filter bands", () => {
  it("splits the 30–180 published tenures across short / medium / long", () => {
    expect(MARKETPLACE_TENURE_FILTER_LABELS.short).toBe("Up to 60 days");
    expect(matchesMarketplaceTenureFilter(30, "short")).toBe(true);
    expect(matchesMarketplaceTenureFilter(60, "short")).toBe(true);
    expect(matchesMarketplaceTenureFilter(75, "short")).toBe(false);

    expect(matchesMarketplaceTenureFilter(75, "medium")).toBe(true);
    expect(matchesMarketplaceTenureFilter(90, "medium")).toBe(true);
    expect(matchesMarketplaceTenureFilter(120, "medium")).toBe(true);
    expect(matchesMarketplaceTenureFilter(60, "medium")).toBe(false);
    expect(matchesMarketplaceTenureFilter(135, "medium")).toBe(false);

    expect(matchesMarketplaceTenureFilter(135, "long")).toBe(true);
    expect(matchesMarketplaceTenureFilter(180, "long")).toBe(true);
    expect(matchesMarketplaceTenureFilter(120, "long")).toBe(false);
  });

  it("treats all as a pass and rejects missing days on a band", () => {
    expect(matchesMarketplaceTenureFilter(null, "all")).toBe(true);
    expect(matchesMarketplaceTenureFilter(90, "all")).toBe(true);
    expect(matchesMarketplaceTenureFilter(null, "medium")).toBe(false);
    expect(matchesMarketplaceTenureFilter(-1, "short")).toBe(false);
    expect(marketplaceTenureFilterLabel("medium")).toBe("61 – 120 days");
    expect(marketplaceTenureFilterLabel("all")).toBeNull();
  });
});
