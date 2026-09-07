import { readFileSync } from "fs";
import { join } from "path";
import {
  allowedScInvestorCategories,
  SC_INVESTOR_CATEGORY_DEFINITIONS,
  SC_INVESTOR_CATEGORY_LABELS,
  scInvestorCategoryHelp,
} from "@cashsouk/types";

describe("investor classification card", () => {
  const source = readFileSync(join(__dirname, "investor-classification-card.tsx"), "utf8");

  it("shows Sophisticated Investor Yes/No and Type of Investor as separate fields", () => {
    expect(source).toContain('label="Sophisticated Investor"');
    expect(source).toContain('isSophisticatedInvestor ? "Yes" : "No"');
    expect(source).toContain("typeOfInvestor");
    expect(source).not.toContain("SC ComRep Investor Type");
    expect(source).toContain('patchMasterProfile("investor"');
    expect(source).toContain("scInvestorCategory: next");
    expect(source).not.toContain("is_sophisticated_investor");
  });

  it("filters Type of Investor using the existing sophisticated Yes/No result", () => {
    expect(source).toContain("allowedScInvestorCategories(categoryScope)");
    expect(source).toContain("isSophisticatedInvestor");
  });

  it("includes tooltip definitions for all displayed Type of Investor options", () => {
    expect(source).toContain("scInvestorCategoryHelp(options)");
    expect(source).toContain("SC_INVESTOR_CATEGORY_DEFINITIONS");
    const personalYes = allowedScInvestorCategories({
      organizationType: "PERSONAL",
      isSophisticatedInvestor: true,
    });
    const help = scInvestorCategoryHelp(personalYes);
    for (const option of personalYes) {
      expect(help).toContain(SC_INVESTOR_CATEGORY_LABELS[option]);
      expect(help).toContain(SC_INVESTOR_CATEGORY_DEFINITIONS[option]);
    }
  });
});
