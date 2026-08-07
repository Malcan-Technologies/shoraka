import { createHash } from "crypto";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { AppError } from "../http/error-handler";
import { logger } from "../logger";
import { getS3Client, S3_BUCKET } from "./client";

export const LEGAL_DOCUMENT_S3_PREFIX = "legal-documents/";
export const LEGAL_PDF_MAX_BYTES = 10 * 1024 * 1024;
const PDF_MAGIC = Buffer.from("%PDF");

/** Log-safe S3 key: prefix + last path segment only. */
export function sanitizeS3KeyForLog(key: string): string {
  const parts = key.split("/").filter(Boolean);
  if (parts.length <= 2) return `${LEGAL_DOCUMENT_S3_PREFIX}…`;
  return `${parts[0]}/…/${parts[parts.length - 1]}`;
}

export function isLegalDocumentS3Key(key: string): boolean {
  return key.startsWith(LEGAL_DOCUMENT_S3_PREFIX) && !key.includes("..");
}

export function isSha256Hex(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

/**
 * Stream an S3 object and compute SHA-256 (lowercase hex).
 * Does not treat S3 ETag as content hash.
 */
export async function calculateS3ObjectSha256(key: string): Promise<{
  sha256: string;
  byteLength: number;
}> {
  if (!key) {
    throw new AppError(400, "VALIDATION_ERROR", "S3 object key is required");
  }

  const client = getS3Client();
  let res;
  try {
    res = await client.send(
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      })
    );
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NoSuchKey" || name === "NotFound") {
      throw new AppError(400, "S3_OBJECT_MISSING", "Uploaded document was not found in storage");
    }
    logger.warn(
      { keyPreview: sanitizeS3KeyForLog(key), errName: name },
      "Failed to read S3 object for hash"
    );
    throw new AppError(502, "S3_READ_FAILED", "Could not read uploaded document from storage");
  }

  if (!res.Body) {
    throw new AppError(400, "S3_OBJECT_EMPTY", "Uploaded document is empty");
  }

  const hash = createHash("sha256");
  let byteLength = 0;
  let magicBuf = Buffer.alloc(0);
  let magicChecked = false;

  try {
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      const buf = Buffer.from(chunk);
      byteLength += buf.length;

      if (byteLength > LEGAL_PDF_MAX_BYTES) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          `File too large. Maximum size: ${LEGAL_PDF_MAX_BYTES / 1024 / 1024}MB`
        );
      }

      if (!magicChecked) {
        magicBuf = Buffer.concat([magicBuf, buf.subarray(0, Math.max(0, 8 - magicBuf.length))]);
        if (magicBuf.length >= 4) {
          if (!magicBuf.subarray(0, 4).equals(PDF_MAGIC)) {
            throw new AppError(400, "VALIDATION_ERROR", "Stored object is not a valid PDF");
          }
          magicChecked = true;
        }
      }

      hash.update(buf);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.warn(
      { keyPreview: sanitizeS3KeyForLog(key) },
      "S3 stream error while hashing legal document"
    );
    throw new AppError(502, "S3_STREAM_FAILED", "Could not read uploaded document from storage");
  }

  if (byteLength === 0) {
    throw new AppError(400, "S3_OBJECT_EMPTY", "Uploaded document is empty");
  }

  if (!magicChecked || magicBuf.length < 4 || !magicBuf.subarray(0, 4).equals(PDF_MAGIC)) {
    throw new AppError(400, "VALIDATION_ERROR", "Stored object is not a valid PDF");
  }

  const sha256 = hash.digest("hex");
  if (!isSha256Hex(sha256)) {
    throw new AppError(500, "HASH_FAILED", "Failed to compute document hash");
  }

  return { sha256, byteLength };
}

/**
 * Confirm the uploaded legal PDF exists in S3, is a PDF within size limits,
 * and return the authoritative server-side SHA-256.
 * Client-claimed size must match actual bytes when provided.
 */
export async function assertStoredLegalPdf(params: {
  s3Key: string;
  claimedFileSize?: number;
}): Promise<{ fileHash: string; fileSize: number }> {
  if (!isLegalDocumentS3Key(params.s3Key)) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid S3 key for legal document");
  }

  const { sha256, byteLength } = await calculateS3ObjectSha256(params.s3Key);

  if (
    typeof params.claimedFileSize === "number" &&
    params.claimedFileSize > 0 &&
    params.claimedFileSize !== byteLength
  ) {
    throw new AppError(
      400,
      "FILE_SIZE_MISMATCH",
      "Uploaded file size does not match the stored document"
    );
  }

  return { fileHash: sha256, fileSize: byteLength };
}
