import * as fs from "fs";
import * as path from "path";

describe("issuer invoice campaign classification", () => {
  const source = fs.readFileSync(path.join(__dirname, "invoice-form-fields.tsx"), "utf8");

  it("captures Company category and Sustainability Category of the Campaign on the Invoice step", () => {
    expect(source).toContain("Campaign classification");
    expect(source).toContain("Company category *");
    expect(source).toContain("SC_MONTHLY_CAMPAIGN.sustainabilityCategory.label");
    expect(source).toContain("SC_COMPANY_CATEGORIES");
    expect(source).toContain("SC_SUSTAINABILITY_CATEGORIES");
  });

  it("does not collect Company Activities on the Invoice step", () => {
    expect(source).not.toContain("Company Activities");
    expect(source).not.toContain("whatDoesCompanyDo");
  });
});
