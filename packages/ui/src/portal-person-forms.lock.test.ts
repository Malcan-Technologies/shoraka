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

  it("does not automatically set Board when Director is selected", () => {
    expect(source).not.toContain("setIsBoard(isDirector");
    expect(source).not.toContain("setIsBoard(true)");
    expect(source).toContain('<RoleCheck label="Director" checked={isDirector} onChange={setIsDirector} />');
    expect(source).toContain(
      "<RoleCheck label={SC_MONTHLY_PERSON_KIND_LABELS.BOARD} checked={isBoard} onChange={setIsBoard} />"
    );
    expect(source).toContain(
      "<RoleCheck label={SC_MONTHLY_PERSON_KIND_LABELS.MANAGEMENT} checked={isManagement} onChange={setIsManagement} />"
    );
  });

  it("uses a minimal individual Director/Shareholder add form", () => {
    expect(source).toContain("minimalOnboardingAdd");
    expect(source).toContain("addCompanyPersonUsesOnboardingFlow");
    expect(source).toContain("onboardingRolesSelected");
    expect(source).toContain('label="Full Name"');
    expect(source).toContain('label="Person Email"');
    expect(source).toContain("validateOnboardingPersonCreate");
    expect(source).toContain('label={copy.identity.label}');
  });

  it("switches to the onboarding field set when Director or Shareholder is selected", () => {
    expect(source).toContain("ADD_COMPANY_PERSON_ONBOARDING_HELP");
    expect(source).toContain("ADD_COMPANY_PERSON_MANUAL_HELP");
    expect(source).not.toContain("!corporate && !showOfficer &&");
    expect(source).toContain("onboardingRolesSelected && !String(initial?.identityNumber ?? \"\").trim()");
  });

  it("hides manual identity fields on the onboarding path and does not submit them", () => {
    const start = source.indexOf('entityType: "INDIVIDUAL"');
    const onboardingPayload = source.slice(start, source.indexOf("entityType,", start));
    expect(onboardingPayload).toContain("email: form.email || null");
    expect(onboardingPayload).toContain("isBoard,");
    expect(onboardingPayload).toContain("isManagement,");
    expect(onboardingPayload).not.toContain("salutation:");
    expect(onboardingPayload).not.toContain("identityNumber:");
    expect(onboardingPayload).not.toContain("dateOfBirth:");
    expect(onboardingPayload).not.toContain("gender:");
    expect(onboardingPayload).not.toContain("nationality:");
    expect(onboardingPayload).not.toContain("address:");
    expect(source).toContain("{minimalOnboardingAdd ? (");
    expect(source).toContain('label={copy.salutation.label}');
    expect(source).toContain('label={copy.identityPrefix.label}');
    expect(source).toContain('label="Address line 2"');
  });

  it("lets later edit fill empty identity prefix and number", () => {
    expect(source).toContain("identityNumberEmpty");
    expect(source).toContain("identityPrefixEmpty");
    expect(source).toContain("if (identityNumberEmpty && form.identityNumber) data.identityNumber = form.identityNumber");
  });
});
