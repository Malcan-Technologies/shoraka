import { readFileSync } from "fs";
import { join } from "path";

const panel = readFileSync(join(__dirname, "organization-profile-panel.tsx"), "utf8");
const pic = readFileSync(join(__dirname, "organization-pic-card.tsx"), "utf8");
const detail = readFileSync(join(__dirname, "organization-people-access-detail.tsx"), "utf8");
const screening = readFileSync(join(__dirname, "organization-kyc-response-card.tsx"), "utf8");

describe("Admin company organisation profile", () => {
  it("hides Personal Details (KYC) on company organisations", () => {
    expect(panel).toContain("shouldShowOrganizationPersonalKycCard");
  });

  it("labels the account-owner email instead of a generic company Address", () => {
    expect(panel).toContain("Account owner email");
    expect(panel).not.toContain('label="Address"');
  });

  it("keeps Person in Charge on Organisation, not inside People & Access", () => {
    expect(pic).toContain("Person in Charge");
    expect(pic).toContain("Main company contact. Not a director, shareholder, or platform user unless they also separately appear in People & Access.");
    expect(pic).toContain("Current contact");
    expect(pic).toContain("RegTank evidence");
    expect(pic).toContain("picContactsDiffer");
    expect(panel).toContain("OrganizationPicCard");
  });

  it("shows missing field counts and does not require individual KYC on company shareholders", () => {
    expect(detail).toContain("fields\"} remaining");
    expect(detail).toContain("Individual KYC is not required.");
  });

  it("renames organisation screening so it is not person KYC/AML", () => {
    expect(screening).toContain("Organisation Screening Result");
    expect(screening).toContain("Organisation-level RegTank screening. This is separate from person KYC and AML.");
    expect(screening).not.toContain("KYC/AML Screening Result");
  });
});
