import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(relative: string): string {
  return readFileSync(join(__dirname, relative), "utf8");
}

describe("Shoraka Profile Signing & Authorisation", () => {
  const page = source("./page.tsx");
  const section = source("./shoraka-signing-authorisation-section.tsx");

  it("adds a Signing & Authorisation tab on Shoraka Profile", () => {
    expect(page).toContain('{ id: "signing", label: "Signing & Authorisation" }');
    expect(page).toContain("<ShorakaSigningAuthorisationSection");
    expect(page).toContain('AdminDetailTabPanel value="signing"');
  });

  it("shows company stamp preview, upload, and replace against the existing stored asset", () => {
    expect(section).toContain("Signing & Authorisation");
    expect(section).toContain("Company Stamp");
    expect(section).toContain("profile.companyStamp?.s3Key");
    expect(section).toContain("patchOperatorCompanyStamp");
    expect(section).toContain("requestOperatorCompanyStampUploadUrl");
    expect(section).toContain("Replace");
    expect(section).toContain("Upload");
    expect(section).toContain("Shoraka company stamp preview");
  });

  it("adds a signing person by selecting an existing Shoraka officer", () => {
    expect(section).toContain("Add signing person");
    expect(section).toContain("Select existing Shoraka person");
    expect(section).toContain("availableOfficers.map");
    expect(section).toContain("createOperatorSigningPerson");
    expect(section).toContain("officerId");
    expect(section).not.toContain("authorisedSignatoryName");
  });

  it("offers Authorised Signatory and Witness without mapping Board or Director", () => {
    expect(section).toContain("OPERATOR_SIGNING_ROLES.map");
    expect(section).toContain("Authorised Signatory");
    expect(section).toContain("Witness");
    expect(section).toContain(
      "Director and Board roles are not signing roles."
    );
    expect(section).toContain(
      "Board or Director is not a signing role. Choose Authorised Signatory or Witness"
    );
    expect(section).not.toContain("Islamic Investment Note Certificate");
    expect(section).not.toContain("Facility Agreement");
    expect(section).not.toContain("Settlement Receipt");
  });

  it("stores a person signature and allows multiple execution roles", () => {
    expect(section).toContain("requestOperatorSigningSignatureUploadUrl");
    expect(section).toContain("roles.includes(role)");
    expect(section).toContain("Select at least one signing role");
    expect(section).toContain("Inactive");
  });
});
