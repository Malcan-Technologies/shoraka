import { readFileSync } from "fs";
import { join } from "path";

const card = readFileSync(join(__dirname, "investor-company-details-card.tsx"), "utf8");

describe("Investor company details card", () => {
  it("marks required company fields for read-mode Please fill up without a Profile asterisk", () => {
    expect(card).toContain("required");
    expect(card).toContain('missing={missing.has("dateOfIncorporation")}');
    expect(card).toContain('missing={missing.has("countryOfIncorporation")}');
    expect(card).toContain("required\n              missing={missing.has(\"dateOfIncorporation\")}");
    expect(card).not.toContain("Please fill up");
    expect(card).not.toContain("text-destructive\">*</");
  });
});
