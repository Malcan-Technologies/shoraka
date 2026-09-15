import { confirmSigningCloudLegalImageBytes } from "./legal-image";
import { AppError } from "../http/error-handler";

const OPAQUE_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8cf0000010101005f9b9c4e0000000049454e44ae426082",
  "hex"
);

describe("confirmSigningCloudLegalImageBytes", () => {
  it("hashes a valid PNG without logging bytes", () => {
    const confirmed = confirmSigningCloudLegalImageBytes(OPAQUE_PNG);
    expect(confirmed.widthPx).toBe(1);
    expect(confirmed.heightPx).toBe(1);
    expect(confirmed.contentType).toBe("image/png");
    expect(confirmed.transparencyMode).toBe("OPAQUE");
    expect(confirmed.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects non-images", () => {
    try {
      confirmSigningCloudLegalImageBytes(Buffer.from("%PDF-1.4"));
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("VALIDATION_ERROR");
    }
  });
});
