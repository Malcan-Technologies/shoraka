import { readFileSync } from "fs";
import { join } from "path";

const profile = readFileSync(join(__dirname, "page.tsx"), "utf8");
const personDetail = readFileSync(join(__dirname, "people/[partyId]/page.tsx"), "utf8");

describe("Investor People & Access", () => {
  it("uses the shared People & Access table for company organisations", () => {
    expect(profile).toContain("PeopleAccessSection");
    expect(profile).toContain('portal="investor"');
    expect(profile).toContain("canEdit={isCurrentUserAdmin}");
    expect(profile).not.toContain("PortalPeopleSection");
    expect(profile).not.toContain("DirectorShareholdersUnifiedSection");
  });

  it("limits People & Access edits to the organisation owner or ORGANIZATION_ADMIN", () => {
    expect(profile).toContain('return currentUserMember?.role === "ORGANIZATION_ADMIN"');
    expect(profile).toContain("if (activeOrganization.isOwner) return true");
  });

  it("enables Mark inactive for investor owner/admin on active company people", () => {
    expect(profile).toContain("canInactivate={isCurrentUserAdmin}");
    expect(personDetail).toContain('canInactivate={isCurrentUserAdmin && activeOrganization.type === "COMPANY"}');
  });

  it("keeps reactivation flow available on investor person detail", () => {
    expect(personDetail).toContain("PersonDetailView");
    expect(personDetail).toContain('portal="investor"');
  });

  it("does not show People & Access on the personal investor Organisation page", () => {
    expect(profile).toContain("{!isPersonal ? (");
    expect(profile).toContain('value="people"');
    expect(profile).toContain("profileTabFromSearchParam(searchParams.get(\"tab\"), Boolean(isCompanyOrg))");
  });
});
