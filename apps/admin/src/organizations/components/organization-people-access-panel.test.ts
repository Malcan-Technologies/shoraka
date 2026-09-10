import { readFileSync } from "fs";
import { join } from "path";

const panel = readFileSync(join(__dirname, "organization-people-access-panel.tsx"), "utf8");
const detail = readFileSync(join(__dirname, "organization-people-access-detail.tsx"), "utf8");
const page = readFileSync(join(__dirname, "organization-detail-page.tsx"), "utf8");
const overview = readFileSync(join(__dirname, "../utils/organization-profile-overview.ts"), "utf8");
const hook = readFileSync(join(__dirname, "../hooks/use-organization-master-people.ts"), "utf8");
const mismatch = readFileSync(join(__dirname, "organization-external-review-sheet.tsx"), "utf8");

describe("Admin People & Access surface", () => {
  it("uses one table with Company Role, Platform Access, KYC, AML, and CTOS", () => {
    expect(panel).toContain(">Name<");
    expect(panel).toContain(">Company Role<");
    expect(panel).toContain(">Platform Access<");
    expect(panel).toContain(">KYC<");
    expect(panel).toContain(">AML<");
    expect(panel).toContain(">CTOS<");
    expect(panel).toContain("buildAdminPeopleAccessRows");
    expect(panel).toContain('title="People & Access"');
    expect(panel).not.toContain("Add person");
    expect(panel).not.toContain("Add Person");
    expect(panel).not.toContain("Invite user");
    expect(panel).not.toContain("Reactivate");
    expect(hook).not.toContain("createParty");
  });

  it("keeps Mark inactive on any MASTER_ACTIVE party and does not add Reactivate", () => {
    expect(detail).toContain("adminMayInactivateMasterParty(party)");
    expect(panel).toContain("adminMayInactivateMasterParty(party)");
    expect(overview).toContain("Admin may mark ANY active organization party as inactive.");
    expect(detail).toContain("Mark inactive");
    expect(detail).not.toContain("Reactivate");
    expect(panel).not.toContain("absentFromLatestExternal &&");
  });

  it("applies the 5% shareholder gate for issuer and investor without a portal split", () => {
    expect(panel).toContain("isIssuerShareholderOnlyBelowMinimum");
    expect(detail).toContain("isIssuerShareholderOnlyBelowMinimum");
    expect(panel).toContain("enforceIssuerShareholderMinimum");
    expect(panel).not.toContain('enforceIssuerShareholderMinimum={portal === "issuer"}');
    expect(detail).not.toContain('portal === "issuer" && isIssuerShareholderOnlyBelowMinimum');
  });

  it("does not invent Admin invite, role-change, send KYC, or ownership-transfer actions", () => {
    expect(panel).not.toContain("Invite user");
    expect(panel).not.toContain("Transfer ownership");
    expect(detail).not.toContain("Send KYC");
    expect(detail).not.toContain("Change access");
    expect(detail).not.toContain("Remove access");
  });

  it("uses Approved rather than Verified for KYC on this surface", () => {
    expect(detail).not.toContain("Verified");
    expect(panel).not.toContain("Verified");
    expect(panel).not.toContain("Organization Member");
    expect(panel).not.toContain("Organization Admin");
  });

  it("preserves existing CTOS actions without fake persistence", () => {
    expect(detail).toContain("Adopt");
    expect(detail).toContain("Keep onboarding Person");
    expect(detail).toContain("Keep CTOS Person");
    expect(mismatch).toContain("Keep current value");
    expect(mismatch).toContain("Use CTOS value");
    expect(detail).toContain("Leave as CTOS observation");
    expect(detail).toContain("This does not save a separate decision.");
    expect(detail).toContain("Leave as current profile");
    expect(detail).toContain("This does not mark the CTOS absence as reviewed.");
    expect(detail).toContain("This person was not found in the latest CTOS information.");
    expect(detail).toContain(
      "Inactive on the current company profile. This is not the same as removing platform access."
    );
  });
});

describe("Admin organisation tabs", () => {
  it("labels People & Access and hides it for personal organisations", () => {
    expect(page).toContain('label: "People & Access"');
    expect(page).toContain('label: "Organisation"');
    expect(page).toContain('label: "Linked Records"');
    expect(page).toContain("isOrgPeopleTabAvailable");
    expect(page).toContain("OrganizationPeopleAccessPanel");
    expect(page).not.toContain("OrganizationPeoplePanel");
  });

  it("sends Review CTOS to People & Access instead of a competing sheet workflow", () => {
    expect(page).toContain('peopleUrl.setFilter("ctos-review")');
    expect(page).not.toContain("OrganizationExternalReviewSheet");
    expect(page).toContain('hideRail={resolvedTab === "people"}');
  });
});
