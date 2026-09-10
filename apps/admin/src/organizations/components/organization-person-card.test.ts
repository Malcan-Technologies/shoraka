import { readFileSync } from "fs";
import { join } from "path";

const panel = readFileSync(join(__dirname, "organization-people-access-panel.tsx"), "utf8");
const detail = readFileSync(join(__dirname, "organization-people-access-detail.tsx"), "utf8");
const overview = readFileSync(join(__dirname, "../utils/organization-profile-overview.ts"), "utf8");
const hook = readFileSync(join(__dirname, "../hooks/use-organization-master-people.ts"), "utf8");

describe("Admin People Mark inactive eligibility", () => {
  it("lets Admin mark any MASTER_ACTIVE party inactive, not only CTOS-absent parties", () => {
    expect(detail).toContain("adminMayInactivateMasterParty(party)");
    expect(panel).toContain("adminMayInactivateMasterParty(party)");
    expect(overview).toContain("Admin may mark ANY active organization party as inactive.");
    expect(overview).toContain("This is intentionally not restricted to CTOS-absent parties.");
    expect(panel).toContain("onInactivate={() => row.party && peopleMutations.inactivate.mutate(row.party.id)}");
  });

  it("does not gate Mark inactive on CTOS absence", () => {
    const markInactiveBlock = detail.slice(
      detail.indexOf("adminMayInactivateMasterParty(party)"),
      detail.indexOf("New person found in the latest CTOS information.")
    );
    expect(markInactiveBlock).toContain("Mark inactive");
    expect(markInactiveBlock).not.toContain("absentFromLatestExternal");
  });

  it("keeps Mark inactive behind organizations.manage and does not add Reactivate or delete", () => {
    expect(detail).toContain("canManage && Boolean(onInactivate) && adminMayInactivateMasterParty(party)");
    expect(detail).not.toContain("Reactivate");
    expect(detail).not.toContain("deleteManagementParty");
    expect(panel).not.toContain("Reactivate");
  });
});

describe("Admin People cannot create a Person", () => {
  it("does not show an Add Person button or create-person dialog", () => {
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

  it("still lists people in one table and keeps view, edit, and inactivate", () => {
    expect(panel).toContain("buildAdminPeopleAccessRows");
    expect(panel).toContain("filterAdminPeopleAccessRows");
    expect(panel).toContain("onEdit={() => row.party && setEditingPartyId(row.party.id)}");
    expect(panel).toContain("onInactivate={() => row.party && peopleMutations.inactivate.mutate(row.party.id)}");
    expect(panel).toContain('title={editingParty?.name || "Person"}');
  });

  it("shows platform-only users in the same table instead of a separate members section", () => {
    expect(panel).not.toContain("Platform members without a company role");
    expect(panel).toContain("OrganizationMemberEditDialog");
    expect(panel).not.toContain("Invite Member");
    expect(panel).toContain("Platform access");
  });
});

describe("Admin People identity display", () => {
  it("does not show user:{uuid} as government ID and preserves conflict copy", () => {
    expect(detail).toContain("Identity:");
    expect(detail).toContain("personIdentityDisplay");
    expect(detail).toContain("IDENTITY_CONFLICT_ADMIN_TITLE");
    expect(detail).toContain("Complete profile");
  });
});
