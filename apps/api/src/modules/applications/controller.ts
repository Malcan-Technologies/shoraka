/**
 * Guide: docs/guides/application-flow/amendment-flow.md — Amendment flow API routes (amendment-context, acknowledge, resubmit)
 */

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
import { logApplicationActivity } from "./logs/service";
import { ActivityLevel, ActivityTarget, ActivityAction, ActivityPortal } from "./logs/types";

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
    // Log application creation (issuer flow). Do not break main flow on failure.
    try {
      const callerUserId = getUserId(req);
      await logApplicationActivity({
        userId: callerUserId,
        applicationId: application.id,
        level: ActivityLevel.APPLICATION,
        target: ActivityTarget.APPLICATION,
        action: ActivityAction.CREATED,
        reviewCycle: 1,
        ipAddress: req.ip ?? undefined,
        userAgent:
          (Array.isArray(req.headers["user-agent"])
            ? req.headers["user-agent"][0]
            : req.headers["user-agent"]) ?? undefined,
        portal: ActivityPortal.ISSUER,
      });
    } catch {
      // swallow errors
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
  status: z.enum(["DRAFT", "SUBMITTED", "RESUBMITTED", "APPROVED", "REJECTED", "ARCHIVED"]),
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
    try {
      const callerUserId = getUserId(req);

      // Issuer flows
      if (status === "SUBMITTED" || status === "RESUBMITTED") {
        await logApplicationActivity({
          userId: callerUserId,
          applicationId: result.id,
          level: ActivityLevel.APPLICATION,
          target: ActivityTarget.APPLICATION,
          action: status === "RESUBMITTED" ? ActivityAction.RESUBMITTED : ActivityAction.SUBMITTED,
          reviewCycle: (result as any)?.review_cycle ?? undefined,
          ipAddress: req.ip ?? undefined,
          userAgent:
            (Array.isArray(req.headers["user-agent"])
              ? req.headers["user-agent"][0]
              : req.headers["user-agent"]) ?? undefined,
          portal: ActivityPortal.ISSUER
        });
      }

      // Admin flows
      if (status === "APPROVED" || status === "REJECTED") {
        await logApplicationActivity({
          userId: callerUserId,
          applicationId: result.id,
          level: ActivityLevel.APPLICATION,
          target: ActivityTarget.APPLICATION,
          action: status === "APPROVED" ? ActivityAction.APPROVED : ActivityAction.REJECTED,
          reviewCycle: (result as any)?.review_cycle ?? undefined,
          ipAddress: req.ip ?? undefined,
          userAgent:
            (Array.isArray(req.headers["user-agent"])
              ? req.headers["user-agent"][0]
              : req.headers["user-agent"]) ?? undefined,
          portal: ActivityPortal.ADMIN
        });
      }
    } catch {
      // swallow errors
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

async function getApplicationLogsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = applicationIdParamSchema.parse(req.params);
    const userId = getUserId(req);

    const logs = await applicationService.getApplicationLogs(id, userId);

    res.json({
      success: true,
      data: logs,
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
  router.post(
    "/:id/offers/contracts/accept",
    requireAuth,
    async (req, res, next) => {
      try {
        const { id } = applicationIdParamSchema.parse(req.params);
        const userId = getUserId(req);
        const data = await applicationService.respondToContractOffer(id, "accept", userId);
        res.json({ success: true, data, correlationId: res.locals.correlationId || "unknown" });
      } catch (e) {
        next(e);
      }
    }
  );
  router.post(
    "/:id/offers/contracts/reject",
    requireAuth,
    async (req, res, next) => {
      try {
        const { id } = applicationIdParamSchema.parse(req.params);
        const userId = getUserId(req);
        const data = await applicationService.respondToContractOffer(id, "reject", userId);
        res.json({ success: true, data, correlationId: res.locals.correlationId || "unknown" });
      } catch (e) {
        next(e);
      }
    }
  );
  router.post(
    "/:id/offers/invoices/:invoiceId/accept",
    requireAuth,
    async (req, res, next) => {
      try {
        const { id } = applicationIdParamSchema.parse(req.params);
        const invoiceId = z.string().cuid().parse(req.params.invoiceId);
        const userId = getUserId(req);
        const data = await applicationService.respondToInvoiceOffer(id, invoiceId, "accept", userId);
        res.json({ success: true, data, correlationId: res.locals.correlationId || "unknown" });
      } catch (e) {
        next(e);
      }
    }
  );
  router.post(
    "/:id/offers/invoices/:invoiceId/reject",
    requireAuth,
    async (req, res, next) => {
      try {
        const { id } = applicationIdParamSchema.parse(req.params);
        const invoiceId = z.string().cuid().parse(req.params.invoiceId);
        const userId = getUserId(req);
        const data = await applicationService.respondToInvoiceOffer(id, invoiceId, "reject", userId);
        res.json({ success: true, data, correlationId: res.locals.correlationId || "unknown" });
      } catch (e) {
        next(e);
      }
    }
  );
  router.delete("/:id/document", requireAuth, deleteDocument);
  router.patch("/:id/step", requireAuth, updateApplicationStep);
  router.patch("/:id/status", requireAuth, updateApplicationStatus);
router.get("/:id/amendment-context", requireAuth, async function getAmendmentContext(req, res, next) {
  try {
    const { id } = applicationIdParamSchema.parse(req.params);
    const userId = getUserId(req);
    const result = await applicationService.getAmendmentContext(id, userId);
    res.json({
      success: true,
      data: result,
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", requireAuth, async function listApplications(req, res, next) {
  try {
    const organizationId = req.query.organizationId as string | undefined;
    if (!organizationId) {
      throw new AppError(400, "BAD_REQUEST", "organizationId query parameter is required");
    }
    const userId = getUserId(req);
    const result = await applicationService.listByOrganization(organizationId, userId);
    res.json({
      success: true,
      data: result,
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
});
  router.post("/:id/archive", requireAuth, archiveApplication);

  // Parameterized route comes last
  
  router.get("/:id/logs", requireAuth, getApplicationLogsHandler);
router.get("/:id", requireAuth, getApplication);
  router.post(
    "/:id/acknowledge-workflow",
    requireAuth,
    async function acknowledgeWorkflowHandler(req, res, next) {
      try {
        const { id } = applicationIdParamSchema.parse(req.params);
        const body = z.object({ workflowId: z.string().min(1) }).parse(req.body);
        const userId = getUserId(req);
        const result = await applicationService.acknowledgeWorkflow(id, userId, body.workflowId);
        res.json({
          success: true,
          data: result,
          correlationId: res.locals.correlationId || "unknown",
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:id/resubmit",
    requireAuth,
    async function resubmitHandler(req, res, next) {
      try {
        const { id } = applicationIdParamSchema.parse(req.params);
        const userId = getUserId(req);
        const result = await applicationService.resubmitApplication(id, userId);
        res.json({
          success: true,
          data: result,
          correlationId: res.locals.correlationId || "unknown",
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
