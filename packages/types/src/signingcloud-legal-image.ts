/**
 * SigningCloud provider limits for organisation seals and automatic-signature images.
 * Unrelated certificate/note stamps keep the 5 MB rules in company-stamp-image.ts.
 */

export const SIGNINGCLOUD_LEGAL_IMAGE_MAX_EDGE_PX = 300;
export const SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES = 500 * 1024;

export const SIGNINGCLOUD_LEGAL_IMAGE_CONTENT_TYPES = ["image/png", "image/jpeg", "image/jpg"] as const;
export type SigningCloudLegalImageContentType = (typeof SIGNINGCLOUD_LEGAL_IMAGE_CONTENT_TYPES)[number];

export const SIGNINGCLOUD_LEGAL_IMAGE_UNSUPPORTED_TYPE_MESSAGE =
  "Upload a PNG or JPG image. WebP is not accepted for SigningCloud seals or signatures.";
export const SIGNINGCLOUD_LEGAL_IMAGE_TOO_LARGE_MESSAGE =
  "Image must be 500 KB or smaller for SigningCloud.";
export const SIGNINGCLOUD_LEGAL_IMAGE_DIMENSION_MESSAGE =
  "Image must be 300 × 300 pixels or smaller for SigningCloud.";
export const SIGNINGCLOUD_LEGAL_IMAGE_INVALID_MESSAGE = "Upload a valid PNG or JPG image.";

export type SigningCloudLegalImageTransparency = "OPAQUE" | "ALPHA";

export function isSigningCloudLegalImageContentType(
  value: string
): value is SigningCloudLegalImageContentType {
  return (SIGNINGCLOUD_LEGAL_IMAGE_CONTENT_TYPES as readonly string[]).includes(
    value.trim().toLowerCase()
  );
}

export function signingCloudLegalImageDeclaredFileRejection(
  contentType: string,
  fileSize: number
): string | null {
  if (!isSigningCloudLegalImageContentType(contentType)) {
    return SIGNINGCLOUD_LEGAL_IMAGE_UNSUPPORTED_TYPE_MESSAGE;
  }
  if (
    !Number.isFinite(fileSize) ||
    fileSize <= 0 ||
    fileSize > SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES
  ) {
    return SIGNINGCLOUD_LEGAL_IMAGE_TOO_LARGE_MESSAGE;
  }
  return null;
}

export function signingCloudLegalImageDimensionRejection(widthPx: number, heightPx: number): string | null {
  if (
    !Number.isInteger(widthPx) ||
    !Number.isInteger(heightPx) ||
    widthPx < 1 ||
    heightPx < 1 ||
    widthPx > SIGNINGCLOUD_LEGAL_IMAGE_MAX_EDGE_PX ||
    heightPx > SIGNINGCLOUD_LEGAL_IMAGE_MAX_EDGE_PX
  ) {
    return SIGNINGCLOUD_LEGAL_IMAGE_DIMENSION_MESSAGE;
  }
  return null;
}
