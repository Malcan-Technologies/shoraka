import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/http/error-handler";
import { legalDocumentAcceptanceService } from "./acceptance-service";
import {
  acceptLegalDocumentSchema,
  accountLegalDocumentsQuerySchema,
  openLegalDocumentSchema,
  requiredLegalDocumentsQuerySchema,
} from "./schemas";

const router = Router();

router.get("/account", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
    }

    const validated = accountLegalDocumentsQuerySchema.parse(req.query);
    const documents = await legalDocumentAcceptanceService.listAccountDocuments(
      req.user,
      validated.audience,
      req.activeRole
    );

    res.json({
      success: true,
      data: { documents },
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

router.post(
  "/versions/:versionId/open",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const validated = openLegalDocumentSchema.parse(req.body);
      const acceptance = await legalDocumentAcceptanceService.recordOpened(
        req,
        req.user.user_id,
        req.params.versionId,
        validated.organizationId,
        validated.audience
      );

      const download = await legalDocumentAcceptanceService.getPublishedDownloadUrl(
        req.params.versionId
      );
      const view = await legalDocumentAcceptanceService.getPublishedViewUrl(req.params.versionId);

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
  }
);

router.post(
  "/versions/:versionId/accept",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const validated = acceptLegalDocumentSchema.parse(req.body);
      const acceptance = await legalDocumentAcceptanceService.recordAccepted(
        req,
        req.user.user_id,
        req.params.versionId,
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
  }
);

router.get(
  "/versions/:versionId/download",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await legalDocumentAcceptanceService.getPublishedDownloadUrl(
        req.params.versionId
      );
      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

export const legalDocumentUserRouter = router;
