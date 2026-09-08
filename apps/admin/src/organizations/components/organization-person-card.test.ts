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
