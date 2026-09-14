import { createHash } from "crypto";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import {
  SIGNINGCLOUD_LEGAL_IMAGE_INVALID_MESSAGE,
  SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES,
  SIGNINGCLOUD_LEGAL_IMAGE_TOO_LARGE_MESSAGE,
  signingCloudLegalImageDimensionRejection,
  type SigningCloudLegalImageTransparency,
} from "@cashsouk/types";
import { AppError } from "../http/error-handler";
import { logger } from "../logger";
import { inspectRasterImage } from "../images/raster-image";
import { getS3Client, S3_BUCKET } from "../s3/client";

export type ConfirmedLegalImage = {
  sha256: string;
  byteSize: number;
  widthPx: number;
  heightPx: number;
  contentType: "image/png" | "image/jpeg";
  transparencyMode: SigningCloudLegalImageTransparency;
};

/** @deprecated Prefer ConfirmedLegalImage. */
export type ConfirmedSigningCloudLegalImage = ConfirmedLegalImage;

function sanitizeKeyForLog(key: string): string {
  const parts = key.split("/").filter(Boolean);
  if (parts.length <= 2) return "…";
  return `${parts[0]}/…/${parts[parts.length - 1]}`;
}

export async function readS3ObjectBytes(key: string, maxBytes: number): Promise<Buffer> {
  const client = getS3Client();
  let res;
  try {
    res = await client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NoSuchKey" || name === "NotFound") {
      throw new AppError(400, "S3_OBJECT_MISSING", "Uploaded image was not found in storage");
    }
    logger.warn({ keyPreview: sanitizeKeyForLog(key), errName: name }, "Failed to read S3 image");
    throw new AppError(502, "S3_READ_FAILED", "Could not read uploaded image from storage");
  }
  if (!res.Body) {
    throw new AppError(400, "S3_OBJECT_EMPTY", "Uploaded image is empty");
  }

  const chunks: Buffer[] = [];
  let byteLength = 0;
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    const buf = Buffer.from(chunk);
    byteLength += buf.length;
    if (byteLength > maxBytes) {
      throw new AppError(400, "VALIDATION_ERROR", `File too large. Maximum size: ${maxBytes} bytes`);
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

export function confirmLegalImageBytes(bytes: Buffer): ConfirmedLegalImage {
  if (bytes.length <= 0 || bytes.length > SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES) {
    throw new AppError(400, "VALIDATION_ERROR", SIGNINGCLOUD_LEGAL_IMAGE_TOO_LARGE_MESSAGE);
  }
  const info = inspectRasterImage(bytes);
  if (!info) {
    throw new AppError(400, "VALIDATION_ERROR", SIGNINGCLOUD_LEGAL_IMAGE_INVALID_MESSAGE);
  }
  const dimensionError = signingCloudLegalImageDimensionRejection(info.width, info.height);
  if (dimensionError) {
    throw new AppError(400, "VALIDATION_ERROR", dimensionError);
  }
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteSize: bytes.length,
    widthPx: info.width,
    heightPx: info.height,
    contentType: info.contentType,
    transparencyMode: info.transparency,
  };
}

export const confirmSigningCloudLegalImageBytes = confirmLegalImageBytes;

export async function confirmLegalImageFromS3(key: string): Promise<ConfirmedLegalImage> {
  const bytes = await readS3ObjectBytes(key, SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES);
  return confirmLegalImageBytes(bytes);
}

export const confirmSigningCloudLegalImageFromS3 = confirmLegalImageFromS3;
