import { readFileSync } from "fs";
import { join } from "path";

const section = readFileSync(join(__dirname, "people-access-section.tsx"), "utf8");
const invite = readFileSync(join(__dirname, "invite-user-dialog.tsx"), "utf8");
const detail = readFileSync(join(__dirname, "person-detail-view.tsx"), "utf8");
const overview = readFileSync(join(__dirname, "customer-person-overview.tsx"), "utf8");
const identityCard = readFileSync(join(__dirname, "../person-identity-card.tsx"), "utf8");
const partyFields = readFileSync(join(__dirname, "../party-profile-detail-fields.tsx"), "utf8");
const adminPersonCard = readFileSync(
  join(__dirname, "../../../../apps/admin/src/organizations/components/organization-person-card.tsx"),
  "utf8"
);
const adminPeopleDetail = readFileSync(
  join(__dirname, "../../../../apps/admin/src/organizations/components/organization-people-access-detail.tsx"),
  "utf8"
);

describe("People & Access customer UI", () => {
  it("uses one table with Company Role, Platform Access, KYC/KYB and AML", () => {
    expect(section).toContain(">Company Role<");
    expect(section).toContain(">Platform Access<");
    expect(section).toContain(">KYC/KYB<");
    expect(section).toContain(">AML<");
    expect(section).not.toContain(">Status<");
    expect(section).toContain("Add company person");
    expect(section).toContain("Invite user");
    expect(section).toContain("Inactive company people");
  });

  it("does not merge rows by email", () => {
    expect(section).toContain("buildPeopleAccessRows");
    expect(section).not.toContain("find((row) => row.email");
    expect(invite).toContain("does not link records by email");
  });

  it("keeps Person Email and Account Email distinct", () => {
    expect(invite).toContain("Prefills Person Email for delivery");
    expect(detail).toContain('label="Person Email"');
    expect(detail).toContain('label="Account Email"');
    expect(detail).toContain("isPersonEmailLifecycleLocked");
    expect(detail).toContain("/ctos-party-email");
    expect(detail).toContain("customerPersonEmail");
    expect(detail).toContain("customerAccountEmail");
    expect(detail).not.toContain("party.email || joinedPerson?.email");
  });

  it("does not create a second KYC request while IN_PROGRESS", () => {
    expect(detail).toContain("!inProgressKyc");
    expect(detail).toContain("An onboarding request is already in progress");
    expect(section).toContain('!== "IN_PROGRESS"');
  });

  it("shows a compact later-added party refresh control on non-final KYC and AML", () => {
    expect(section).toContain("shouldShowPartyKycRefresh");
    expect(section).toContain("shouldShowPartyAmlRefresh");
    expect(section).toContain("PartyStatusRefreshControl");
    expect(section).toContain("refreshPartyRegTankStatus");
    expect(section).toContain("relatedPartyVerificationCaption");
    expect(detail).toContain("refreshPartyRegTankStatus");
    expect(detail).toContain("PartyStatusRefreshControl");
    expect(detail).not.toContain("refresh-aml");
  });

  it("treats Owner as platform ownership and User as ORGANIZATION_MEMBER", () => {
    expect(invite).toContain(">User<");
    expect(invite).toContain(">Admin<");
    expect(invite).not.toContain("ORGANIZATION_OWNER");
    expect(section).toContain("Transfer CashSouk organisation ownership");
    expect(detail).toContain("Transfer CashSouk organisation ownership");
  });
});

describe("customer person Profile mapping and privacy", () => {
  it("shows KYC ID only from the KYC* helper and never relabels EOD/COD/LD", () => {
    expect(detail).toContain("customerKycId");
    expect(detail).toContain("customerKybId");
    expect(detail).not.toContain("joinedPerson?.requestId || onboardingId");
    expect(detail).not.toContain('label="Request ID"');
    expect(detail).not.toContain('label="Onboarding stage"');
    expect(detail).not.toContain('label="Screening ID"');
  });

  it("does not expose RegTank admin portal links", () => {
    expect(detail).not.toContain("regtank.com");
    expect(detail).not.toContain("getRegtank");
    expect(detail).not.toContain("Open in RegTank");
    expect(detail).not.toContain("new RegTank request");
  });

  it("uses KYB for corporate people and hides Platform Access", () => {
    expect(detail).toContain('corporate ? "KYB" : "KYC"');
    expect(detail).toContain("showAccessTab = !corporate");
    expect(detail).toContain("KYB Verification");
  });

  it("edits Person Email in the shared Profile edit lifecycle", () => {
    expect(detail).toContain("emailLocked={emailLocked}");
    expect(detail).toContain("PartyFillEmptyForm");
    expect(detail).not.toContain("Save Person Email");
  });

  it("places Mark inactive in page-level more actions, not Platform Access", () => {
    expect(detail).toContain('aria-label="More actions"');
    expect(detail).toContain("Mark inactive");
    expect(detail.indexOf('setConfirm("inactivate")')).toBeLessThan(detail.indexOf('value="access"'));
  });

  it("does not expose CTOS comparison copy on customer person Profile", () => {
    const customerUi = [detail, overview, identityCard, section].join("\n");
    expect(customerUi).not.toContain("Latest CTOS information");
    expect(customerUi).not.toContain("not found in the latest CTOS");
    expect(customerUi).not.toContain("CTOS matched");
    expect(customerUi).not.toContain("CTOS differs");
    expect(customerUi).not.toContain("PartyCtosIndicator");
    expect(customerUi).not.toContain("includeCtosEvidence: true");
    expect(section).toContain("resolveCustomerDirectorShareholderEmptyWarning");
    expect(section).not.toContain("resolveDirectorShareholderCtosEmptyWarning");
    expect(overview).toContain("buildCustomerPersonOverviewSections");
  });

  it("keeps Admin CTOS presentation unchanged", () => {
    expect(partyFields).toContain("Latest CTOS information");
    expect(partyFields).toContain('includeCtosEvidence: statusViewer === "admin"');
    expect(adminPersonCard).toContain("PartyCtosIndicator");
    expect(adminPeopleDetail).toContain("CtosEvidence");
    expect(adminPeopleDetail).toContain("the latest CTOS information");
  });
});

describe("Add company person role-driven onboarding", () => {
  const forms = readFileSync(join(__dirname, "../portal-person-forms.tsx"), "utf8");

  it("creates then sends RegTank onboarding for Director/Shareholder roles only", () => {
    const addSaveStart = section.indexOf("api.createManagementParty(portal, organizationId, data)");
    const addSave = section.slice(addSaveStart, addSaveStart + 1400);
    expect(addSave).toContain("addCompanyPersonUsesOnboardingFlow");
    expect(addSave).toContain("send-director-onboarding");
    expect(addSave).toContain("partyKey: res.data.partyKey");
    expect(addSave).not.toContain("/members/invite");
  });

  it("switches helper copy with the selected roles", () => {
    expect(forms).toContain("ADD_COMPANY_PERSON_ONBOARDING_HELP");
    expect(forms).toContain("ADD_COMPANY_PERSON_MANUAL_HELP");
    expect(forms).toContain("onboardingRolesSelected ? ADD_COMPANY_PERSON_ONBOARDING_HELP : ADD_COMPANY_PERSON_MANUAL_HELP");
  });

  it("keeps existing row-level send/resend and platform invite unchanged", () => {
    expect(section).toContain("const sendOnboarding = async");
    expect(section).toContain("Email saved and onboarding link sent");
    expect(section).toContain("InviteUserDialog");
    expect(section).toContain("/members/invite");
    expect(section).toContain("Invite user");
  });
});
