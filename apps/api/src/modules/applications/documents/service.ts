/**
 * Application document S3 operations.
 * Handles presigned URL generation and S3 object deletion for application documents.
 * Access checks and validation are performed by the main ApplicationService before calling these.
 */

import {
  generateApplicationDocumentKey,
  generateApplicationDocumentKeyWithVersion,
  parseApplicationDocumentKey,
  generatePresignedUploadUrl,
  getFileExtension,
  deleteS3Object,
} from "../../../lib/s3/client";
import { logger } from "../../../lib/logger";
import { AppError } from "../../../lib/http/error-handler";
import { contentTypeForSupportingDocFileName } from "../supporting-docs-workflow";

function generateCuid(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}${random}`;
}

export interface RequestPresignedUploadUrlParams {
  applicationId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  existingS3Key?: string;
}

/**
 * Generate S3 key and presigned upload URL for application document.
 * Caller must validate access and file type/size before invoking.
 */
export async function requestPresignedUploadUrl(params: RequestPresignedUploadUrlParams): Promise<{
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}> {
  const extension = getFileExtension(params.fileName);
  if (extension !== "pdf" && extension !== "xlsx" && extension !== "xls") {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid file type");
  }

  const maxSizeInBytes = 5 * 1024 * 1024;
  if (params.fileSize > maxSizeInBytes) {
    throw new AppError(400, "VALIDATION_ERROR", "File size must be less than 5MB");
  }

  const contentType = contentTypeForSupportingDocFileName(params.fileName);
  let s3Key: string;

  if (params.existingS3Key) {
    const parsed = parseApplicationDocumentKey(params.existingS3Key);
    if (!parsed) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid existing S3 key format");
    }
    const newKey = generateApplicationDocumentKeyWithVersion({
      existingS3Key: params.existingS3Key,
      extension,
    });
    if (!newKey) {
      throw new AppError(400, "VALIDATION_ERROR", "Failed to generate new S3 key");
    }
    s3Key = newKey;
  } else {
    const cuid = generateCuid();
    s3Key = generateApplicationDocumentKey({
      applicationId: params.applicationId,
      cuid,
      extension,
      version: 1,
    });
  }

  const { uploadUrl, expiresIn } = await generatePresignedUploadUrl({
    key: s3Key,
    contentType,
    contentLength: params.fileSize,
  });

  return { uploadUrl, s3Key, expiresIn };
}

/**
 * Delete application document from S3.
 * Caller must validate access before invoking.
 */
export async function deleteDocumentFromS3(s3Key: string): Promise<void> {
  try {
    await deleteS3Object(s3Key);
    logger.info({ s3Key }, "Deleted application document from S3");
  } catch (error) {
    logger.warn({ s3Key, error }, "Failed to delete application document from S3");
    throw new AppError(500, "DELETE_FAILED", "Failed to delete document from S3");
  }
}
