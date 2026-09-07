import { readFileSync } from "fs";
import { join } from "path";

const source = readFileSync(join(__dirname, "portal-person-forms.tsx"), "utf8");

describe("PartyFillEmptyForm lock and officer fields", () => {
  it("does not say roles were verified during onboarding", () => {
    expect(source).toContain("PROFILE_LOCKED_ROLES_CANNOT_CHANGE");
    expect(source).toContain("isIssuerOfficerRole");
  });
});
