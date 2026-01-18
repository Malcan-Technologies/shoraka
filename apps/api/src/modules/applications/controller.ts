import { Request, Response, NextFunction, Router } from "express";
import { NoteApplicationService } from "./service";
import { NoteApplicationRepository } from "./repository";
import {
  createDraftApplicationSchema,
  updateApplicationSchema,
  submitApplicationSchema,
  applicationIdParamSchema,
  validateStepQuerySchema,
  requestApplicationDocumentUploadUrlSchema,
} from "./schemas";
import { requireAuth } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";
import {
  generatePresignedUploadUrl,
  generateApplicationDocumentKey,
  validateApplicationDocument,
} from "../../lib/s3/client";

const applicationRepository = new NoteApplicationRepository();
const applicationService = new NoteApplicationService(applicationRepository);

/**
 * Get authenticated user ID from request
 */
function getUserId(req: Request): string {
  const user = req.user;
  if (!user?.user_id) {
    throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
  }
  return user.user_id;
}

/**
 * Get issuer organization ID from request body or user's first issuer org
 */
async function getIssuerOrganizationId(req: Request, bodyIssuerOrgId?: string): Promise<string> {
  const userId = getUserId(req);

  // If provided in body, validate user has access
  if (bodyIssuerOrgId) {
    const org = await prisma.issuerOrganization.findFirst({
      where: {
        id: bodyIssuerOrgId,
        OR: [
          { owner_user_id: userId },
          {
            members: {
              some: {
                user_id: userId,
              },
            },
          },
        ],
      },
    });

    if (!org) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have access to this issuer organization"
      );
    }

    return bodyIssuerOrgId;
  }

  // Otherwise, get user's first issuer organization
  const org = await prisma.issuerOrganization.findFirst({
    where: {
      OR: [
        { owner_user_id: userId },
        {
          members: {
            some: {
              user_id: userId,
            },
          },
        },
      ],
    },
    orderBy: {
      created_at: "asc",
    },
  });

  if (!org) {
    throw new AppError(
      404,
      "NO_ISSUER_ORGANIZATION",
      "You must have an issuer organization to create applications"
    );
  }

  return org.id;
}

/**
 * Create a new draft application
 * POST /v1/applications
 */
