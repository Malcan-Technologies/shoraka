/**
 * Private S3 storage for issuer Settlement & Hibah Receipt PDFs.
 * Follows Investment Note Certificate conventions: SSE, sha256 metadata, HeadObject reuse.
 */

import { createHash } from "crypto";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client, S3_BUCKET } from "../../../lib/s3/client";
import { logger } from "../../../lib/logger";
import { AppError } from "../../../lib/http/error-handler";

export const RECEIPT_PDF_CONTENT_TYPE = "application/pdf";
export const RECEIPT_PDF_VIEW_URL_EXPIRY_SECONDS = 10 * 60;

function environmentSegment(): string {
  const raw = process.env.APP_ENV?.trim() || process.env.NODE_ENV?.trim() || "development";
  return raw.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function buildReceiptPdfObjectKey(input: {
  noteId: string;
  settlementId: string;
  version: string;
}): string {
  const env = environmentSegment();
  const version = input.version.replace(/[^A-Za-z0-9._-]+/g, "");
  const noteId = input.noteId.replace(/[^A-Za-z0-9._-]+/g, "");
  const settlementId = input.settlementId.replace(/[^A-Za-z0-9._-]+/g, "");
  return `settlement-hibah-receipts/${env}/${noteId}/${settlementId}/${version}.pdf`;
}

export function receiptPdfFileName(receiptNumber: string): string {
  const base = receiptNumber.replace(/[^\w.-]+/g, "-");
  return `${base}.pdf`;
}

async function headObjectMetadata(key: string): Promise<{
  exists: boolean;
  contentLength?: number;
  checksumSha256?: string | null;
}> {
  const client = getS3Client();
  try {
    const res = await client.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return {
      exists: true,
      contentLength: res.ContentLength,
      checksumSha256: res.Metadata?.sha256 ?? null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "NotFound") {
      return { exists: false };
    }
    if (
      typeof error === "object" &&
      error &&
      "$metadata" in error &&
      (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
    ) {
      return { exists: false };
    }
    throw error;
  }
}

export async function storeReceiptPdf(input: {
  key: string;
  body: Buffer;
  sha256: string;
  snapshotSha256: string;
  receiptNumber: string;
}): Promise<void> {
  const existing = await headObjectMetadata(input.key);
  if (existing.exists) {
    if (
      existing.checksumSha256 === input.sha256 ||
      existing.contentLength === input.body.length
    ) {
      logger.info({ key: input.key, sha256: input.sha256 }, "Reusing existing settlement hibah receipt PDF");
      return;
    }
    throw new AppError(
      500,
      "RECEIPT_PDF_KEY_CONFLICT",
      "Immutable settlement hibah receipt PDF key already exists with different content"
    );
  }

  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: input.key,
      Body: input.body,
      ContentType: RECEIPT_PDF_CONTENT_TYPE,
      ServerSideEncryption: "AES256",
      Metadata: {
        sha256: input.sha256,
        snapshothash: input.snapshotSha256,
        receiptnumber: input.receiptNumber,
      },
    })
  );
  logger.info(
    { key: input.key, size: input.body.length, sha256: input.sha256 },
    "Uploaded settlement hibah receipt PDF"
  );
}

export async function generateReceiptPdfViewUrl(input: {
  storageKey: string;
  fileName: string;
  disposition?: "inline" | "attachment";
}): Promise<{ viewUrl: string; expiresIn: number }> {
  const client = getS3Client();
  const safeName = input.fileName.replace(/"/g, "");
  const disposition = input.disposition ?? "inline";
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: input.storageKey,
    ResponseContentType: RECEIPT_PDF_CONTENT_TYPE,
    ResponseContentDisposition: `${disposition}; filename="${safeName}"`,
  });
  const viewUrl = await getSignedUrl(client, command, {
    expiresIn: RECEIPT_PDF_VIEW_URL_EXPIRY_SECONDS,
  });
  return { viewUrl, expiresIn: RECEIPT_PDF_VIEW_URL_EXPIRY_SECONDS };
}
