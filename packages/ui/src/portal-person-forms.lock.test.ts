import { readFileSync } from "fs";
import { join } from "path";

const source = readFileSync(join(__dirname, "portal-person-forms.tsx"), "utf8");

describe("PartyFillEmptyForm lock and officer fields", () => {
  it("does not say roles were verified during onboarding", () => {
    expect(source).toContain("PROFILE_LOCKED_ROLES_CANNOT_CHANGE");
    expect(source).toContain("isIssuerOfficerRole");
  });

  it("saves role checkboxes and does not post personKind", () => {
    expect(source).toContain("isDirector: corporate ? false : isDirector");
    expect(source).toContain("isBoard: corporate ? false : isBoard");
    expect(source).toContain("isManagement: corporate ? false : isManagement");
    expect(source).toContain("SELECT_AT_LEAST_ONE_ROLE_MESSAGE");
    expect(source).not.toContain("personKind:");
  });
});
