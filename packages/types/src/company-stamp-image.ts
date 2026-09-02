/**
 * Shared company-stamp upload rules for Certificate and Hibah Receipt stamps.
 * Trustee Signature uses the same MIME list and 5 MB cap; stamps add layout checks.
 */

export const COMPANY_STAMP_ALLOWED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
] as const;

export type CompanyStampContentType = (typeof COMPANY_STAMP_ALLOWED_CONTENT_TYPES)[number];

/** Same cap as Trustee Signature (`requestTrusteeSignatureUploadUrlSchema`). */
export const COMPANY_STAMP_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** width / height must stay in this range (not perfectly square). */
export const COMPANY_STAMP_MIN_ASPECT_RATIO = 0.5;
export const COMPANY_STAMP_MAX_ASPECT_RATIO = 3;

export const COMPANY_STAMP_MAX_EDGE_PX = 3000;

export const COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE = "Upload a PNG, JPG or WEBP image.";
export const COMPANY_STAMP_TOO_LARGE_MESSAGE = "Company stamp image must be 5 MB or smaller.";
export const COMPANY_STAMP_CROP_MESSAGE =
  "Please upload a cropped company stamp image rather than a full-page screenshot.";

export function isCompanyStampContentType(value: string): value is CompanyStampContentType {
  const normalized = value.trim().toLowerCase();
  return (COMPANY_STAMP_ALLOWED_CONTENT_TYPES as readonly string[]).includes(normalized);
}

export function companyStampDeclaredFileRejection(
  contentType: string,
  fileSize: number
): string | null {
  if (!isCompanyStampContentType(contentType)) {
    return COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE;
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > COMPANY_STAMP_MAX_FILE_SIZE_BYTES) {
    return COMPANY_STAMP_TOO_LARGE_MESSAGE;
  }
  return null;
}

export function companyStampLayoutRejection(width: number, height: number): string | null {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1 ||
    !Number.isInteger(width) ||
    !Number.isInteger(height)
  ) {
    return COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE;
  }
  if (width > COMPANY_STAMP_MAX_EDGE_PX || height > COMPANY_STAMP_MAX_EDGE_PX) {
    return COMPANY_STAMP_CROP_MESSAGE;
  }
  const aspect = width / height;
  if (aspect < COMPANY_STAMP_MIN_ASPECT_RATIO || aspect > COMPANY_STAMP_MAX_ASPECT_RATIO) {
    return COMPANY_STAMP_CROP_MESSAGE;
  }
  return null;
}
