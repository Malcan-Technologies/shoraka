import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "../logger";

const S3_BUCKET = process.env.S3_BUCKET || "cashshouk-s3";
const S3_REGION = process.env.S3_REGION || "ap-southeast-5";

// Singleton S3 client - configured without request checksums for browser compatibility
let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: S3_REGION,
      // Disable request checksums - required for browser-based presigned URL uploads
      // Browser fetch() doesn't include the checksum headers that SDK adds to presigned URLs
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    logger.info({ bucket: S3_BUCKET, region: S3_REGION }, "S3 client initialized");
  }
  return s3Client;
}

export { S3_BUCKET, S3_REGION };

// Presigned URL expiration times
const UPLOAD_URL_EXPIRY_SECONDS = 15 * 60; // 15 minutes
const DOWNLOAD_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour

export interface PresignedUploadUrlParams {
  key: string;
  contentType: string;
  contentLength?: number;
}

export interface PresignedDownloadUrlParams {
  key: string;
  fileName?: string; // Optional: for Content-Disposition header
}

/**
 * Generate a presigned URL for uploading a file to S3
 * Note: We don't include ContentType in the command to avoid signature mismatches
 * The browser will send the correct Content-Type header with the upload
 */
export async function generatePresignedUploadUrl(
  params: PresignedUploadUrlParams
): Promise<{ uploadUrl: string; key: string; expiresIn: number }> {
  const client = getS3Client();

  // Don't include ContentType in the signed request - let the browser set it freely
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: params.key,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: UPLOAD_URL_EXPIRY_SECONDS,
  });

  logger.debug({ key: params.key, contentType: params.contentType }, "Generated presigned upload URL");

  return {
    uploadUrl,
    key: params.key,
    expiresIn: UPLOAD_URL_EXPIRY_SECONDS,
  };
}

/**
 * Generate a presigned URL for downloading a file from S3
 */
export async function generatePresignedDownloadUrl(
  params: PresignedDownloadUrlParams
): Promise<{ downloadUrl: string; expiresIn: number }> {
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: params.key,
    ...(params.fileName && {
      ResponseContentDisposition: `attachment; filename="${params.fileName}"`,
    }),
  });

  const downloadUrl = await getSignedUrl(client, command, {
    expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS,
  });

  logger.debug({ key: params.key }, "Generated presigned download URL");

  return {
    downloadUrl,
    expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS,
  };
}

/**
 * Delete a file from S3
 */
export async function deleteS3Object(key: string): Promise<void> {
  const client = getS3Client();

  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  await client.send(command);
  logger.info({ key }, "Deleted S3 object");
}

/**
 * Check if an object exists in S3
 */
export async function s3ObjectExists(key: string): Promise<boolean> {
  const client = getS3Client();

  try {
    const command = new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });
    await client.send(command);
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "NotFound") {
      return false;
    }
    throw error;
  }
}

/**
 * Generate S3 key for site documents
 * Format: site-documents/{type}/{version}-{date}-{cuid}.{ext}
 */
export function generateSiteDocumentKey(params: {
  type: string;
  version: number;
  cuid: string;
  extension: string;
}): string {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const typeSlug = params.type.toLowerCase().replace(/_/g, "-");
  return `site-documents/${typeSlug}/v${params.version}-${date}-${params.cuid}.${params.extension}`;
}

/**
 * Extract file extension from filename
 */
export function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

/**
 * Validate file type and size for site documents
 */
export function validateSiteDocument(params: {
  contentType: string;
  fileSize: number;
}): { valid: boolean; error?: string } {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_CONTENT_TYPES = ["application/pdf"];

  if (!ALLOWED_CONTENT_TYPES.includes(params.contentType)) {
    return {
      valid: false,
      error: `Invalid content type. Allowed types: ${ALLOWED_CONTENT_TYPES.join(", ")}`,
    };
  }

  if (params.fileSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}

