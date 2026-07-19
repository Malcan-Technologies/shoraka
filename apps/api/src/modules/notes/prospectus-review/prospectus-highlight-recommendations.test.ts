import {
  ISSUER_FINANCIAL_STRENGTH_RECOMMENDATIONS,
  PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT,
  buildProspectusHighlightRecommendations,
  normalizePaymasterNatureBucket,
  recommendIssuerFinancialStrengthHighlight,
  recommendPaymasterHighlight,
  recommendReturnHighlight,
} from "@cashsouk/types";

describe("prospectus highlight recommendations", () => {
  it("maps paymaster nature buckets safely", () => {
    expect(normalizePaymasterNatureBucket("Government Agency")).toBe("government");
    expect(normalizePaymasterNatureBucket("Government-Linked Company")).toBe("glc");
    expect(normalizePaymasterNatureBucket("Private Company")).toBe("corporate");
    expect(normalizePaymasterNatureBucket("Trust")).toBe("unknown");
  });

  it("recommends factual paymaster copy without track-record claims", () => {
    const copy = recommendPaymasterHighlight({
      paymasterSnapshot: {
        name: "Kementerian Kerja Raya",
        entity_type: "Government Agency",
      },
    });
    expect(copy.title).toBe("Backed by a government paymaster");
    expect(copy.description).toContain("Kementerian Kerja Raya");
    expect(copy.description).not.toMatch(/track record|proven|guaranteed|reliable/i);
  });

  it("returns DNA paymaster copy when name is missing", () => {
    expect(recommendPaymasterHighlight({ paymasterSnapshot: {} })).toEqual({
      title: "Paymaster information",
      description: "Data not available",
    });
  });

  it("maps every SoukScore grade to a placeholder issuer recommendation", () => {
    for (const grade of ["AAA", "AA", "A", "BBB", "BB", "B"] as const) {
      expect(recommendIssuerFinancialStrengthHighlight({ riskRating: grade })).toEqual(
        ISSUER_FINANCIAL_STRENGTH_RECOMMENDATIONS[grade]
      );
    }
    expect(recommendIssuerFinancialStrengthHighlight({ riskRating: "C" }).description).toBe(
      "Data not available"
    );
  });

  it("recommends return copy from profit rate and tenure", () => {
    const copy = recommendReturnHighlight({
      profitRatePercent: 12,
      listingOpensAt: "2025-05-15T00:00:00.000Z",
      maturityDate: "2025-09-12T00:00:00.000Z",
    });
    expect(copy.title).toBe("12% p.a. over 120 days");
    expect(copy.description).toContain("12% p.a.");
    expect(copy.description).toContain("120 days");
  });

  it("keeps Shariah highlight fixed", () => {
    const all = buildProspectusHighlightRecommendations({});
    expect(all.shariah).toEqual(PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT);
  });
});
