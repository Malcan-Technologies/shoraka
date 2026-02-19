import { Request, Response, NextFunction, Router } from "express";
import { applicationService } from "./service";
import {
  createApplicationSchema,
  updateApplicationStepSchema,
  applicationIdParamSchema,
} from "./schemas";
import { requireAuth } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { z } from "zod";
import { createApplicationLog } from "./application-log";

/**
 * Get authenticated user ID from request
 */
function getUserId(req: Request): string {
  if (!req.user?.user_id) {
    throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
  }
  return req.user.user_id;
}


/**
 * Create a new application
 * POST /v1/applications
 */
async function createApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createApplicationSchema.parse(req.body);
    const application = await applicationService.createApplication(input);

    // Audit log: APPLICATION_CREATED
    try {
      await createApplicationLog(req, "APPLICATION_CREATED", application, {
        correlationId: res.locals.correlationId || null,
      });
    } catch {
      // ignore
    }

    res.status(201).json({
      success: true,
      data: application,
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get application by ID
 * GET /v1/applications/:id
 */
async function getApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = applicationIdParamSchema.parse(req.params);
    const userId = getUserId(req);
    const data = await applicationService.getApplication(id, userId);

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
 * Update an application step
 * PATCH /v1/applications/:id/step
 */
async function updateApplicationStep(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = applicationIdParamSchema.parse(req.params);
    const input = updateApplicationStepSchema.parse(req.body);
    const userId = getUserId(req);
    const application = await applicationService.updateStep(id, input, userId);

    res.json({
      success: true,
      data: application,
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Archive an application
 * POST /v1/applications/:id/archive
 */
async function archiveApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = applicationIdParamSchema.parse(req.params);
    const userId = getUserId(req);
    const application = await applicationService.archiveApplication(id, userId);

    res.json({
      success: true,
      data: application,
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

const requestUploadUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.literal("application/pdf"),
  fileSize: z.number().int().positive().max(5 * 1024 * 1024), // Max 5MB
  existingS3Key: z.string().optional(),
});

/**
 * Request presigned URL for uploading application document
 * POST /v1/applications/:id/upload-document-url
 */
async function requestUploadUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = applicationIdParamSchema.parse(req.params);
    const input = requestUploadUrlSchema.parse(req.body);
    const userId = getUserId(req);

    const result = await applicationService.requestUploadUrl({
      applicationId: id,
      fileName: input.fileName,
      contentType: input.contentType,
      fileSize: input.fileSize,
      existingS3Key: input.existingS3Key,
      userId,
    });

    res.json({
      success: true,
      data: result,
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

const deleteDocumentSchema = z.object({
  s3Key: z.string().min(1),
});

/**
 * Delete an application document from S3
 * DELETE /v1/applications/:id/document
 */
async function deleteDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = applicationIdParamSchema.parse(req.params);
    const input = deleteDocumentSchema.parse(req.body);
    const userId = getUserId(req);

    await applicationService.deleteDocument(id, input.s3Key, userId);

    res.json({
      success: true,
      data: { message: "Document deleted successfully" },
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

const updateStatusSchema = z.object({
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "ARCHIVED"]),
});

/**
 * Update application status
 * PATCH /v1/applications/:id/status
 */
async function updateApplicationStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = applicationIdParamSchema.parse(req.params);
    const { status } = updateStatusSchema.parse(req.body);
    const userId = getUserId(req);

    const result = await applicationService.updateApplicationStatus(id, status, userId);

    // If submitted, write application submitted audit log
    if (status === "SUBMITTED") {
      try {
        await createApplicationLog(req, "APPLICATION_SUBMITTED", result, {
          correlationId: res.locals.correlationId || null,
        });
      } catch {
        // ignore
      }
    }

    res.json({
      success: true,
      data: result,
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create router for application routes
 */
export function createApplicationRouter(): Router {
  const router = Router();

  router.post("/", requireAuth, createApplication);

  // More specific routes must come before parameterized routes
  router.post(
    "/:id/upload-document-url",
    requireAuth,
    requestUploadUrl
  );
  router.delete("/:id/document", requireAuth, deleteDocument);
  router.patch("/:id/step", requireAuth, updateApplicationStep);
  router.patch("/:id/status", requireAuth, updateApplicationStatus);
  router.post("/:id/archive", requireAuth, archiveApplication);

  // Parameterized route comes last
  router.get("/:id", requireAuth, getApplication);

  return router;
}
