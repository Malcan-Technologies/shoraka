import { Request, Response, NextFunction, Router } from "express";
import { 
  generatePresignedDownloadUrl, 
  generatePresignedViewUrl 
} from "../../lib/s3/client";
import { requestDownloadUrlSchema, requestViewUrlSchema } from "./schemas";
import { requireAuth } from "../../lib/auth/middleware";
import { logger } from "../../lib/logger";

/**
 * Request presigned URL for downloading a file
 * POST /v1/s3/download-url
 */
async function getDownloadUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { s3Key } = requestDownloadUrlSchema.parse(req.body);
    const data = await generatePresignedDownloadUrl({ key: s3Key });

    logger.debug({ s3Key }, "Generated presigned download URL");

    res.json({
      success: true,
      data,
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Request presigned URL for viewing an image (inline)
 * POST /v1/s3/view-url
 */
async function getViewUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { s3Key } = requestViewUrlSchema.parse(req.body);
    const data = await generatePresignedViewUrl({ key: s3Key });

    logger.debug({ s3Key }, "Generated presigned view URL");

    res.json({
      success: true,
      data,
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create router for S3 routes
 */
export function createS3Router(): Router {
  const router = Router();

  router.post("/download-url", requireAuth, getDownloadUrl);
  router.post("/view-url", requireAuth, getViewUrl);

  return router;
}
