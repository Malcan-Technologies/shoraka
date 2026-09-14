import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES, allDocumentExecutionSlots } from "@cashsouk/types";
import {
  operatorDocumentExecutionBindingsPutSchema,
  operatorSigningPersonCreateSchema,
  operatorSigningPersonUpdateSchema,
  operatorSigningSignatureConfirmSchema,
  requestOperatorSigningImageUploadUrlSchema,
  requestOperatorSigningSignatureUploadUrlSchema,
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

  it("normalizes optional signing email and allows a person without one", () => {
    const withoutEmail = operatorSigningPersonCreateSchema.parse({
      officerId: OFFICER_ID,
      roles: ["AUTHORISED_SIGNATORY"],
    });
    expect(withoutEmail.signingEmail).toBeUndefined();
    expect(
      operatorSigningPersonCreateSchema.parse({
        officerId: OFFICER_ID,
        roles: ["WITNESS"],
        signingEmail: "  Foo@CashSouk.com ",
      }).signingEmail
    ).toBe("foo@cashsouk.com");
    expect(
      operatorSigningPersonCreateSchema.parse({
        officerId: OFFICER_ID,
        roles: ["WITNESS"],
        signingEmail: null,
      }).signingEmail
    ).toBeNull();
    expect(
      operatorSigningPersonUpdateSchema.parse({
        signingEmail: "  ",
      }).signingEmail
    ).toBeNull();
    expect(
      operatorSigningPersonCreateSchema.safeParse({
        officerId: OFFICER_ID,
        roles: ["AUTHORISED_SIGNATORY"],
        signingEmail: "not-an-email",
      }).success
    ).toBe(false);
  });
});

describe("Shoraka signature confirm and upload schemas", () => {
  it("requires an s3 key to confirm a signature object", () => {
    expect(operatorSigningSignatureConfirmSchema.parse({ s3Key: "operator-profile/signing-signatures/a.png" }).s3Key).toBe(
      "operator-profile/signing-signatures/a.png"
    );
    expect(operatorSigningSignatureConfirmSchema.safeParse({}).success).toBe(false);
  });

  it("tightens signature uploads to PNG/JPEG at 500 KB while company stamps stay on the 5 MB PNG/JPEG cap", () => {
    expect(
      requestOperatorSigningSignatureUploadUrlSchema.safeParse({
        fileName: "sig.png",
        contentType: "image/png",
        fileSize: 1024,
      }).success
    ).toBe(true);
    expect(
      requestOperatorSigningSignatureUploadUrlSchema.safeParse({
        fileName: "sig.webp",
        contentType: "image/webp",
        fileSize: 1024,
      }).success
    ).toBe(false);
    expect(
      requestOperatorSigningSignatureUploadUrlSchema.safeParse({
        fileName: "sig.png",
        contentType: "image/png",
        fileSize: SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES + 1,
      }).success
    ).toBe(false);
    expect(
      requestOperatorSigningImageUploadUrlSchema.safeParse({
        fileName: "stamp.webp",
        contentType: "image/webp",
        fileSize: 5 * 1024 * 1024,
      }).success
    ).toBe(false);
    expect(
      requestOperatorSigningImageUploadUrlSchema.safeParse({
        fileName: "stamp.png",
        contentType: "image/png",
        fileSize: 5 * 1024 * 1024,
      }).success
    ).toBe(true);
  });
});

