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

  it("filters to MASTER_ACTIVE so CTOS-observed people are not edited until adopted", () => {
    expect(source).toContain('res.data.filter((party) => party.membershipStatus === "MASTER_ACTIVE")');
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
