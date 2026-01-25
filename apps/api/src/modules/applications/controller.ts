import { Request, Response, NextFunction, Router } from "express";
import { applicationService } from "./service";
import {
  createApplicationSchema,
  updateApplicationStepSchema,
  applicationIdParamSchema,
} from "./schemas";
import { requireAuth } from "../../lib/auth/middleware";
import { z } from "zod";


/**
 * Create a new application
 * POST /v1/applications
 */
async function createApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createApplicationSchema.parse(req.body);
    const application = await applicationService.createApplication(input);

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
    const data = await applicationService.getApplication(id);

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
    const application = await applicationService.updateStep(id, input);

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
    const application = await applicationService.archiveApplication(id);

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
  contentType: z.literal("image/png"),
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

    const result = await applicationService.requestUploadUrl({
      applicationId: id,
      fileName: input.fileName,
      contentType: input.contentType,
      fileSize: input.fileSize,
      existingS3Key: input.existingS3Key,
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

    await applicationService.deleteDocument(input.s3Key);

    res.json({
      success: true,
      data: { message: "Document deleted successfully" },
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
  router.post("/:id/archive", requireAuth, archiveApplication);
  
  // Parameterized route comes last
  router.get("/:id", requireAuth, getApplication);

  return router;
}
