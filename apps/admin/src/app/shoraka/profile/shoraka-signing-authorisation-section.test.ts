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
    expect(page).toContain('queryKey: ["admin", "signing"]');
    expect(page).toContain('invalidateQueries({ queryKey: ["admin", "signing"] }');
  });

  it("shows company stamp preview, upload, and replace against the existing stored asset", () => {
    expect(section).toContain("Signing & Authorisation");
    expect(section).toContain("Company Stamp");
    expect(section).toContain("profile.companyStamp?.s3Key");
    expect(section).toContain("patchOperatorCompanyStamp");
    expect(section).toContain("requestOperatorCompanyStampUploadUrl");
    expect(section).toContain("companyStampDeclaredFileRejection");
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
    expect(section).toContain("Director and Board roles are not signing roles.");
    expect(section).toContain(
      "Board or Director is not a signing role. Choose Authorised Signatory or Witness"
    );
    expect(section).not.toContain("Islamic Investment Note Certificate");
    expect(section).not.toContain("Settlement Receipt");
  });

  it("stores a person signature and allows multiple execution roles", () => {
    expect(section).toContain("requestOperatorSigningSignatureUploadUrl");
    expect(section).toContain("signingCloudLegalImageDeclaredFileRejection");
    expect(section).not.toContain("personSignatureDeclaredFileRejection");
    expect(section).toContain("roles.includes(role)");
    expect(section).toContain("Select at least one signing role");
    expect(section).toContain("Inactive");
  });

  it("collects a SigningCloud email and confirms the signature after save", () => {
    expect(section).toContain('type="email"');
    expect(section).toContain("SigningCloud email");
    expect(section).toContain("confirmOperatorSigningPersonSignature");
    expect(section).toContain("Ready for automatic signing");
    expect(section).toContain("Needs email and confirmed signature");
    expect(section).toContain("signatureProviderReady");
  });

  it("assigns authorised representatives and witnesses independently", () => {
    expect(section).toContain("Document execution assignments");
    expect(section).toContain("putOperatorDocumentExecutionBindings");
    expect(section).toContain("OPERATOR_DOCUMENT_KINDS");
    expect(section).toContain("OPERATOR_DOCUMENT_KIND_PLACEMENTS");
    expect(section).toContain('data-signing-layout="stack"');
    expect(section.indexOf("Signing People")).toBeLessThan(section.indexOf("Company Stamp"));
    expect(section.indexOf("Company Stamp")).toBeLessThan(
      section.indexOf("Document execution assignments")
    );
    expect(section).toContain("sm:grid-cols-2");
    expect(section).toContain("${role} representative ${slotIndex}");
    expect(section).toContain('role.replace(/ witness$/i, " Witness")');
    expect(section).not.toContain("{executionRoleShortLabel(roleKey)}");
    expect(section).toContain("canBindToWitness");
    expect(section).toContain("canBindToDocumentExecution");
    expect(section).toContain("documentExecutionBindingIssues");
    expect(section).toContain("operatorOfficerDesignationLabel");
    expect(section).not.toContain("Legal entity label");
    expect(section).not.toContain("legalEntityLabel");
    expect(section).not.toContain("covers Investor 1 and Agent 1");
    expect(section).not.toContain("FA_SHARED_INVESTOR_AGENT_SIGNERS_ENABLED");
  });
});
