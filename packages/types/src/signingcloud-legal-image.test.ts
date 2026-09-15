import {
  SIGNINGCLOUD_LEGAL_IMAGE_DIMENSION_MESSAGE,
  SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES,
  SIGNINGCLOUD_LEGAL_IMAGE_MAX_EDGE_PX,
  SIGNINGCLOUD_LEGAL_IMAGE_TOO_LARGE_MESSAGE,
  SIGNINGCLOUD_LEGAL_IMAGE_UNSUPPORTED_TYPE_MESSAGE,
  isSigningCloudLegalImageContentType,
  signingCloudLegalImageDeclaredFileRejection,
  signingCloudLegalImageDimensionRejection,
} from "./signingcloud-legal-image";
import * as companyStamp from "./company-stamp-image";

describe("SigningCloud legal image rules", () => {
  it("accepts PNG and JPEG within 500 KB", () => {
    expect(signingCloudLegalImageDeclaredFileRejection("image/png", 1024)).toBeNull();
    expect(signingCloudLegalImageDeclaredFileRejection("image/jpeg", 2048)).toBeNull();
    expect(signingCloudLegalImageDeclaredFileRejection("image/jpg", SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES)).toBeNull();
  });

  it("rejects WebP without relaxing SigningCloud size limits to the 5 MB stamp cap", () => {
    expect(signingCloudLegalImageDeclaredFileRejection("image/webp", 1024)).toBe(
      SIGNINGCLOUD_LEGAL_IMAGE_UNSUPPORTED_TYPE_MESSAGE
    );
    expect(companyStamp.isCompanyStampContentType("image/webp")).toBe(false);
    expect(companyStamp.companyStampDeclaredFileRejection("image/webp", 1024)).toBe(
      companyStamp.COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE
    );
    expect(
      signingCloudLegalImageDeclaredFileRejection("image/png", SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES + 1)
    ).toBe(SIGNINGCLOUD_LEGAL_IMAGE_TOO_LARGE_MESSAGE);
    expect(
      companyStamp.companyStampDeclaredFileRejection("image/png", SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES + 1)
    ).toBeNull();
  });

  it("rejects oversized declared files", () => {
    expect(
      signingCloudLegalImageDeclaredFileRejection("image/png", SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES + 1)
    ).toBe(SIGNINGCLOUD_LEGAL_IMAGE_TOO_LARGE_MESSAGE);
  });

  it("treats 300×300 as a maximum, not an exact size", () => {
    expect(signingCloudLegalImageDimensionRejection(1, 1)).toBeNull();
    expect(
      signingCloudLegalImageDimensionRejection(
        SIGNINGCLOUD_LEGAL_IMAGE_MAX_EDGE_PX,
        SIGNINGCLOUD_LEGAL_IMAGE_MAX_EDGE_PX
      )
    ).toBeNull();
    expect(signingCloudLegalImageDimensionRejection(301, 300)).toBe(
      SIGNINGCLOUD_LEGAL_IMAGE_DIMENSION_MESSAGE
    );
  });

  it("recognises provider MIME types case-insensitively", () => {
    expect(isSigningCloudLegalImageContentType("image/PNG")).toBe(true);
    expect(isSigningCloudLegalImageContentType("image/webp")).toBe(false);
  });
});
