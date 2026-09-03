/**
 * Shared company-stamp upload rules for Certificate and Hibah Receipt stamps.
 * Same MIME list and 5 MB cap as Trustee Signature; no aspect or pixel-dimension limits.
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

export const COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE = "Upload a PNG, JPG or WEBP image.";
export const COMPANY_STAMP_TOO_LARGE_MESSAGE = "Company stamp image must be 5 MB or smaller.";

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
