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

describe("Admin People P2 onboarding add and identity display", () => {
  it("keeps a minimal individual add path and full corporate/board/management add", () => {
    const editor = readFileSync(join(__dirname, "organization-person-editor-dialog.tsx"), "utf8");
    expect(editor).toContain("minimalOnboardingAdd");
    expect(editor).toContain("validateOnboardingPersonCreate");
    expect(editor).toContain('label={minimalOnboardingAdd ? "Full Name" : copy.name.label}');
    expect(panel).toContain('mode="create"');
    expect(panel).toContain("isMinimalOnboardingPersonCreate");
  });

  it("does not show user:{uuid} as government ID and preserves P1 conflict copy", () => {
    expect(card).toContain("Identity:");
    expect(card).toContain("personIdentityDisplay");
    expect(card).toContain("IDENTITY_CONFLICT_ADMIN_TITLE");
    expect(card).toContain("Complete profile");
  });
});
