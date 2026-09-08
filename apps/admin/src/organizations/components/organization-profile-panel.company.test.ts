import { readFileSync } from "fs";
import { join } from "path";

const panel = readFileSync(join(__dirname, "organization-profile-panel.tsx"), "utf8");
const people = readFileSync(join(__dirname, "organization-people-panel.tsx"), "utf8");
const personCard = readFileSync(join(__dirname, "organization-person-card.tsx"), "utf8");

describe("Admin company organisation profile", () => {
  it("hides Personal Details (KYC) on company organisations", () => {
    expect(panel).toContain("shouldShowOrganizationPersonalKycCard");
  });

  it("labels the account-owner email instead of a generic company Address", () => {
    expect(panel).toContain("Account owner email");
    expect(panel).not.toContain('label="Address"');
  });

  it("keeps Person in Charge as the company contact person", () => {
    expect(people).toContain("Person in Charge");
    expect(people).toContain("Main contact person for this company.");
  });

  it("shows missing field counts and does not require KYC/AML on company shareholders", () => {
    expect(personCard).toContain("} missing");
    expect(personCard).toContain("Company shareholder. Individual KYC/AML is not required.");
  });
});
