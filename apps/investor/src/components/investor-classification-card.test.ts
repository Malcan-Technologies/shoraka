import { readFileSync } from "fs";
import { join } from "path";

describe("investor classification card", () => {
  const source = readFileSync(join(__dirname, "investor-classification-card.tsx"), "utf8");

  it("shows Account class and SC ComRep Investor Type as separate fields", () => {
    expect(source).toContain('label="Account class"');
    expect(source).toContain("SC ComRep Investor Type");
    expect(source).toContain('patchMasterProfile("investor"');
    expect(source).toContain("scInvestorCategory: next");
    expect(source).not.toContain("is_sophisticated_investor");
  });
});
