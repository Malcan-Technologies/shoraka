import {
  ISSUER_FINANCIAL_STRENGTH_RECOMMENDATIONS,
  PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT,
  PROSPECTUS_FIXED_SHARIAH_PRINCIPLE,
  buildProspectusHighlightRecommendations,
  normalizePaymasterNatureBucket,
  recommendIssuerFinancialStrengthHighlight,
  recommendPaymasterHighlight,
  recommendReturnHighlight,
} from "@cashsouk/types";
import { normalizeHighlightSelections } from "./prospectus-review-content";

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

  it("recommends Canva Return wording from Profit Rate and Tenure", () => {
    const copy = recommendReturnHighlight({
      profitRatePercent: 12,
      listingOpensAt: "2025-05-15T00:00:00.000Z",
      maturityDate: "2025-09-12T00:00:00.000Z",
    });
    expect(copy.title).toBe("Attractive short-term returns");
    expect(copy.description).toBe(
      "Earn up to 12.0% p.a. for a short investment period of 120 days."
    );
    expect(copy.description).toMatch(/^Earn up to .+ p\.a\. for a short investment period of .+\.$/);
    expect(copy.description).not.toMatch(/expected return|net|after fee/i);
  });

  it("handles partial Return inputs without inventing the other metric", () => {
    expect(
      recommendReturnHighlight({
        profitRatePercent: 12,
        listingOpensAt: null,
        maturityDate: null,
      })
    ).toEqual({
      title: "Attractive short-term returns",
      description: "Earn up to 12.0% p.a.",
    });
    expect(
      recommendReturnHighlight({
        profitRatePercent: null,
        listingOpensAt: "2025-05-15T00:00:00.000Z",
        maturityDate: "2025-09-12T00:00:00.000Z",
      })
    ).toEqual({
      title: "Short-term investment",
      description: "The investment period is 120 days.",
    });
    expect(recommendReturnHighlight({})).toEqual({
      title: "Investment return",
      description: "Data not available",
    });
  });

  it("keeps Shariah highlight fixed to Canva wording and shared principle constant", () => {
    const all = buildProspectusHighlightRecommendations({});
    expect(all.shariah.title).toBe("Shariah-compliant investment");
    expect(all.shariah.description).toBe("Structured under Bai' Al-Dayn Bi Al-Sila'.");
    expect(all.shariah.description).toContain(PROSPECTUS_FIXED_SHARIAH_PRINCIPLE);
    expect(all.shariah).toEqual(PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT);
  });

  it("preserves saved officer Return edits and does not overwrite with recommendations", () => {
    const draft = {
      page1: {
        keyInvestorHighlights: [
          { key: "paymaster", title: "", description: "" },
          { key: "issuer_fundamentals", title: "", description: "" },
          {
            key: "return",
            title: "Officer return title",
            description: "Officer return description",
          },
          { key: "shariah", title: "old", description: "old" },
        ],
      },
      page2: { creditInsights: {}, invoiceWorkStatements: [] },
      page3: { investorTakeaways: {} },
    };
    const normalized = normalizeHighlightSelections(draft, {
      profitRatePercent: 12,
      listingOpensAt: "2025-05-15T00:00:00.000Z",
      maturityDate: "2025-09-12T00:00:00.000Z",
    });
    expect(normalized.page1.keyInvestorHighlights.find((h) => h.key === "return")).toEqual({
      key: "return",
      title: "Officer return title",
      description: "Officer return description",
    });
    expect(normalized.page1.keyInvestorHighlights.find((h) => h.key === "shariah")).toEqual({
      key: "shariah",
      title: PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.title,
      description: PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.description,
    });
  });
});
