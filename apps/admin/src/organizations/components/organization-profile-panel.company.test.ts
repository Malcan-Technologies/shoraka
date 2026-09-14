import { readFileSync } from "fs";
import { join } from "path";

const panel = readFileSync(join(__dirname, "organization-profile-panel.tsx"), "utf8");
const pic = readFileSync(join(__dirname, "organization-pic-card.tsx"), "utf8");
const detail = readFileSync(join(__dirname, "organization-people-access-detail.tsx"), "utf8");
const page = readFileSync(join(__dirname, "organization-detail-page.tsx"), "utf8");
const helpers = readFileSync(join(__dirname, "organization-profile-helpers.tsx"), "utf8");
const financials = readFileSync(join(__dirname, "organization-financials-panel.tsx"), "utf8");

describe("Admin company organisation profile", () => {
  it("hides Personal Details (KYC) on company organisations", () => {
    expect(panel).toContain("shouldShowOrganizationPersonalKycCard");
  });

  it("labels the account-owner email instead of a generic company Address", () => {
    expect(panel).toContain("PROFILE_LABEL.accountOwnerEmail");
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

  it("requires issuer PIC Full Name and Position on Save, matching application company-details", () => {
    expect(pic).toContain("name: draft.picName");
    expect(pic).toContain("position: draft.picPosition");
    expect(pic).toContain("required={issuerContact}");
    expect(pic).toContain("validateIssuerContactPersonForm");
  });

  it("shows missing field counts and does not require individual KYC on company shareholders", () => {
    expect(detail).toContain("fields remain");
    expect(detail).toContain("Individual KYC is not required.");
  });

  it("does not render a duplicate Organisation verification card", () => {
    expect(panel).not.toContain("Organisation verification");
    expect(panel).not.toContain("verificationCard");
    expect(panel).not.toContain('title="Onboarding Status"');
    expect(panel).not.toContain("Status of this organisation's onboarding.");
    expect(panel).not.toContain("Organisation onboarding status. Person KYC and AML are on People & Access.");
  });

  it("keeps the header onboarding badge", () => {
    expect(page).toContain("getOrganizationOnboardingPresentation");
    expect(page).toContain('completedLabel: "Onboarded"');
    expect(page).toContain("onboardingPresentation.label");
    expect(page).toContain("onboardingPresentation.status");
  });

  it("simplifies Registered and Business Address field labels", () => {
    expect(panel).toContain("PROFILE_LABEL.registeredAddress");
    expect(panel).toContain("PROFILE_LABEL.businessAddress");
    expect(panel).toContain("ADMIN_ORG_ADDRESS_FIELD_LABELS.address");
    expect(panel).toContain("ADMIN_ORG_ADDRESS_FIELD_LABELS.state");
    expect(panel).toContain("ADMIN_ORG_ADDRESS_FIELD_LABELS.postcode");
    expect(panel).not.toContain("label={SC_MONTHLY_ISSUER.registeredAddressState.label}");
    expect(panel).not.toContain("label={SC_MONTHLY_ISSUER.registeredAddressPostcode.label}");
    expect(panel).not.toContain("label={SC_MONTHLY_ISSUER.businessAddressState.label}");
    expect(panel).not.toContain("label={SC_MONTHLY_ISSUER.businessAddressPostcode.label}");
    expect(panel).not.toContain("stateLabel={SC_MONTHLY_ISSUER.registeredAddressState.label}");
    expect(panel).not.toContain("postcodeLabel={SC_MONTHLY_ISSUER.registeredAddressPostcode.label}");
    expect(panel).not.toContain("stateLabel={SC_MONTHLY_ISSUER.businessAddressState.label}");
    expect(panel).not.toContain("postcodeLabel={SC_MONTHLY_ISSUER.businessAddressPostcode.label}");
    expect(panel).not.toContain("lineLabel={SC_MONTHLY_ISSUER.registeredAddress.label}");
    expect(panel).not.toContain("lineLabel={SC_MONTHLY_ISSUER.businessAddress.label}");
    expect(helpers).toContain("showHeading");
  });

  it("does not forward customer Please fill up requiredness from Admin ReadField", () => {
    const readField = helpers.slice(
      helpers.indexOf("export function ReadField"),
      helpers.indexOf("export function EditableField")
    );
    expect(readField).not.toContain("required={required}");
    expect(readField).not.toContain("PROFILE_REQUIRED_EMPTY_LABEL");
    expect(readField).toContain("customer empty-required prompt");
  });

  it("renders Wealth Declaration in the documents / onboarding evidence area when DTO JSON exists", () => {
    expect(panel).toContain("adminOnboardingEvidenceCards");
    expect(panel).toContain("wealthDeclaration: org.wealthDeclaration");
    expect(panel.indexOf("evidenceCards.map")).toBeGreaterThan(panel.indexOf('title="Documents"'));
  });

  it("does not render individual KYC document fields on company organisations", () => {
    expect(panel).toContain('org.type !== "COMPANY"');
    expect(panel).toContain('label="Document Type"');
    expect(panel).toContain("corporateRequiredDocuments");
  });

  it("shows organisation financials as read-only submitted history", () => {
    expect(financials).toContain("ProfileFinancialHistory");
    expect(financials).toContain("Financial history from submitted financing applications.");
    expect(financials).not.toContain("required fields missing");
    expect(financials).not.toContain("isEditing");
    expect(financials).not.toContain("patchIssuerOrgFinancials");
  });
});
