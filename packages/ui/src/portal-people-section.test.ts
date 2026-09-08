import { readFileSync } from "fs";
import { join } from "path";

const source = readFileSync(join(__dirname, "portal-people-section.tsx"), "utf8");

describe("PortalPeopleSection", () => {
  it("shows View details and Edit for current-profile people when permitted", () => {
    expect(source).toContain("View details");
    expect(source).toContain("onEdit={canEdit ? () => setEditPartyId(item.party.id) : undefined}");
    expect(source).toContain("api.patchPartyProfile(portal, organizationId, editing.id, data)");
    expect(source).toContain("api.createManagementParty(portal, organizationId, data)");
  });

  it("keeps MASTER_ACTIVE in the People list and MASTER_INACTIVE in the Inactive section", () => {
    expect(source).toContain('party.membershipStatus === "MASTER_ACTIVE"');
    expect(source).toContain('party.membershipStatus === "MASTER_INACTIVE"');
    expect(source).not.toContain('res.data.filter((party) => party.membershipStatus === "MASTER_ACTIVE")');
    expect(source).toContain('<h3 className="text-card-title">Inactive</h3>');
    expect(source).toContain('label="Inactive"');
  });

  it("lets permitted users mark an active person inactive without delete or reactivate", () => {
    expect(source).toContain("Mark inactive");
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
    expect(source).toContain('} missing');
    expect(source).toContain("Company shareholder. Individual KYC/AML is not required.");
    expect(source).toContain("canSend && !corporate");
  });
});