async function createDraftApplication(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = createDraftApplicationSchema.parse(req.body);
    const issuerOrganizationId = await getIssuerOrganizationId(
      req,
      (req.body as { issuerOrganizationId?: string }).issuerOrganizationId
    );

    const application = await applicationService.createDraftApplication(
      req,
      issuerOrganizationId,
      input
    );

    res.status(201).json({
      success: true,
      data: {
        id: application.id,
        status: application.status,
        lastCompletedStep: application.last_completed_step,
        financingType: application.financing_type,
        financingTerms: application.financing_terms,
        invoiceDetails: application.invoice_details,
        companyInfo: application.company_info,
        supportingDocuments: application.supporting_documents,
        declaration: application.declaration,
        createdAt: application.created_at,
        updatedAt: application.updated_at,
      },
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

    const application = await applicationService.getApplicationById(id);

    // Check user has access (is owner or member of issuer org)
    const hasAccess = application.issuer_organization.owner_user_id === userId ||
      application.issuer_organization.members.some(
        (m: { user_id: string }) => m.user_id === userId
      );

    if (!hasAccess) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have access to this application"
      );
    }

    res.json({
      success: true,
      data: {
        id: application.id,
        status: application.status,
        lastCompletedStep: application.last_completed_step,
        financingType: application.financing_type,
        financingTerms: application.financing_terms,
        invoiceDetails: application.invoice_details,
        companyInfo: application.company_info,
        supportingDocuments: application.supporting_documents,
        declaration: application.declaration,
        submittedAt: application.submitted_at,
        approvedAt: application.approved_at,
        rejectedAt: application.rejected_at,
        rejectionReason: application.rejection_reason,
        createdAt: application.created_at,
        updatedAt: application.updated_at,
      },
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Validate step access
 * GET /v1/applications/:id/validate-step?step=1
 */
async function validateStep(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = applicationIdParamSchema.parse(req.params);
    const { step } = validateStepQuerySchema.parse(req.query);
    const userId = getUserId(req);

    const application = await applicationService.getApplicationById(id);

    // Check user has access
    const hasAccess = application.issuer_organization.owner_user_id === userId ||
      application.issuer_organization.members.some(
        (m: { user_id: string }) => m.user_id === userId
      );

    if (!hasAccess) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have access to this application"
      );
    }

    const validation = applicationService.validateStepAccess(
      {
        status: application.status as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED",
        last_completed_step: application.last_completed_step,
        financing_type: application.financing_type,
        financing_terms: application.financing_terms,
        invoice_details: application.invoice_details,
        company_info: application.company_info,
        supporting_documents: application.supporting_documents,
        declaration: application.declaration,
      },
      step
    );

    res.json({
      success: true,
      data: {
        allowed: validation.allowed,
        lastAllowedStep: validation.lastAllowedStep,
      },
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update application (save step data)
 * PATCH /v1/applications/:id
 */
async function updateApplication(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = applicationIdParamSchema.parse(req.params);
    const userId = getUserId(req);
    const input = updateApplicationSchema.parse(req.body);

    const application = await applicationService.getApplicationById(id);

    // Check user has access
    const hasAccess = application.issuer_organization.owner_user_id === userId ||
      application.issuer_organization.members.some(
        (m: { user_id: string }) => m.user_id === userId
      );

    if (!hasAccess) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have access to this application"
      );
    }

    const updated = await applicationService.updateApplication(req, id, input);

    res.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        lastCompletedStep: updated.last_completed_step,
        financingType: updated.financing_type,
        financingTerms: updated.financing_terms,
        invoiceDetails: updated.invoice_details,
        companyInfo: updated.company_info,
        supportingDocuments: updated.supporting_documents,
        declaration: updated.declaration,
        updatedAt: updated.updated_at,
      },
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Submit application
 * POST /v1/applications/:id/submit
 */
async function submitApplication(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = applicationIdParamSchema.parse(req.params);
    const userId = getUserId(req);
    const input = submitApplicationSchema.parse(req.body);

    const application = await applicationService.getApplicationById(id);

    // Check user has access
    const hasAccess = application.issuer_organization.owner_user_id === userId ||
      application.issuer_organization.members.some(
        (m: { user_id: string }) => m.user_id === userId
      );

    if (!hasAccess) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have access to this application"
      );
    }

    const submitted = await applicationService.submitApplication(req, id, input);

    res.json({
      success: true,
      data: {
        id: submitted.id,
        status: submitted.status,
        submittedAt: submitted.submitted_at,
      },
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Request presigned URL for uploading application document
 * POST /v1/applications/:id/upload-document-url
 */
async function requestApplicationDocumentUploadUrl(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = applicationIdParamSchema.parse(req.params);
    const userId = getUserId(req);
    const input = requestApplicationDocumentUploadUrlSchema.parse(req.body);

    // Check user has access to this application
    const application = await applicationService.getApplicationById(id);
    const hasAccess =
      application.issuer_organization.owner_user_id === userId ||
      application.issuer_organization.members.some(
        (m: { user_id: string }) => m.user_id === userId
      );

    if (!hasAccess) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have access to this application"
      );
    }

    // Validate file
    const validation = validateApplicationDocument({
      contentType: input.contentType,
      fileSize: input.fileSize,
    });

    if (!validation.valid) {
      throw new AppError(400, "VALIDATION_ERROR", validation.error!);
    }

    // Generate S3 key
    const s3Key = generateApplicationDocumentKey({
      applicationId: id,
      fileName: input.fileName,
    });

    // Generate presigned upload URL
    const { uploadUrl, expiresIn } = await generatePresignedUploadUrl({
      key: s3Key,
      contentType: input.contentType,
      contentLength: input.fileSize,
    });

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
 * Create applications router
 */
export function createApplicationsRouter(): Router {
  const router = Router();

  router.post("/", requireAuth, createDraftApplication);
  router.get("/:id", requireAuth, getApplication);
  router.get("/:id/validate-step", requireAuth, validateStep);
  router.patch("/:id", requireAuth, updateApplication);
  router.post("/:id/submit", requireAuth, submitApplication);
  router.post("/:id/upload-document-url", requireAuth, requestApplicationDocumentUploadUrl);

  return router;
}
