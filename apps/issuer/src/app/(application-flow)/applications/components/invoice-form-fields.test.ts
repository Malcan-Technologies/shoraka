import * as fs from "fs";
import * as path from "path";

describe("issuer invoice campaign classification", () => {
  const source = fs.readFileSync(path.join(__dirname, "invoice-form-fields.tsx"), "utf8");

  it("captures Campaign Sector, Company category, and Sustainability Category of the Campaign on the Invoice step", () => {
    expect(source).toContain("SC_MONTHLY_CAMPAIGN.companyCategory.label");
    expect(source).toContain("SC_MONTHLY_CAMPAIGN.campaignSector.label");
    expect(source).toContain("SC_MONTHLY_CAMPAIGN.sustainabilityCategory.label");
    expect(source).toContain("SC_CAMPAIGN_SECTORS");
    expect(source).toContain("SC_COMPANY_CATEGORIES");
    expect(source).toContain("SC_SUSTAINABILITY_CATEGORIES");
    expect(source).not.toContain("Campaign classification");
    expect(source).not.toContain("Company category *");
    expect(source).not.toContain(".label} *");
  });

  it("does not collect Company Activities or issuer Industry on the Invoice step", () => {
    expect(source).not.toContain("Company Activities");
    expect(source).not.toContain("whatDoesCompanyDo");
    expect(source).not.toContain("issuer Industry");
  });
});

describe("invoice step classification field errors", () => {
  it("does not show classification required errors until save is attempted", () => {
    const step = fs.readFileSync(
      path.join(__dirname, "../steps/invoice-details-step.tsx"),
      "utf8"
    );
    expect(step).toContain("if (hasSubmitted) {");
    expect(step).toContain('errors.campaign_sector = "Campaign Sector is required"');
    expect(step).toContain('errors.company_category = "Company category is required"');
  });
});
