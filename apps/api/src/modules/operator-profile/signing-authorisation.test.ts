import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  operatorSigningPersonCreateSchema,
  operatorSigningPersonUpdateSchema,
} from "../organization-profile/schemas";

function source(relativeFromThisFile: string): string {
  return readFileSync(join(__dirname, relativeFromThisFile), "utf8");
}

const OFFICER_ID = "cofficer00000001";

describe("Shoraka signing person schemas", () => {
  it("requires an existing officer and at least one execution role", () => {
    const parsed = operatorSigningPersonCreateSchema.parse({
      officerId: OFFICER_ID,
      roles: ["AUTHORISED_SIGNATORY", "WITNESS"],
      signature: { s3Key: "operator-profile/signing-signatures/a.png" },
    });
    expect(parsed.officerId).toBe(OFFICER_ID);
    expect(parsed.roles).toEqual(["AUTHORISED_SIGNATORY", "WITNESS"]);
    expect(parsed.signature?.s3Key).toBe("operator-profile/signing-signatures/a.png");
  });

  it("rejects empty roles, custom roles, and Board/Director as signing roles", () => {
    expect(
      operatorSigningPersonCreateSchema.safeParse({
        officerId: OFFICER_ID,
        roles: [],
      }).success
    ).toBe(false);
    expect(
      operatorSigningPersonCreateSchema.safeParse({
        officerId: OFFICER_ID,
        roles: ["DIRECTOR"],
      }).success
    ).toBe(false);
    expect(
      operatorSigningPersonCreateSchema.safeParse({
        officerId: OFFICER_ID,
        roles: ["BOARD"],
      }).success
    ).toBe(false);
    expect(
      operatorSigningPersonCreateSchema.safeParse({
        officerId: OFFICER_ID,
        roles: ["CUSTOM"],
      }).success
    ).toBe(false);
  });

  it("allows replacing a signature and toggling active without changing the person", () => {
    const parsed = operatorSigningPersonUpdateSchema.parse({
      roles: ["WITNESS"],
      active: false,
      signature: { s3Key: "operator-profile/signing-signatures/b.png", fileName: "b.png" },
    });
    expect(parsed.roles).toEqual(["WITNESS"]);
    expect(parsed.active).toBe(false);
    expect(operatorSigningPersonUpdateSchema.shape).not.toHaveProperty("officerId");
  });
});

describe("Shoraka signing authorisation storage boundaries", () => {
  const service = source("./service.ts");
  const createOfficerFn = service.slice(
    service.indexOf("export async function createOfficer"),
    service.indexOf("export async function updateOfficer")
  );
  const freezeConfig = source("../notes/document-authorisation/config.ts");
  const certificateService = source("../notes/investment-note-certificate/service.ts");
  const receiptService = source("../notes/settlement-hibah-receipt/service.ts");
  const signingCloudApi = source("../signingcloud/signingcloud-api.ts");
  const signingAdapter = source("../signing/provider/signingcloud-adapter.ts");

  it("does not create a signing person when a Board or Director officer is added", () => {
    expect(createOfficerFn).toContain("prisma.operatorOfficer.create");
    expect(createOfficerFn).not.toContain("operatorSigningPerson");
    expect(createOfficerFn).not.toContain("AUTHORISED_SIGNATORY");
    expect(createOfficerFn).not.toContain("WITNESS");
  });

  it("reuses the existing certificate company stamp JSON and preserves receipt fields", () => {
    expect(service).toContain("certificateCompanyStamp");
    expect(service).toContain("receiptCompanyStamp: current.receiptCompanyStamp");
    expect(service).toContain("useSameCompanyStamp: current.useSameCompanyStamp");
    expect(service).toContain("platform-finance/document-stamps/certificate");
    expect(service).toContain("operator-profile/signing-signatures");
    expect(service).toContain("if (!name) return;");
  });

  it("does not change document freeze or generation read paths", () => {
    expect(freezeConfig).toContain("document_authorisation_config");
    expect(freezeConfig).toContain("export async function freezeCertificateAuthorisation");
    expect(freezeConfig).toContain("export async function freezeReceiptAuthorisation");
    expect(freezeConfig).not.toContain("operatorSigningPerson");
    expect(freezeConfig).not.toContain("signingPeople");
    expect(certificateService).toContain("freezeCertificateAuthorisation");
    expect(certificateService).not.toContain("createSigningPerson");
    expect(receiptService).toContain("freezeReceiptAuthorisation");
    expect(receiptService).not.toContain("createSigningPerson");
  });

  it("does not change SigningCloud", () => {
    expect(service).not.toContain("signingcloud");
    expect(service).not.toContain("SigningCloud");
    expect(signingCloudApi).not.toContain("operatorSigningPerson");
    expect(signingAdapter).not.toContain("operatorSigningPerson");
  });
});
