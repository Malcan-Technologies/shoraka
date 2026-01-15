import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../lib/auth/middleware";
import { UserRole } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { generatePresignedUploadUrl, generatePresignedViewUrl, getFileExtension, s3ObjectExists } from "../../lib/s3/client";
import { logger } from "../../lib/logger";

const router = Router();

const requestImageUploadUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1),
  fileSize: z.number().positive().max(10 * 1024 * 1024), // 10MB max
  financingTypeName: z.string().min(1).max(255),
});

const ALLOWED_IMAGE_TYPES = ["image/png"];

function sanitizeFinancingTypeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

function generateImageKey(fileName: string, financingTypeName: string): string {
  const uuid = crypto.randomUUID();
  const extension = getFileExtension(fileName);
  const uniqueFilename = `${uuid}.${extension}`;
  const sanitized = sanitizeFinancingTypeName(financingTypeName);
  return `products/${sanitized}/${uniqueFilename}`;
}

router.post(
  "/upload-url",
  requireAuth,
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = requestImageUploadUrlSchema.parse(req.body);

      if (!ALLOWED_IMAGE_TYPES.includes(validated.contentType)) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          `Invalid content type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(", ")}`
        );
      }

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const s3Key = generateImageKey(validated.fileName, validated.financingTypeName);

      const result = await generatePresignedUploadUrl({
        key: s3Key,
        contentType: validated.contentType,
        contentLength: validated.fileSize,
      });

      logger.info(
        { s3Key, financingTypeName: validated.financingTypeName, adminUserId: req.user.user_id },
        "Generated presigned upload URL for image"
      );

      res.json({
        success: true,
        data: {
          uploadUrl: result.uploadUrl,
          s3Key: result.key,
          expiresIn: result.expiresIn,
        },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(
        error instanceof AppError
          ? error
          : error instanceof z.ZodError
            ? new AppError(400, "VALIDATION_ERROR", error.errors[0]?.message || "Invalid input")
            : error instanceof Error
              ? new AppError(400, "VALIDATION_ERROR", error.message)
              : error
      );
    }
  }
);

/**
 * GET /v1/products/images/view-url
 * Get presigned URL for viewing an image
 */
router.get(
  "/view-url",
  requireAuth,
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { s3Key } = req.query;
      
      if (!s3Key || typeof s3Key !== "string") {
        throw new AppError(400, "VALIDATION_ERROR", "s3Key query parameter is required");
      }

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      // Verify file exists in S3 before generating presigned URL
      const exists = await s3ObjectExists(s3Key);
      if (!exists) {
        throw new AppError(404, "NOT_FOUND", `Image not found at key: ${s3Key}`);
      }

      const { viewUrl, expiresIn } = await generatePresignedViewUrl({
        key: s3Key,
      });

      logger.debug({ s3Key, adminUserId: req.user.user_id }, "Generated presigned view URL for image");

      res.json({
        success: true,
        data: {
          viewUrl,
          expiresIn,
        },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(
        error instanceof AppError
          ? error
          : error instanceof z.ZodError
            ? new AppError(400, "VALIDATION_ERROR", error.errors[0]?.message || "Invalid input")
            : error instanceof Error
              ? new AppError(400, "VALIDATION_ERROR", error.message)
              : error
      );
    }
  }
);

export { router as productImageRouter };
