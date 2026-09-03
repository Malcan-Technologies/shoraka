import {
  COMPANY_STAMP_MAX_FILE_SIZE_BYTES,
  COMPANY_STAMP_TOO_LARGE_MESSAGE,
  COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE,
  companyStampDeclaredFileRejection,
} from "./company-stamp-image";
import * as stampRules from "./company-stamp-image";

describe("companyStampDeclaredFileRejection", () => {
  it("accepts PNG, JPEG, JPG, and WEBP within the trustee 5 MB cap", () => {
    expect(companyStampDeclaredFileRejection("image/png", 1024)).toBeNull();
    expect(companyStampDeclaredFileRejection("image/jpeg", 2048)).toBeNull();
    expect(companyStampDeclaredFileRejection("image/jpg", 2048)).toBeNull();
    expect(companyStampDeclaredFileRejection("image/webp", COMPANY_STAMP_MAX_FILE_SIZE_BYTES)).toBeNull();
  });

  it("rejects unsupported MIME types", () => {
    expect(companyStampDeclaredFileRejection("application/pdf", 1024)).toBe(
      COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE
    );
    expect(companyStampDeclaredFileRejection("image/svg+xml", 1024)).toBe(
      COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE
    );
  });

  it("rejects oversized files", () => {
    expect(
      companyStampDeclaredFileRejection("image/png", COMPANY_STAMP_MAX_FILE_SIZE_BYTES + 1)
    ).toBe(COMPANY_STAMP_TOO_LARGE_MESSAGE);
  });

  it("does not reject by aspect ratio or pixel dimensions", () => {
    expect(companyStampDeclaredFileRejection("image/png", 2048)).toBeNull();
    expect(companyStampDeclaredFileRejection("image/jpeg", 4096)).toBeNull();
    expect("companyStampLayoutRejection" in stampRules).toBe(false);
    expect("COMPANY_STAMP_CROP_MESSAGE" in stampRules).toBe(false);
    expect("COMPANY_STAMP_MAX_EDGE_PX" in stampRules).toBe(false);
    expect("COMPANY_STAMP_MIN_ASPECT_RATIO" in stampRules).toBe(false);
    expect("COMPANY_STAMP_MAX_ASPECT_RATIO" in stampRules).toBe(false);
  });
});
