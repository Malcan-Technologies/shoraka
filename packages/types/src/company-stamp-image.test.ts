import {
  COMPANY_STAMP_MAX_EDGE_PX,
  COMPANY_STAMP_MAX_FILE_SIZE_BYTES,
  COMPANY_STAMP_CROP_MESSAGE,
  COMPANY_STAMP_TOO_LARGE_MESSAGE,
  COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE,
  companyStampDeclaredFileRejection,
  companyStampLayoutRejection,
} from "./company-stamp-image";

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
});

describe("companyStampLayoutRejection", () => {
  it("accepts a square stamp", () => {
    expect(companyStampLayoutRejection(512, 512)).toBeNull();
  });

  it("accepts a normal rectangular chop", () => {
    expect(companyStampLayoutRejection(800, 400)).toBeNull();
    expect(companyStampLayoutRejection(400, 800)).toBeNull();
  });

  it("rejects an extremely wide screenshot", () => {
    expect(companyStampLayoutRejection(4000, 1000)).toBe(COMPANY_STAMP_CROP_MESSAGE);
  });

  it("rejects an extremely tall image", () => {
    expect(companyStampLayoutRejection(400, 1200)).toBe(COMPANY_STAMP_CROP_MESSAGE);
  });

  it("rejects edges above the pixel cap", () => {
    expect(companyStampLayoutRejection(COMPANY_STAMP_MAX_EDGE_PX + 1, 800)).toBe(
      COMPANY_STAMP_CROP_MESSAGE
    );
  });
});
