import { readFileSync } from "fs";
import { join } from "path";

const profile = readFileSync(join(__dirname, "page.tsx"), "utf8");

describe("Investor People section", () => {
  it("uses the shared People editor with View details and Edit for org admins", () => {
    expect(profile).toContain("PortalPeopleSection");
    expect(profile).toContain('portal="investor"');
    expect(profile).toContain("canEdit={isCurrentUserAdmin}");
    expect(profile).not.toContain("DirectorShareholdersUnifiedSection");
  });

  it("limits Investor People Edit to the organisation owner or ORGANIZATION_ADMIN", () => {
    expect(profile).toContain('return currentUserMember?.role === "ORGANIZATION_ADMIN"');
    expect(profile).toContain("if (activeOrganization.isOwner) return true");
  });

  it("does not enable issuer Mark inactive on the investor People section", () => {
    expect(profile).not.toContain("canInactivate");
  });
});
