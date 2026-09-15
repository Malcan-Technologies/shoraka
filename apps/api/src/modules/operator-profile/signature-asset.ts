import { signingCloudLegalImageDeclaredFileRejection } from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { confirmLegalImageFromS3 } from "../../lib/images/confirm-legal-image";

export const OPERATOR_SIGNING_SIGNATURE_S3_PREFIX = "operator-profile/signing-signatures";

export type ConfirmedOperatorSignature = {
  s3Key: string;
  sha256: string;
  widthPx: number;
  heightPx: number;
  byteSize: number;
  contentType: "image/png" | "image/jpeg";
  confirmedAt: string;
};

export function assertOperatorSignatureS3Key(s3Key: string): void {
  const key = s3Key.trim();
  if (key.includes("..") || !key.startsWith(`${OPERATOR_SIGNING_SIGNATURE_S3_PREFIX}/`)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Upload the signature using the signature upload URL"
    );
  }
}

export function assertOperatorSignatureUploadDeclared(contentType: string, fileSize: number): void {
  const rejection = signingCloudLegalImageDeclaredFileRejection(contentType, fileSize);
  if (rejection) {
    throw new AppError(400, "VALIDATION_ERROR", rejection);
  }
}

export async function confirmOperatorSignatureObject(
  s3Key: string
): Promise<ConfirmedOperatorSignature> {
  assertOperatorSignatureS3Key(s3Key);
  const confirmed = await confirmLegalImageFromS3(s3Key);
  return {
    s3Key,
    sha256: confirmed.sha256,
    widthPx: confirmed.widthPx,
    heightPx: confirmed.heightPx,
    byteSize: confirmed.byteSize,
    contentType: confirmed.contentType,
    confirmedAt: new Date().toISOString(),
  };
}