describe("Shoraka document execution binding schema", () => {
  const emptyBindings = allDocumentExecutionSlots().map((slot) => ({
    roleKey: slot.roleKey,
    slotIndex: slot.slotIndex,
    signingPersonId: null,
    legalEntityLabel: "",
  }));

  it("accepts a replace-all payload covering every representative and witness slot", () => {
    const parsed = operatorDocumentExecutionBindingsPutSchema.parse({
      bindings: emptyBindings.map((binding) =>
        binding.roleKey === "FA_INVESTOR" && binding.slotIndex === 1
          ? { ...binding, signingPersonId: OFFICER_ID, legalEntityLabel: "CashSouk Sdn Bhd" }
          : binding
      ),
    });
    expect(parsed.bindings).toHaveLength(allDocumentExecutionSlots().length);
    expect(
      parsed.bindings.find((binding) => binding.roleKey === "FA_INVESTOR" && binding.slotIndex === 1)
        ?.signingPersonId
    ).toBe(OFFICER_ID);
  });

  it("rejects a partial or duplicate binding list", () => {
    expect(
      operatorDocumentExecutionBindingsPutSchema.safeParse({
        bindings: emptyBindings.slice(0, 1),
      }).success
    ).toBe(false);
    expect(
      operatorDocumentExecutionBindingsPutSchema.safeParse({
        bindings: [...emptyBindings, emptyBindings[0]],
      }).success
    ).toBe(false);
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
  const signatureAsset = source("./signature-asset.ts");
  const confirmLegalImage = source("../../lib/images/confirm-legal-image.ts");
  const controller = source("./controller.ts");
  const createSigningPersonFn = service.slice(
    service.indexOf("export async function createSigningPerson"),
    service.indexOf("export async function updateSigningPerson")
  );

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
    expect(service).toContain("OPERATOR_SIGNING_SIGNATURE_S3_PREFIX");
    expect(signatureAsset).toContain("operator-profile/signing-signatures");
    expect(service).toContain("if (!name) return;");
  });

  it("does not change SigningCloud or invent a parallel freeze store", () => {
    expect(freezeConfig).toContain("document_authorisation_config");
    expect(freezeConfig).toContain("export async function freezeCertificateAuthorisation");
    expect(freezeConfig).toContain("export async function freezeReceiptAuthorisation");
    expect(freezeConfig).not.toContain("operatorSigningPerson");
    expect(freezeConfig).not.toContain("signingPeople");
    expect(certificateService).toContain("freezeShorakaSigningAuthorisation");
    expect(certificateService).not.toContain("createSigningPerson");
    expect(receiptService).toContain("freezeShorakaSigningAuthorisation");
    expect(receiptService).not.toContain("createSigningPerson");
  });

  it("does not call the signing provider HTTP client or adapter", () => {
    expect(service).not.toContain("signingcloud");
    expect(service).not.toContain("SigningCloud");
    expect(signingCloudApi).not.toContain("operatorSigningPerson");
    expect(signingAdapter).not.toContain("operatorSigningPerson");
    expect(confirmLegalImage).toContain("confirmSigningCloudLegalImageFromS3");
    expect(signatureAsset).toContain("confirmLegalImageFromS3");
    expect(signatureAsset).toContain("confirm-legal-image");
    expect(signatureAsset).not.toContain("lib/signingcloud");
    expect(signatureAsset).not.toContain("signingcloud-api");
    expect(signatureAsset).not.toContain("signingcloud-adapter");
  });

  it("clears signature confirm metadata until the person confirm endpoint", () => {
    const signatureDataFn = service.slice(
      service.indexOf("function signatureData"),
      service.indexOf("export async function createSigningPerson")
    );
    expect(signatureDataFn).toContain("signature_sha256: null");
    expect(signatureDataFn).toContain("signature_confirmed_at: null");
    expect(controller).toContain("confirmSigningPersonSignature");
  });

  it("persists signing email without auto-creating document execution bindings", () => {
    expect(createSigningPersonFn).toContain("signing_email");
    expect(createSigningPersonFn).not.toContain("document_execution");
    expect(controller).toContain("/signing-people/signature-confirm");
    expect(controller).toContain("/signing-people/:id/signature-confirm");
    expect(controller).toContain("/document-execution-bindings");
  });
});

describe("SigningCloud mixed signing smoke contract", () => {
  const smoke = source("../../../scripts/signingcloud-mixed-signing-smoke.ts");

  it("proves two automatic emails and one auto-sign call per signer", () => {
    expect(smoke).toContain("SIGNINGCLOUD_SMOKE_AUTO_EMAIL");
    expect(smoke).toContain("SIGNINGCLOUD_SMOKE_AUTO_EMAIL_2");
    expect(smoke).toContain("automaticSignerKeywordPair");
    expect(smoke).toContain("dateKeyword");
    expect(smoke).toContain("dateFormat");
    expect(smoke).toContain("one call each");
    expect(smoke).not.toContain("automaticSigningKeywordForSlot");
    expect(smoke).toContain("isSigningCloudSealFieldEnabled");
    expect(smoke).toContain("includeSeal");
    expect(smoke).toContain("transparentSignaturePng");
  });
});

describe("SigningCloud full-flow smoke contract", () => {
  const smoke = source("../../../scripts/signingcloud-full-flow-smoke.ts");

  it("uploads a company seal, waits for manuals, then auto-signs CashSouk keywords", () => {
    expect(smoke).toContain("uploadSignerStamp");
    expect(smoke).toContain("isSigningCloudSealFieldEnabled");
    expect(smoke).toContain("includeSeal");
    expect(smoke).toContain("opaqueRgbPng(200, 200");
    expect(smoke).toContain("transparentSignaturePng");
    expect(smoke).toContain("startSignerSession");
    expect(smoke).toContain("waitForOperator");
    expect(smoke).toContain("autoSign");
    expect(smoke).toContain("SIGNINGCLOUD_SMOKE_CONTINUE");
    expect(smoke).toContain("SIGNINGCLOUD_SMOKE_AUTO_EMAILS");
    expect(smoke).toContain("issuer_signatories.slice(0, 1)");
    expect(smoke).toContain("guarantors_corporate = []");
    expect(smoke).toContain("result === 126");
    expect(smoke).toContain("groupAutomaticPlacements");
    expect(smoke).toContain("automaticSignerKeywordPair");
    expect(smoke).toContain("dateKeyword");
    expect(smoke).toContain("dateFormat");
    expect(smoke).not.toContain("automaticSigningKeywordForSlot");
    expect(smoke).toContain("alreadySigned");
    expect(smoke).toContain("already signed");
    expect(smoke).toContain("missing automatic signature box");
  });
});
