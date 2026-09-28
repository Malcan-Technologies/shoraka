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

  it("shows only Type of Investor (no Sophisticated Yes/No)", () => {
    expect(source).toContain("PROFILE_LABEL.typeOfInvestor");
    expect(source).toContain("PROFILE_HELP.typeOfInvestor");
    expect(source).not.toContain("PROFILE_LABEL.sophisticatedInvestor");
    expect(source).not.toContain('name={`sophisticated-investor-');
    expect(source).not.toContain("sophisticatedChosen");
    expect(source).not.toContain("scInvestorCategoryAfterSophisticatedChange");
    expect(source).not.toContain("SELECT_SOPHISTICATED_INVESTOR_FIRST_MESSAGE");

    expect(source).toContain('patchMasterProfile("investor"');
    expect(source).toContain("scInvestorCategory:");
    expect(source).toContain("Save changes");
  });

  it("keeps a Type of Investor dropdown with defined placeholders", () => {
    expect(source).toContain('placeholder="Select"');
    expect(source).toContain("SelectValue placeholder=\"Select\"");
  });

  it("includes tooltip definitions for all displayed Type of Investor options", () => {
    expect(source).toContain("scInvestorCategoryHelp(options)");
    expect(source).toContain("SC_INVESTOR_CATEGORY_DEFINITIONS");

    const personal = allowedScInvestorCategories({ organizationType: "PERSONAL" });
    const help = scInvestorCategoryHelp(personal);
    for (const option of personal) {
      expect(help).toContain(SC_INVESTOR_CATEGORY_LABELS[option]);
      expect(help).toContain(SC_INVESTOR_CATEGORY_DEFINITIONS[option]);
    }
  });
});
