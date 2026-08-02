import { Router, Request, Response, NextFunction } from "express";
import { requirePermission } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { legalDocumentService } from "./service";
import {
  createLegalDocumentSchema,
  createVersionSchema,
  listLegalDocumentsQuerySchema,
  publishVersionSchema,
  requestVersionUploadUrlSchema,
  updateLegalDocumentSchema,
  updateVersionSchema,
} from "./schemas";

const router = Router();

router.get(
  "/",
  requirePermission("document_management.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = listLegalDocumentsQuerySchema.parse(req.query);
      const result = await legalDocumentService.listDocuments(validated);
      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(
        error instanceof Error
          ? new AppError(400, "VALIDATION_ERROR", error.message)
          : error
      );
    }
  }
);

router.post(
  "/",
  requirePermission("document_management.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }
      const validated = createLegalDocumentSchema.parse(req.body);
      const document = await legalDocumentService.createDefinition(
        validated,
        req.user.user_id,
        req
      );
      res.status(201).json({
        success: true,
        data: { document },
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

router.patch(
  "/versions/:versionId",
  requirePermission("document_management.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }
      const validated = updateVersionSchema.parse(req.body);
      const version = await legalDocumentService.updateDraftVersion(
        req.params.versionId,
        validated,
        req.user.user_id,
        req
      );
      res.json({
        success: true,
        data: { version },
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
  "/versions/:versionId/publish",
  requirePermission("document_management.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }
      const validated = publishVersionSchema.parse(req.body ?? {});
      const version = await legalDocumentService.publishVersion(
        req.params.versionId,
        validated,
        req.user.user_id,
        req
      );
      res.json({
        success: true,
        data: { version },
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
  "/versions/:versionId/archive",
  requirePermission("document_management.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }
      const version = await legalDocumentService.archiveVersion(
        req.params.versionId,
        req.user.user_id,
        req
      );
      res.json({
        success: true,
        data: { version },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/versions/:versionId/restore",
  requirePermission("document_management.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }
      const version = await legalDocumentService.restoreVersion(
        req.params.versionId,
        req.user.user_id,
        req
      );
      res.json({
        success: true,
        data: { version },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/versions/:versionId/download",
  requirePermission("document_management.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await legalDocumentService.getAdminDownloadUrl(req.params.versionId);
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

router.patch(
  "/:id",
  requirePermission("document_management.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }
      const validated = updateLegalDocumentSchema.parse(req.body);
      const document = await legalDocumentService.updateDefinition(
        req.params.id,
        validated,
        req.user.user_id,
        req
      );
      res.json({
        success: true,
        data: { document },
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
  "/:id/versions/upload-url",
  requirePermission("document_management.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }
      const validated = requestVersionUploadUrlSchema.parse(req.body);
      const result = await legalDocumentService.requestVersionUploadUrl(
        req.params.id,
        validated,
        req.user.user_id
      );
      res.json({
        success: true,
        data: result,
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
  "/:id/versions",
  requirePermission("document_management.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }
      const validated = createVersionSchema.parse(req.body);
      const version = await legalDocumentService.createDraftVersion(
        req.params.id,
        validated,
        req.user.user_id,
        req
      );
      res.status(201).json({
        success: true,
        data: { version },
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

export const legalDocumentAdminRouter = router;
