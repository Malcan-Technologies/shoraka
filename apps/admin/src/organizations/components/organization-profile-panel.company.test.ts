import { readFileSync } from "fs";
import { join } from "path";

const panel = readFileSync(join(__dirname, "organization-profile-panel.tsx"), "utf8");
const pic = readFileSync(join(__dirname, "organization-pic-card.tsx"), "utf8");
const detail = readFileSync(join(__dirname, "organization-people-access-detail.tsx"), "utf8");

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

  it("labels onboarding status without mixing in person KYC/AML", () => {
    expect(panel).toContain('title="Onboarding Status"');
    expect(panel).toContain("Status of this organisation's onboarding.");
    expect(panel).not.toContain("Organisation verification");
    expect(panel).not.toContain("Organisation onboarding status. Person KYC and AML are on People & Access.");
  });

  it("renders Wealth Declaration in the documents / onboarding evidence area when DTO JSON exists", () => {
    expect(panel).toContain("adminOnboardingEvidenceCards");
    expect(panel).toContain("wealthDeclaration: org.wealthDeclaration");
    expect(panel.indexOf("evidenceCards.map")).toBeGreaterThan(panel.indexOf('title="Documents"'));
    expect(panel.indexOf("evidenceCards.map")).toBeLessThan(
      panel.lastIndexOf("{org.type === \"COMPANY\" ? verificationCard : null}")
    );
  });
});
