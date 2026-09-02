import type { DocumentAuthorisationConfig, DocumentStampUploadPurpose } from "@cashsouk/types";
import {
  COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE,
} from "@cashsouk/types";
import { AppError } from "../../../lib/http/error-handler";
import { getS3ObjectBuffer } from "../../../lib/s3/client";
import { inspectCompanyStampBytes } from "./stamp-image-bytes";

export function documentStampObjectPrefix(purpose: DocumentStampUploadPurpose): string {
  return purpose === "RECEIPT_COMPANY_STAMP"
    ? "platform-finance/document-stamps/receipt/"
    : "platform-finance/document-stamps/certificate/";
}

function stampS3Key(value: { s3Key?: string } | undefined): string | null {
  const key = value?.s3Key?.trim();
  return key ? key : null;
}

export async function assertCompanyStampS3Object(s3Key: string): Promise<void> {
  let bytes: Buffer;
  try {
    bytes = await getS3ObjectBuffer(s3Key);
  } catch {
    throw new AppError(400, "INVALID_COMPANY_STAMP", COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE);
  }
  const message = inspectCompanyStampBytes(bytes);
  if (message) {
    throw new AppError(400, "INVALID_COMPANY_STAMP", message);
  }
}

/**
 * Re-check newly referenced stamp objects when Document Authorisation is saved.
 * Unchanged keys are skipped so an older uploaded file is not re-blocked on save.
 */
export async function assertIncomingDocumentAuthorisationStamps(input: {
  next: DocumentAuthorisationConfig;
  previous: DocumentAuthorisationConfig;
}): Promise<void> {
  const keys: string[] = [];
  const nextCert = stampS3Key(input.next.certificateCompanyStamp);
  if (nextCert && nextCert !== stampS3Key(input.previous.certificateCompanyStamp)) {
    keys.push(nextCert);
  }
  if (!input.next.useSameCompanyStamp) {
    const nextReceipt = stampS3Key(input.next.receiptCompanyStamp);
    if (nextReceipt && nextReceipt !== stampS3Key(input.previous.receiptCompanyStamp)) {
      keys.push(nextReceipt);
    }
  }
  for (const key of keys) {
    await assertCompanyStampS3Object(key);
  }
}

export function assertDocumentStampKeyMatchesPurpose(
  s3Key: string,
  purpose: DocumentStampUploadPurpose
): void {
  const prefix = documentStampObjectPrefix(purpose);
  if (!s3Key.startsWith(prefix)) {
    throw new AppError(400, "INVALID_COMPANY_STAMP", COMPANY_STAMP_UNSUPPORTED_TYPE_MESSAGE);
  }
}
