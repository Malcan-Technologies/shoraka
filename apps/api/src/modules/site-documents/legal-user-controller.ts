import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/http/error-handler";
import { legalDocumentAcceptanceService } from "./acceptance-service";
import {
  acceptLegalDocumentSchema,
  openLegalDocumentSchema,
  requiredLegalDocumentsQuerySchema,
} from "./schemas";

const router = Router();

/**
 * GET /v1/legal-documents/required
 * Required published legal PDFs + acceptance status for the caller's org/role.
 */
router.get("/required", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
    }

    const validated = requiredLegalDocumentsQuerySchema.parse(req.query);
    const data = await legalDocumentAcceptanceService.getRequiredDocuments(
      req.user.user_id,
      validated.organizationId,
      validated.audience
    );

    res.json({
      success: true,
      data,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(
      error instanceof AppError
        ? error
        : error instanceof Error
          ? new AppError(400, "VALIDATION_ERROR", error.message)
          : error
    );
  }
});

/**
 * GET /v1/legal-documents/acceptance-status
 * Full compliance status including pending re-acceptance and blocked actions.
 */
router.get("/acceptance-status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
    }

    const validated = requiredLegalDocumentsQuerySchema.parse(req.query);
    const data = await legalDocumentAcceptanceService.getComplianceStatus(
      req.user.user_id,
      validated.organizationId,
      validated.audience
    );

    res.json({
      success: true,
      data,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(
      error instanceof AppError
        ? error
        : error instanceof Error
          ? new AppError(400, "VALIDATION_ERROR", error.message)
          : error
    );
  }
});

/**
 * GET /v1/legal-documents/pending
 * Pending re-acceptance documents for existing onboarded organisations.
 */
router.get("/pending", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
    }

    const validated = requiredLegalDocumentsQuerySchema.parse(req.query);
    const documents = await legalDocumentAcceptanceService.getPendingReacceptanceDocuments(
      req.user.user_id,
      validated.organizationId,
      validated.audience
    );

    res.json({
      success: true,
      data: {
        documents,
        hasPendingReacceptance: documents.length > 0,
      },
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(
      error instanceof AppError
        ? error
        : error instanceof Error
          ? new AppError(400, "VALIDATION_ERROR", error.message)
          : error
    );
  }
});

/**
 * POST /v1/legal-documents/:id/open
 * Record that the user clicked View/Download PDF (idempotent).
 */
router.post("/:id/open", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
    }

    const validated = openLegalDocumentSchema.parse(req.body);
    const acceptance = await legalDocumentAcceptanceService.recordOpened(
      req,
      req.user.user_id,
      req.params.id,
      validated.organizationId,
      validated.audience
    );

    const download = await legalDocumentAcceptanceService.getPublishedDownloadUrl(req.params.id);
    const view = await legalDocumentAcceptanceService.getPublishedViewUrl(req.params.id);

    res.json({
      success: true,
      data: {
        acceptance,
        downloadUrl: download.downloadUrl,
        viewUrl: view.viewUrl,
        expiresIn: download.expiresIn,
        fileName: download.fileName,
        contentType: download.contentType,
        fileSize: download.fileSize,
      },
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(
      error instanceof AppError
        ? error
        : error instanceof Error
          ? new AppError(400, "VALIDATION_ERROR", error.message)
          : error
    );
  }
});

/**
 * POST /v1/legal-documents/:id/accept
 * Accept a published document version (idempotent; requires prior open when configured).
 */
router.post("/:id/accept", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
    }

    const validated = acceptLegalDocumentSchema.parse(req.body);
    const acceptance = await legalDocumentAcceptanceService.recordAccepted(
      req,
      req.user.user_id,
      req.params.id,
      validated.organizationId,
      validated.audience
    );

    res.json({
      success: true,
      data: { acceptance },
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(
      error instanceof AppError
        ? error
        : error instanceof Error
          ? new AppError(400, "VALIDATION_ERROR", error.message)
          : error
    );
  }
});

/**
 * GET /v1/legal-documents/:id/download
 * Presigned download for a published legal document.
 */
router.get("/:id/download", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await legalDocumentAcceptanceService.getPublishedDownloadUrl(req.params.id);
    res.json({
      success: true,
      data: result,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error);
  }
});

export const legalDocumentUserRouter = router;
