import { AppError } from "../../lib/http/error-handler";
import {
  assertOperatorSignatureS3Key,
  assertOperatorSignatureUploadDeclared,
  OPERATOR_SIGNING_SIGNATURE_S3_PREFIX,
} from "./signature-asset";

function expectAppError(run: () => void): void {
  try {
    run();
    throw new Error("expected AppError");
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
  }
}

describe("operator signature object keys", () => {
  it("accepts keys under the operator signature prefix", () => {
    expect(() =>
      assertOperatorSignatureS3Key(`${OPERATOR_SIGNING_SIGNATURE_S3_PREFIX}/v1-a.png`)
    ).not.toThrow();
  });

  it("rejects keys outside the operator signature prefix", () => {
    expectAppError(() => assertOperatorSignatureS3Key("platform-finance/document-stamps/a.png"));
    expectAppError(() =>
      assertOperatorSignatureS3Key(`${OPERATOR_SIGNING_SIGNATURE_S3_PREFIX}/../other.png`)
    );
  });
});

describe("operator signature declared upload", () => {
  it("accepts a PNG within the provider size limit", () => {
    expect(() => assertOperatorSignatureUploadDeclared("image/png", 1024)).not.toThrow();
  });

  it("rejects WebP and oversized files", () => {
    expectAppError(() => assertOperatorSignatureUploadDeclared("image/webp", 1024));
    expectAppError(() => assertOperatorSignatureUploadDeclared("image/png", 500 * 1024 + 1));
  });
});
