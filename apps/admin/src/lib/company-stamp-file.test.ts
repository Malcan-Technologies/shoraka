import {
  COMPANY_STAMP_MAX_FILE_SIZE_BYTES,
  COMPANY_STAMP_TOO_LARGE_MESSAGE,
  COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE,
} from "@cashsouk/types";
import { validateCompanyStampFile } from "./company-stamp-file";

describe("validateCompanyStampFile", () => {
  it("accepts PNG, JPEG, JPG, and WEBP", () => {
    expect(validateCompanyStampFile({ type: "image/png", size: 2048 })).toBeNull();
    expect(validateCompanyStampFile({ type: "image/jpeg", size: 2048 })).toBeNull();
    expect(validateCompanyStampFile({ type: "image/jpg", size: 2048 })).toBeNull();
    expect(validateCompanyStampFile({ type: "image/webp", size: 2048 })).toBeNull();
  });

  it("rejects an unsupported type and an oversized file", () => {
    expect(validateCompanyStampFile({ type: "application/pdf", size: 2048 })).toBe(
      COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE
    );
    expect(
      validateCompanyStampFile({
        type: "image/png",
        size: COMPANY_STAMP_MAX_FILE_SIZE_BYTES + 1,
      })
    ).toBe(COMPANY_STAMP_TOO_LARGE_MESSAGE);
  });

  it("accepts wide, tall, and large-pixel files when type and size are valid", () => {
    const wide = new File(["pixels"], "wide.png", { type: "image/png" });
    const tall = new File(["pixels"], "tall.jpg", { type: "image/jpeg" });
    const largeEdge = new File(["pixels"], "large.webp", { type: "image/webp" });
    expect(validateCompanyStampFile(wide)).toBeNull();
    expect(validateCompanyStampFile(tall)).toBeNull();
    expect(validateCompanyStampFile(largeEdge)).toBeNull();
  });
});
