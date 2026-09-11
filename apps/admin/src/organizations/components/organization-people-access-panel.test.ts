import { readFileSync } from "fs";
import { join } from "path";

const panel = readFileSync(join(__dirname, "organization-people-access-panel.tsx"), "utf8");
const detail = readFileSync(join(__dirname, "organization-people-access-detail.tsx"), "utf8");
const page = readFileSync(join(__dirname, "organization-detail-page.tsx"), "utf8");
const overview = readFileSync(join(__dirname, "../utils/organization-profile-overview.ts"), "utf8");
const hook = readFileSync(join(__dirname, "../hooks/use-organization-master-people.ts"), "utf8");
const mismatch = readFileSync(join(__dirname, "organization-external-review-sheet.tsx"), "utf8");
const screening = readFileSync(join(__dirname, "organization-kyc-response-card.tsx"), "utf8");
const ctos = readFileSync(
  join(__dirname, "../../components/organization-issuer-ctos-reports-card.tsx"),
  "utf8"
);
const quickLinks = readFileSync(join(__dirname, "organization-quick-links-card.tsx"), "utf8");
const rail = readFileSync(
  join(__dirname, "../../components/admin-detail/admin-related-records-rail.tsx"),
  "utf8"
);

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

  it("presents person detail without raw internal codes or vague sheet copy", () => {
    expect(panel).toContain('className="sr-only"');
    expect(panel).not.toContain("Admin evidence and actions for this row.");
    expect(detail).not.toContain("REGTANK_PARTY");
    expect(detail).not.toContain("ID_UPLOADED");
    expect(detail).not.toContain("Complete onboarding first");
    expect(detail).not.toContain("label=\"Origin\"");
    expect(detail).not.toContain("label=\"Onboarding ID\"");
    expect(detail).not.toContain("label=\"Director EOD\"");
    expect(detail).toContain("adminPersonHasCtosEvidence");
    expect(detail).toContain("buildAdminPersonRegTankRoleRecords");
    expect(detail).toContain("record.actionLabel");
    expect(detail).toContain("Current profile");
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
    expect(page).not.toContain("hideRail");
  });

  it("keeps organisation screening, CTOS Report History, and Quick Links on the shared right rail", () => {
    expect(page).toContain("AdminRelatedRecordsRail");
    expect(page).toContain("OrganizationIssuerCtosReportsCard");
    expect(page).toContain("OrganizationQuickLinksCard");
    expect(page).toContain("org.kycResponse ?");
    expect(page).not.toContain("hideRail");
    expect(rail).not.toContain("hideRail");
    expect(ctos).toContain("CTOS Report History");
    expect(ctos).toContain("CTOS_UI.fetchReport");
    expect(quickLinks).toContain("Quick Links");
    expect(quickLinks).toContain("Owner account");
    expect(quickLinks).toContain("Organisation reference");
    expect(quickLinks).toContain("Organisation ID");
    expect(screening).toContain("Status:");
    expect(screening).toContain("Risk Level:");
    expect(screening).toContain("Risk Score:");
    expect(screening).toContain("possible");
    expect(screening).toContain("blacklisted");
    expect(screening).toContain("System ID");
    expect(screening).toContain("Request ID");
    expect(screening).toContain("Onboarding ID");
    expect(screening).toContain("Message Status");
    expect(screening).toContain("Screening Date");
    expect(page.indexOf("OrganizationKycResponseCard")).toBeGreaterThan(page.indexOf("AdminRelatedRecordsRail"));
    expect(page.indexOf("OrganizationIssuerCtosReportsCard")).toBeGreaterThan(page.indexOf("AdminRelatedRecordsRail"));
    expect(page.indexOf("OrganizationQuickLinksCard")).toBeGreaterThan(page.indexOf("AdminRelatedRecordsRail"));
  });

  it("opens selected person detail in a drawer instead of replacing the right rail", () => {
    expect(panel).toContain("open={drawerEnabled && Boolean(selected)}");
    expect(panel).toContain('aria-label="Selected person"');
    expect(panel).toContain("sm:max-w-2xl");
    expect(panel).toContain('params.set("person", nextPerson)');
    expect(panel).toContain('params.delete("person")');
    expect(panel).toContain("popstate");
    expect(panel).not.toContain("narrow && Boolean(selected)");
    expect(panel).not.toContain('aria-label="Selected person" className="min-w-0 hidden lg:block"');
    expect(page).toContain("drawerEnabled={resolvedTab === \"people\"}");
  });

  it("keeps person KYC and AML separate from organisation screening", () => {
    expect(panel).toContain(">KYC<");
    expect(panel).toContain(">AML<");
    expect(detail).toContain('value="kyc"');
    expect(detail).toContain('value="aml"');
    expect(detail).toContain("verificationLabel");
    expect(detail).toContain("Business verification (KYB). Individual KYC is not required.");
    expect(screening).toContain("KYC/AML Screening Result");
    expect(screening).not.toContain("KYB/AML Screening Result");
    expect(screening).not.toContain("Organisation Screening Result");
  });

  it("preserves person actions in the selected-person drawer", () => {
    expect(detail).toContain("Complete profile");
    expect(detail).toContain("Adopt");
    expect(mismatch).toContain("Keep current value");
    expect(mismatch).toContain("Use CTOS value");
    expect(panel).toContain("View");
    expect(panel).toContain("Edit");
    expect(panel).toContain("Mark inactive");
  });
});
