/**
 * Guide: docs/guides/application-flow/amendment-flow.md — Amendment flow API routes (amendment-context, acknowledge, resubmit)
 */

import { Request, Response, NextFunction, Router } from "express";
import { UserRole } from "@prisma/client";
import { applicationService } from "./service";
import {
  createApplicationSchema,
  updateApplicationStepSchema,
  applicationIdParamSchema,
} from "./schemas";
import { requireAuth, userHasPermission } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { z } from "zod";
import { auditContextFromRequest } from "../../lib/audit/context";
import { readSigningCloudConfigFromEnv } from "../signingcloud/signingcloud-api";

/**
 * Get authenticated user ID from request
 */
function getUserId(req: Request): string {
  if (!req.user?.user_id) {
    throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
  }
  return req.user.user_id;
}

function withDisplayReference<T extends { display_reference?: string | null }>(row: T): T & {
  displayReference: string | null;
} {
  return {
    ...row,
    displayReference: row.display_reference ?? null,
  };
}


/**
 * Create a new application
 * POST /v1/applications
 */
async function createApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createApplicationSchema.parse(req.body);
    const callerUserId = getUserId(req);
    const application = await applicationService.createApplication(
      input,
      callerUserId,
      auditContextFromRequest(req)
    );

    res.status(201).json({
      success: true,
      data: withDisplayReference(application),
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
      data: withDisplayReference(data),
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
    const application = await applicationService.updateStep(
      id,
      input,
      userId,
      auditContextFromRequest(req)
    );

    res.json({
      success: true,
      data: withDisplayReference(application),
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
    const application = await applicationService.archiveApplication(
      id,
      userId,
      auditContextFromRequest(req)
    );

    res.json({
      success: true,
      data: withDisplayReference(application),
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a draft application (issuer-only). Only draft applications. Safe deletion of draft data only.
 * DELETE /v1/applications/:id
 */
async function deleteDraftApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = applicationIdParamSchema.parse(req.params);
    const userId = getUserId(req);

    await applicationService.deleteDraftApplication(id, userId, auditContextFromRequest(req));

    res.json({
      success: true,
      data: { message: "Draft application deleted" },
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Cancel an application (issuer-only). Withdraws active invoices and contract.
 * POST /v1/applications/:id/cancel
 */
async function cancelApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = applicationIdParamSchema.parse(req.params);
    const userId = getUserId(req);
    const application = await applicationService.cancelApplication(id, userId);

    res.json({
      success: true,
      data: withDisplayReference(application),
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

const requestUploadUrlSchema = z
  .object({
    fileName: z.string().min(1),
    contentType: z.string().min(1),
    fileSize: z.number().int().positive().max(5 * 1024 * 1024), // Max 5MB
    existingS3Key: z.string().optional(),
    supportingDocCategoryKey: z.string().min(1).optional(),
    supportingDocIndex: z.number().int().min(0).optional(),
    acceptanceDocIndex: z.number().int().min(0).optional(),
    guarantorAgreementUpload: z.literal(true).optional(),
  })
  .superRefine((data, ctx) => {
    const hasKey = data.supportingDocCategoryKey !== undefined;
    const hasIdx = data.supportingDocIndex !== undefined;
    if (hasKey !== hasIdx) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "supportingDocCategoryKey and supportingDocIndex must be provided together",
        path: hasKey ? ["supportingDocIndex"] : ["supportingDocCategoryKey"],
      });
    }
    if (data.acceptanceDocIndex !== undefined && (hasKey || hasIdx)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "acceptanceDocIndex cannot be combined with supporting document slot fields",
        path: ["acceptanceDocIndex"],
      });
    }
    if (data.guarantorAgreementUpload && (hasKey || hasIdx || data.acceptanceDocIndex !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "guarantorAgreementUpload cannot be combined with document slot fields",
        path: ["guarantorAgreementUpload"],
      });
    }
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
      supportingDocCategoryKey: input.supportingDocCategoryKey,
      supportingDocIndex: input.supportingDocIndex,
      acceptanceDocIndex: input.acceptanceDocIndex,
      guarantorAgreementUpload: input.guarantorAgreementUpload,
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
  status: z.enum(["DRAFT", "SUBMITTED", "RESUBMITTED", "REJECTED", "ARCHIVED"]),
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

    const result = await applicationService.updateApplicationStatus(
      id,
      status,
      userId,
      auditContextFromRequest(req)
    );

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
    const isAdmin = Boolean(req.user?.roles?.includes(UserRole.ADMIN));
    if (isAdmin && !userHasPermission(req, "applications.view")) {
      throw new AppError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const logs = await applicationService.getApplicationLogs(id, userId, { asAdmin: isAdmin });

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
        if (readSigningCloudConfigFromEnv()) {
          throw new AppError(
            400,
            "USE_SIGNING_FLOW",
            "Complete signing via the signing envelope before accepting this offer."
          );
        }
        const data = await applicationService.respondToContractOffer(
          id,
          "accept",
          userId
        );
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
        const { reason } = z.object({ reason: z.string().max(2000).optional() }).parse(req.body ?? {});
        const userId = getUserId(req);
        const data = await applicationService.respondToContractOffer(id, "reject", userId, reason);
        res.json({ success: true, data, correlationId: res.locals.correlationId || "unknown" });
      } catch (e) {
        next(e);
      }
    }
  );
  router.post(
    "/:id/offers/contracts/acceptance",
    requireAuth,
    async (req, res, next) => {
      try {
        const { id } = applicationIdParamSchema.parse(req.params);
        const userId = getUserId(req);
        const data = await applicationService.submitContractOfferAcceptance(id, userId);
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
        if (readSigningCloudConfigFromEnv()) {
          // Contract-linked + contract envelope COMPLETED may accept without an envelope.
          // Invoice-only / incomplete contract signing still require the signing flow.
          await applicationService.assertInvoiceOfferAcceptAllowed(id, invoiceId, userId);
        }
        const data = await applicationService.respondToInvoiceOffer(
          id,
          invoiceId,
          "accept",
          userId
        );
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
        const { reason } = z.object({ reason: z.string().max(2000).optional() }).parse(req.body ?? {});
        const userId = getUserId(req);
        const data = await applicationService.respondToInvoiceOffer(id, invoiceId, "reject", userId, reason);
        res.json({ success: true, data, correlationId: res.locals.correlationId || "unknown" });
      } catch (e) {
        next(e);
      }
    }
  );
  router.post(
    "/:id/offers/invoices/:invoiceId/acceptance",
    requireAuth,
    async (req, res, next) => {
      try {
        const { id } = applicationIdParamSchema.parse(req.params);
        const invoiceId = z.string().cuid().parse(req.params.invoiceId);
        const userId = getUserId(req);
        const data = await applicationService.submitInvoiceOfferAcceptance(
          id,
          invoiceId,
          userId
        );
        res.json({ success: true, data, correlationId: res.locals.correlationId || "unknown" });
      } catch (e) {
        next(e);
      }
    }
  );
  router.get(
    "/:id/offers/contracts/signed-letter",
    requireAuth,
    async (req, res, next) => {
      try {
        const { id } = applicationIdParamSchema.parse(req.params);
        const userId = getUserId(req);
        const { buffer, filename } = await applicationService.getSignedContractOfferLetterBuffer(id, userId);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
        res.send(buffer);
      } catch (e) {
        next(e);
      }
    }
  );
  router.get(
    "/:id/offers/invoices/:invoiceId/signed-letter",
    requireAuth,
    async (req, res, next) => {
      try {
        const { id } = applicationIdParamSchema.parse(req.params);
        const invoiceId = z.string().cuid().parse(req.params.invoiceId);
        const userId = getUserId(req);
        const { buffer, filename } = await applicationService.getSignedInvoiceOfferLetterBuffer(
          id,
          invoiceId,
          userId
        );
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
        res.send(buffer);
      } catch (e) {
        next(e);
      }
    }
  );
  router.get(
    "/:id/offers/contracts/letter",
    requireAuth,
    async (req, res, next) => {
      try {
        const { id } = applicationIdParamSchema.parse(req.params);
        const userId = getUserId(req);
        const { stream, filename } = await applicationService.getContractOfferLetter(id, userId);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        stream.pipe(res);
      } catch (e) {
        next(e);
      }
    }
  );
  router.get(
    "/:id/offers/invoices/:invoiceId/letter",
    requireAuth,
    async (req, res, next) => {
      try {
        const { id } = applicationIdParamSchema.parse(req.params);
        const invoiceId = z.string().cuid().parse(req.params.invoiceId);
        const userId = getUserId(req);
        const { stream, filename } = await applicationService.getInvoiceOfferLetter(id, invoiceId, userId);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        stream.pipe(res);
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

router.get(
  "/:id/product-version-compare",
  requireAuth,
  async function getProductVersionCompare(req, res, next) {
    try {
      const { id } = applicationIdParamSchema.parse(req.params);
      const userId = getUserId(req);
      const data = await applicationService.getProductVersionCompareForApplication(id, userId);
      res.json({
        success: true,
        data,
        correlationId: res.locals.correlationId || "unknown",
      });
    } catch (error) {
      next(error);
    }
  }
);

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
      data: result.map((application) => withDisplayReference(application)),
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
});
  router.post("/:id/archive", requireAuth, archiveApplication);
  router.post("/:id/cancel", requireAuth, cancelApplication);
  router.delete("/:id", requireAuth, deleteDraftApplication);

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
        const result = await applicationService.acknowledgeWorkflow(
          id,
          userId,
          body.workflowId,
          auditContextFromRequest(req)
        );
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
        const result = await applicationService.resubmitApplication(
          id,
          userId,
          auditContextFromRequest(req)
        );
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
