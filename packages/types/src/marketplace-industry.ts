export const MARKETPLACE_INDUSTRY_ICON_KEYS = [
  "agriculture",
  "manufacturing",
  "construction",
  "retail",
  "transport",
  "hospitality",
  "food",
  "communications",
  "technology",
  "insurance",
  "legal",
  "education",
  "healthcare",
  "realEstate",
  "publicSector",
  "media",
  "generic",
] as const;

export type MarketplaceIndustryIconKey = (typeof MARKETPLACE_INDUSTRY_ICON_KEYS)[number];

export type MarketplaceIndustryTone = "muted" | "taupe" | "brand";

const INDUSTRY_ICON_BY_LABEL: Record<string, MarketplaceIndustryIconKey> = {
  "Agriculture, Forestry, Fishing": "agriculture",
  Manufacturing: "manufacturing",
  Construction: "construction",
  "Wholesale / Retail Trade": "retail",
  Transportation: "transport",
  Hospitality: "hospitality",
  "Food & Beverage": "food",
  "Information & Communication": "communications",
  "Technology (ICT)": "technology",
  Insurance: "insurance",
  "Legal Accounting": "legal",
  Education: "education",
  Healthcare: "healthcare",
  "Real Estate": "realEstate",
  "Public Sector & Government": "publicSector",
  "Arts, Media & Entertainment": "media",
  Others: "generic",
};

const TONES: MarketplaceIndustryTone[] = ["muted", "taupe", "brand"];

export function marketplaceIndustryIconKey(
  industry: string | null | undefined
): MarketplaceIndustryIconKey {
  const label = industry?.trim() ?? "";
  if (!label) return "generic";
  return INDUSTRY_ICON_BY_LABEL[label] ?? "generic";
}

export function marketplaceIndustryTone(
  industry: string | null | undefined
): MarketplaceIndustryTone {
  const label = industry?.trim() ?? "";
  if (!label) return "muted";
  const hash = [...label].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return TONES[hash % TONES.length] ?? "muted";
}
