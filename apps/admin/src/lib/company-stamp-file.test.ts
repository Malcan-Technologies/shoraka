import {
  COMPANY_STAMP_CROP_MESSAGE,
  COMPANY_STAMP_MAX_FILE_SIZE_BYTES,
  COMPANY_STAMP_TOO_LARGE_MESSAGE,
  COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE,
} from "@cashsouk/types";
import {
  companyStampFileMetaRejection,
  companyStampImageLayoutRejection,
  validateCompanyStampFile,
} from "./company-stamp-file";

describe("companyStampFileMetaRejection", () => {
  it("accepts PNG, JPEG, and WEBP", () => {
    expect(companyStampFileMetaRejection({ type: "image/png", size: 2048 })).toBeNull();
    expect(companyStampFileMetaRejection({ type: "image/jpeg", size: 2048 })).toBeNull();
    expect(companyStampFileMetaRejection({ type: "image/webp", size: 2048 })).toBeNull();
  });

  it("rejects an unsupported type and an oversized file", () => {
    expect(companyStampFileMetaRejection({ type: "application/pdf", size: 2048 })).toBe(
      COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE
    );
    expect(
      companyStampFileMetaRejection({
        type: "image/png",
        size: COMPANY_STAMP_MAX_FILE_SIZE_BYTES + 1,
      })
    ).toBe(COMPANY_STAMP_TOO_LARGE_MESSAGE);
  });
});

describe("companyStampImageLayoutRejection", () => {
  it("accepts square and normal rectangular stamps", () => {
    expect(companyStampImageLayoutRejection(400, 400)).toBeNull();
    expect(companyStampImageLayoutRejection(900, 450)).toBeNull();
  });

  it("rejects extremely wide or tall images", () => {
    expect(companyStampImageLayoutRejection(3600, 900)).toBe(COMPANY_STAMP_CROP_MESSAGE);
    expect(companyStampImageLayoutRejection(300, 900)).toBe(COMPANY_STAMP_CROP_MESSAGE);
  });
});

describe("validateCompanyStampFile", () => {
  it("rejects unsupported types before reading pixels", async () => {
    const file = new File(["not-an-image"], "stamp.pdf", { type: "application/pdf" });
    await expect(validateCompanyStampFile(file)).resolves.toBe(
      COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE
    );
  });
});


describe("companyStampFileMetaRejection", () => {
  it("accepts PNG, JPEG, and WEBP", () => {
    expect(companyStampFileMetaRejection({ type: "image/png", size: 2048 })).toBeNull();
    expect(companyStampFileMetaRejection({ type: "image/jpeg", size: 2048 })).toBeNull();
    expect(companyStampFileMetaRejection({ type: "image/webp", size: 2048 })).toBeNull();
  });

  it("rejects an unsupported type and an oversized file", () => {
    expect(companyStampFileMetaRejection({ type: "application/pdf", size: 2048 })).toBe(
      COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE
    );
    expect(
      companyStampFileMetaRejection({
        type: "image/png",
        size: COMPANY_STAMP_MAX_FILE_SIZE_BYTES + 1,
      })
    ).toBe(COMPANY_STAMP_TOO_LARGE_MESSAGE);
  });
});

describe("companyStampImageLayoutRejection", () => {
  it("accepts square and normal rectangular stamps", () => {
    expect(companyStampImageLayoutRejection(400, 400)).toBeNull();
    expect(companyStampImageLayoutRejection(900, 450)).toBeNull();
  });

  it("rejects extremely wide or tall images", () => {
    expect(companyStampImageLayoutRejection(3600, 900)).toBe(COMPANY_STAMP_CROP_MESSAGE);
    expect(companyStampImageLayoutRejection(300, 900)).toBe(COMPANY_STAMP_CROP_MESSAGE);
  });
});
