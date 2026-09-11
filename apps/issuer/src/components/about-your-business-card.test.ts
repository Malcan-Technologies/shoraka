import { readFileSync } from "fs";
import { join } from "path";

const card = readFileSync(join(__dirname, "about-your-business-card.tsx"), "utf8");

describe("About your business profile card", () => {
  it("requires Company Activities and main customers from shared metadata", () => {
    expect(card).toContain("isAboutYourBusinessFieldRequired");
    expect(card).toContain("validateAboutYourBusinessForm");
    expect(card).toContain('isAboutYourBusinessFieldRequired("whatDoesCompanyDo")');
    expect(card).toContain('isAboutYourBusinessFieldRequired("mainCustomers")');
    expect(card).toContain("required={activitiesRequired}");
    expect(card).toContain("required={customersRequired}");
    expect(card).not.toContain('label="Company Activities" optional');
    expect(card).not.toContain('label="Who are your main customers?" optional');
    expect(card).not.toContain("PROFILE_REQUIRED_EMPTY_LABEL");
    expect(card).not.toMatch(/Company Activities[\s\S]{0,80}\*/);
  });

  it("keeps concentration and accounting software optional", () => {
    expect(card).toContain("optional={!concentrationRequired}");
    expect(card).toContain("optional={!softwareRequired}");
    expect(card).toContain("required={concentrationRequired}");
    expect(card).toContain("required={softwareRequired}");
  });

  it("shows existing field-error copy on Save when required fields are blank", () => {
    expect(card).toContain("text-meta text-destructive");
    expect(card).toContain("fieldErrors.whatDoesCompanyDo");
    expect(card).toContain("fieldErrors.mainCustomers");
    expect(card).toContain("Complete the required fields.");
  });
});
