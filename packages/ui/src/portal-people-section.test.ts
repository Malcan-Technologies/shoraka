import { readFileSync } from "fs";
import { join } from "path";

const source = readFileSync(join(__dirname, "portal-people-section.tsx"), "utf8");
const card = readFileSync(join(__dirname, "person-identity-card.tsx"), "utf8");
const ctos = readFileSync(join(__dirname, "party-ctos-indicator.tsx"), "utf8");

describe("PortalPeopleSection", () => {
  it("shows View details and Edit for current-profile people when permitted", () => {
    expect(card).toContain("View details");
    expect(source).toContain("onEdit={canEdit ? () => setEditPartyId(item.party.id) : undefined}");
    expect(source).toContain("api.patchPartyProfile(portal, organizationId, editing.id, data)");
    expect(source).toContain("api.createManagementParty(portal, organizationId, data)");
  });

  it("keeps MASTER_ACTIVE in the People list and MASTER_INACTIVE in the Inactive section", () => {
    expect(source).toContain('party.membershipStatus === "MASTER_ACTIVE"');
    expect(source).toContain('party.membershipStatus === "MASTER_INACTIVE"');
    expect(source).not.toContain('res.data.filter((party) => party.membershipStatus === "MASTER_ACTIVE")');
    expect(source).toContain('<h3 className="text-card-title">Inactive</h3>');
    expect(card).toContain('label="Inactive"');
  });

  it("lets permitted users mark an active person inactive without delete or reactivate", () => {
    expect(card).toContain("Mark inactive");
    expect(source).toContain(
      "Mark this person as inactive? Their existing KYC, AML and onboarding history will be kept."
    );
    expect(source).toContain("api.inactivatePartyProfile(portal, organizationId, inactivating.id)");
    expect(source).toContain("onInactivate={canInactivate ? () => setInactivatePartyId(item.party.id) : undefined}");
    expect(source).not.toContain("deleteManagementParty");
    expect(source).not.toContain("Reactivate");
  });

  it("people-only rows reuse add/merge instead of creating a second editor", () => {
    expect(source).toContain("setAddInitial");
    expect(source).toContain("onView={() => setViewPeopleOnlyKey(person.matchKey)}");
  });

  it("shows how many profile fields are missing and hides KYC/AML for company shareholders", () => {
    expect(card).toContain("} missing");
    expect(card).toContain("Company shareholder. Individual KYC/AML is not required.");
    expect(source).toContain("canSendOnboarding={Boolean(");
  });

  it("keeps platform invite separate from RegTank onboarding", () => {
    expect(card).toContain("Invite to platform");
    expect(card).toContain("Restore access");
    expect(card).toContain("NO_PLATFORM_ACCESS");
    expect(card).toContain("Send onboarding");
    expect(source).toContain("KYC/AML onboarding is separate from platform access");
    expect(source).toContain("/members/invite");
    expect(source).toContain("send-director-onboarding");
    expect(source).toContain("restoreExistingLink");
  });

  it("gates invite and manage access on canEdit (owner/admin)", () => {
    expect(source).toContain("canManagePlatform={canEdit}");
    expect(card).toContain("canManagePlatform");
  });
});

describe("Person-scoped invite dialog", () => {
  it("requires an addressed email for Copy Link and uses Restore access for linked users without membership", () => {
    const dialog = readFileSync(join(__dirname, "invite-member-dialog.tsx"), "utf8");
    expect(dialog).toContain("restoreExistingLink");
    expect(dialog).toContain("Platform login email");
    expect(dialog).toContain("Enter an invitation email before copying a person-scoped link");
    expect(dialog).toContain("personContext && !email.trim()");
    expect(dialog).toContain('? "Restore access"');
  });
});

describe("Person identity card CTOS indicator", () => {
  it("explains that CTOS matched is latest comparison, not origin", () => {
    expect(ctos).toContain("It does NOT merely mean the record originally came from CTOS");
    expect(ctos).toContain("aria-label={comparison.tooltip}");
    expect(card).toContain("PartyCtosIndicator");
  });

  it("does not infer Person ↔ User from email", () => {
    expect(card).toContain("Do not infer this link from email alone");
    expect(source).toContain("Onboarding email is for delivery only");
  });
});
