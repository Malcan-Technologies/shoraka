import { readFileSync } from "fs";
import { join } from "path";

const card = readFileSync(join(__dirname, "organization-person-card.tsx"), "utf8");
const panel = readFileSync(join(__dirname, "organization-people-panel.tsx"), "utf8");
const overview = readFileSync(join(__dirname, "../utils/organization-profile-overview.ts"), "utf8");

describe("Admin People Mark inactive eligibility", () => {
  it("lets Admin mark any MASTER_ACTIVE party inactive, not only CTOS-absent parties", () => {
    expect(card).toContain("adminMayInactivateMasterParty(party)");
    expect(card).toContain("Intentionally allow Admin to mark any MASTER_ACTIVE party inactive.");
    expect(card).toContain("Previous behavior limited this action to CTOS-absent parties.");
    expect(overview).toContain("Admin may mark ANY active organization party as inactive.");
    expect(overview).toContain("This is intentionally not restricted to CTOS-absent parties.");
    expect(panel).toContain("onInactivate={item.party ? () => peopleMutations.inactivate.mutate(item.party!.id) : undefined}");
  });

  it("does not gate the person-card Mark inactive button on CTOS absence", () => {
    const markInactiveBlock = card.slice(
      card.indexOf("adminMayInactivateMasterParty(party)"),
      card.indexOf("New person found in the latest CTOS information.")
    );
    expect(markInactiveBlock).toContain("Mark inactive");
    expect(markInactiveBlock).not.toContain("absentFromLatestExternal");
  });

  it("keeps Mark inactive behind organizations.manage (canManage) and does not add Reactivate or delete", () => {
    expect(card).toContain("canManage && onInactivate && adminMayInactivateMasterParty(party)");
    expect(card).not.toContain("Reactivate");
    expect(card).not.toContain("deleteManagementParty");
    expect(panel).not.toContain("Reactivate");
  });
});

describe("Admin People cannot create a Person", () => {
  it("does not show an Add Person button or create-person dialog", () => {
    const hook = readFileSync(join(__dirname, "../hooks/use-organization-master-people.ts"), "utf8");
    expect(panel).not.toContain("Add person");
    expect(panel).not.toContain("Add Person");
    expect(panel).not.toContain('mode="create"');
    expect(panel).not.toContain("createParty");
    expect(panel).not.toContain("isMinimalOnboardingPersonCreate");
    expect(panel).not.toContain("createAdminPartyProfile");
    expect(panel).not.toContain("setAddOpen");
    expect(hook).not.toContain("createAdminPartyProfile");
    expect(hook).not.toContain("createParty");
  });

  it("still lists existing People and keeps view, edit, and inactivate", () => {
    expect(panel).toContain("unifyOrganizationPeople(org.partyProfiles, org.people)");
    expect(panel).toContain("unified.master.map");
    expect(panel).toContain("onView={() => item.party && setViewingPartyId(item.party.id)}");
    expect(panel).toContain("onEdit={item.party ? () => setEditingPartyId(item.party!.id) : undefined}");
    expect(panel).toContain("onInactivate={item.party ? () => peopleMutations.inactivate.mutate(item.party!.id) : undefined}");
    expect(panel).toContain("title={editingParty?.name || \"Person\"}");
    expect(panel).toContain("Read-only details for this person.");
  });

  it("does not treat platform members as Add Person and leaves member edit in place", () => {
    expect(panel).toContain("Platform members without a company role");
    expect(panel).toContain("OrganizationMemberEditDialog");
    expect(panel).not.toContain("Invite Member");
  });
});

describe("Admin People P2 identity display", () => {
  it("does not show user:{uuid} as government ID and preserves P1 conflict copy", () => {
    expect(card).toContain("Identity:");
    expect(card).toContain("personIdentityDisplay");
    expect(card).toContain("IDENTITY_CONFLICT_ADMIN_TITLE");
    expect(card).toContain("Complete profile");
  });
});
