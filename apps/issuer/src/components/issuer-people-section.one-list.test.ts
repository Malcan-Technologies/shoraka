import { readFileSync } from "fs";
import { join } from "path";

const profile = readFileSync(join(__dirname, "../app/profile/page.tsx"), "utf8");
const peopleAccess = readFileSync(
  join(__dirname, "../../../../packages/ui/src/people-access/people-access-section.tsx"),
  "utf8"
);

describe("Issuer People & Access", () => {
  it("uses the shared People & Access table for company organisations", () => {
    expect(profile).toContain("PeopleAccessSection");
    expect(profile).toContain('portal="issuer"');
    expect(profile).toContain("canEdit={isCurrentUserAdmin}");
    expect(profile).toContain("canInactivate={isCurrentUserAdmin}");
    expect(profile).not.toContain("IssuerPeopleSection");
    expect(profile).not.toContain("PortalPeopleSection");
  });

  it("does not keep a Members tab or People list on the Profile tab", () => {
    expect(profile).toContain('value="people"');
    expect(profile).toContain("People & Access");
    expect(profile).not.toContain('value="members"');
    expect(profile).not.toContain("id=\"profile-people\"");
  });

  it("keeps inactive people out of the default table", () => {
    expect(peopleAccess).toContain("Inactive company people");
  });
});
