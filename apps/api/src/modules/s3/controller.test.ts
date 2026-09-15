import {
  isOperatorSigningSignatureS3Key,
  parseApplicationIdFromS3Key,
} from "./controller";

describe("parseApplicationIdFromS3Key", () => {
  it("extracts application id from application-scoped keys", () => {
    expect(
      parseApplicationIdFromS3Key("applications/clxxxxxxxxxxxxxxxxxxxx/signing/env1/signed/doc.pdf")
    ).toBe("clxxxxxxxxxxxxxxxxxxxx");
    expect(
      parseApplicationIdFromS3Key("applications/clxxxxxxxxxxxxxxxxxxxx/v1-2026-07-21-abc.png")
    ).toBe("clxxxxxxxxxxxxxxxxxxxx");
  });

  it("returns null for non-application keys", () => {
    expect(parseApplicationIdFromS3Key("products/foo/bar.pdf")).toBeNull();
    expect(parseApplicationIdFromS3Key("applications")).toBeNull();
    expect(parseApplicationIdFromS3Key("")).toBeNull();
  });
});

describe("isOperatorSigningSignatureS3Key", () => {
  it("accepts operator signature objects and rejects traversal", () => {
    expect(isOperatorSigningSignatureS3Key("operator-profile/signing-signatures/a.png")).toBe(true);
    expect(isOperatorSigningSignatureS3Key("operator-profile/signing-signatures/../a.png")).toBe(false);
    expect(isOperatorSigningSignatureS3Key("issuer-organizations/org_1/company-seals/a.png")).toBe(false);
  });
});
