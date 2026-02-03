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

/**
 * Generate direct S3 object URL (standardized AWS format)
 * 
 * AWS S3 has standardized URL formats. This function uses the virtual-hosted style:
 * Format: https://{bucket}.s3.{region}.amazonaws.com/{key}
 * 
 * Other standardized formats AWS supports:
 * 1. Virtual-hosted style (what we use):
 *    https://bucket-name.s3.region.amazonaws.com/key
 * 
 * 2. Path-style (legacy, still supported):
 *    https://s3.region.amazonaws.com/bucket-name/key
 * 
 * 3. Virtual-hosted style without region (older, works for us-east-1):
 *    https://bucket-name.s3.amazonaws.com/key
 * 
 * 4. S3 website endpoint (if bucket is configured as static website):
 *    https://bucket-name.s3-website.region.amazonaws.com/key
 * 
 * Note: Only works if the bucket/object is publicly accessible
 * For private buckets, use generatePresignedDownloadUrl instead
 * 
 * @param key - S3 object key (e.g., "product-images/2025-01-15-abc123.jpg")
 * @returns Direct S3 URL (only works if object is public)
 */
export function generateDirectS3Url(key: string): string {
  // URL-encode the key to handle special characters in file paths
  // But preserve forward slashes (/) as they're part of the path structure
  const encodedKey = encodeURIComponent(key).replace(/%2F/g, "/");
  
  // Standardized virtual-hosted style URL format
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${encodedKey}`;
}

/**
 * Test if an S3 object is publicly accessible
 * Returns true if the object can be accessed without authentication
 */
export async function testS3ObjectPublicAccess(key: string): Promise<boolean> {
  const directUrl = generateDirectS3Url(key);
  
  try {
    // Try to fetch the object without any authentication
    const response = await fetch(directUrl, {
      method: "HEAD", // Just check if it exists, don't download
      // No Authorization header = public access test
    });
    
    // If we get 200 OK, the object is publicly accessible
    return response.ok;
  } catch (error) {
    // If fetch fails or returns 403/404, it's not publicly accessible
    return false;
  }
}

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
 * For images, use ResponseContentDisposition: inline to display in browser
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
 * Generate a presigned URL for viewing an image (inline display)
 */
export async function generatePresignedViewUrl(
  params: { key: string }
): Promise<{ viewUrl: string; expiresIn: number }> {
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: params.key,
    ResponseContentDisposition: "inline", // Display in browser instead of download
  });

  const viewUrl = await getSignedUrl(client, command, {
    expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS,
  });

  logger.debug({ key: params.key }, "Generated presigned view URL for image");

  return {
    viewUrl,
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
 * Generate S3 key for product images (admin upload, stored in workflow config).
 * Format: products/images/{timestamp}{random}.{ext}
 */
export function generateProductImageKey(extension: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `products/images/${timestamp}${random}.${extension}`;
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

// applications logic

/**
 * Generate S3 key for application documents
 * Format: applications/{applicationId}/v{version}-{date}-{cuid}.{ext}
 * Follows the same pattern as product images: v{version}-{date}-{cuid}.{ext}
 * 
 * @param params - Parameters for generating the S3 key
 * @param params.applicationId - Application ID
 * @param params.cuid - Unique identifier for the file
 * @param params.extension - File extension (e.g., "png")
 * @param params.version - Version number (defaults to 1)
 */
export function generateApplicationDocumentKey(params: {
  applicationId: string;
  cuid: string;
  extension: string;
  version?: number;
}): string {
  const date = new Date().toISOString().split("T")[0];
  const version = params.version ?? 1;
  return `applications/${params.applicationId}/v${version}-${date}-${params.cuid}.${params.extension}`;
}

/**
 * Parse application document S3 key to extract version, date, cuid, extension, and application ID
 * Format: applications/{applicationId}/v{version}-{date}-{cuid}.{ext}
 * Returns null if format doesn't match
 */
export function parseApplicationDocumentKey(s3Key: string): {
  applicationId: string;
  version: number;
  date: string;
  cuid: string;
  extension: string;
} | null {
  const match = s3Key.match(/^applications\/([^/]+)\/v(\d+)-(\d{4}-\d{2}-\d{2})-([^.]+)\.(.+)$/);
  if (!match) {
    return null;
  }
  return {
    applicationId: match[1],
    version: parseInt(match[2], 10),
    date: match[3],
    cuid: match[4],
    extension: match[5],
  };
}

/**
 * Generate application document S3 key with incremented version (for replacements)
 * Reuses the same cuid and application ID, increments version, updates date
 */
export function generateApplicationDocumentKeyWithVersion(params: {
  existingS3Key: string;
  extension: string;
}): string | null {
  const parsed = parseApplicationDocumentKey(params.existingS3Key);
  if (!parsed) {
    return null;
  }
  const newVersion = parsed.version + 1;
  const date = new Date().toISOString().split("T")[0];
  return `applications/${parsed.applicationId}/v${newVersion}-${date}-${parsed.cuid}.${params.extension}`;
}

/**
 * Validate file type and size for application documents
 * Only PNG images are allowed, max 5MB
 */
export function validateApplicationDocument(params: {
  contentType: string;
  fileSize: number;
}): { valid: boolean; error?: string } {
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_CONTENT_TYPES = ["image/png"];

  if (!ALLOWED_CONTENT_TYPES.includes(params.contentType.toLowerCase())) {
    return {
      valid: false,
      error: `Invalid content type. Only PNG images are allowed for application documents.`,
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