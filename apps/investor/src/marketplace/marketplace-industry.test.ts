import {
  marketplaceIndustryIconKey,
  marketplaceIndustryTone,
} from "./marketplace-industry";

describe("marketplaceIndustryIconKey", () => {
  it("maps known onboarding industries", () => {
    expect(marketplaceIndustryIconKey("Healthcare")).toBe("healthcare");
    expect(marketplaceIndustryIconKey("Technology (ICT)")).toBe("technology");
    expect(marketplaceIndustryIconKey("Wholesale / Retail Trade")).toBe("retail");
  });

  it("falls back for blank or unknown industries", () => {
    expect(marketplaceIndustryIconKey(null)).toBe("generic");
    expect(marketplaceIndustryIconKey("  ")).toBe("generic");
    expect(marketplaceIndustryIconKey("Aerospace")).toBe("generic");
  });
});

describe("marketplaceIndustryTone", () => {
  it("keeps the same industry on the same brand-safe tone", () => {
    expect(marketplaceIndustryTone("Healthcare")).toBe(marketplaceIndustryTone("Healthcare"));
  });

  it("varies tone across different industries", () => {
    const tones = new Set([
      marketplaceIndustryTone("Healthcare"),
      marketplaceIndustryTone("Manufacturing"),
      marketplaceIndustryTone("Education"),
    ]);
    expect(tones.size).toBeGreaterThan(1);
  });
});
