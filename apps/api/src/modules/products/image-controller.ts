import { Request, Response, NextFunction, Router } from "express";
import {
  requestProductImageUploadUrlSchema,
  requestProductImageDownloadUrlSchema,
} from "./schemas";
import { requireAuth, requireRole } from "../../lib/auth/middleware";
import { UserRole } from "@prisma/client";
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  generateProductImageKey,
  getFileExtension,
  validateProductImage,
} from "../../lib/s3/client";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";

/**
 * Generate a simple cuid-like string for S3 keys
 */
function generateCuid(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}${random}`;
}

/**
 * Request presigned URL for uploading product image
 * POST /v1/products/images/upload-url
 */
async function requestProductImageUploadUrl(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validated = requestProductImageUploadUrlSchema.parse(req.body);

    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
    }

    // Validate file
    const validation = validateProductImage({
      contentType: validated.contentType,
      fileSize: validated.fileSize,
    });

    if (!validation.valid) {
      throw new AppError(400, "VALIDATION_ERROR", validation.error!);
    }

    // Generate unique S3 key with financing type name folder structure
    const extension = getFileExtension(validated.fileName);
    const cuid = generateCuid();
    const s3Key = generateProductImageKey({
      financingTypeName: validated.financingTypeName,
      cuid,
      extension,
    });

    // Generate presigned upload URL
    const { uploadUrl, expiresIn } = await generatePresignedUploadUrl({
      key: s3Key,
      contentType: validated.contentType,
      contentLength: validated.fileSize,
    });

    logger.info(
      { s3Key, adminUserId: req.user.user_id },
      "Generated presigned upload URL for product image"
    );

    res.json({
      success: true,
      data: {
        uploadUrl,
        s3Key,
        expiresIn,
      },
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Request presigned URL for downloading product image
 * POST /v1/products/images/download-url
 */
async function requestProductImageDownloadUrl(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validated = requestProductImageDownloadUrlSchema.parse(req.body);

    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
    }

    // Generate presigned download URL
    const { downloadUrl, expiresIn } = await generatePresignedDownloadUrl({
      key: validated.s3Key,
    });

    logger.debug(
      { s3Key: validated.s3Key },
      "Generated presigned download URL for product image"
    );

    res.json({
      success: true,
      data: {
        downloadUrl,
        expiresIn,
      },
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create router for product image routes
 * Returns a router with all product image endpoints
 */
export function createProductImageRouter(): Router {
  const router = Router();

  // Request presigned upload URL (admin only)
  router.post(
    "/upload-url",
    requireAuth,
    requireRole(UserRole.ADMIN),
    requestProductImageUploadUrl
  );

  // Request presigned download URL (authenticated users)
  router.post(
    "/download-url",
    requireAuth,
    requestProductImageDownloadUrl
  );

  return router;
}
