import { readFileSync } from "fs";
import { join } from "path";
import {
  allowedScInvestorCategories,
  SC_INVESTOR_CATEGORY_DEFINITIONS,
  SC_INVESTOR_CATEGORY_LABELS,
  scInvestorCategoryAfterSophisticatedChange,
  scInvestorCategoryHelp,
} from "@cashsouk/types";

describe("investor classification card", () => {
  const source = readFileSync(join(__dirname, "investor-classification-card.tsx"), "utf8");

  it("shows Sophisticated Investor Yes/No and Type of Investor as separate required fields", () => {
    expect(source).toContain('label="Sophisticated Investor"');
    expect(source).toContain("typeOfInvestor");
    expect(source).toContain("isSophisticatedInvestor: next");
    expect(source).not.toContain("SC ComRep Investor Type");
    expect(source).toContain('patchMasterProfile("investor"');
    expect(source).toContain("scInvestorCategory: next");
  });

  it("does not auto-select Type of Investor", () => {
    expect(source).toContain('placeholder="Select"');
    expect(source).toContain("scInvestorCategoryAfterSophisticatedChange");
    expect(source).toContain("SELECT_SOPHISTICATED_INVESTOR_FIRST_MESSAGE");
    expect(source).not.toContain("Company organization");
    expect(
      scInvestorCategoryAfterSophisticatedChange(null, {
        organizationType: "COMPANY",
        isSophisticatedInvestor: false,
      })
    ).toBeNull();
  });

  it("disables Type of Investor until Sophisticated Investor is chosen", () => {
    expect(source).toContain("SELECT_SOPHISTICATED_INVESTOR_FIRST_MESSAGE");
    expect(source).toContain("!sophisticatedChosen");
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
