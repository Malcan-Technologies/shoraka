import { Request, Response, NextFunction, Router } from "express";
import { UserRole } from "@prisma/client";
import { 
  generatePresignedDownloadUrl, 
  generatePresignedViewUrl 
} from "../../lib/s3/client";
import { requestDownloadUrlSchema, requestViewUrlSchema } from "./schemas";
import { requireAuth } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { applicationService } from "../applications/service";

/**
 * Extract applicationId from keys shaped like applications/{applicationId}/…
 * (document uploads, signing PDFs, etc.).
 */
export function parseApplicationIdFromS3Key(s3Key: string): string | null {
  const match = /^applications\/([^/]+)\//.exec(s3Key.trim());
  const applicationId = match?.[1]?.trim();
  return applicationId || null;
}

async function assertCanAccessS3Key(req: Request, s3Key: string): Promise<void> {
  const applicationId = parseApplicationIdFromS3Key(s3Key);
  if (!applicationId) {
    // Non-application keys (products/, site docs, etc.) stay on auth-only for this route.
    return;
  }

  const userId = req.user?.user_id;
  if (!userId) {
    throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
  }

  const isAdmin = Boolean(req.user?.roles?.includes(UserRole.ADMIN));
  await applicationService.assertCanAccessApplicationDocuments({
    applicationId,
    userId,
    asAdmin: isAdmin,
  });
}

/**
 * Request presigned URL for downloading a file
 * POST /v1/s3/download-url
 */
async function getDownloadUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { s3Key } = requestDownloadUrlSchema.parse(req.body);
    await assertCanAccessS3Key(req, s3Key);
    const data = await generatePresignedDownloadUrl({ key: s3Key });

    logger.debug({ s3KeyPrefix: s3Key.split("/").slice(0, 2).join("/") }, "Generated presigned download URL");

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
    await assertCanAccessS3Key(req, s3Key);
    const data = await generatePresignedViewUrl({ key: s3Key });

    logger.debug({ s3KeyPrefix: s3Key.split("/").slice(0, 2).join("/") }, "Generated presigned view URL");

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
