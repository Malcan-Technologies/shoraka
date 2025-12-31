import { Router, Request, Response, NextFunction } from "express";
import { requireRole } from "../../lib/auth/middleware";
import { UserRole } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { siteDocumentService } from "./service";
import {
  requestUploadUrlSchema,
  createDocumentSchema,
  updateDocumentSchema,
  requestReplaceUploadUrlSchema,
  confirmReplaceSchema,
  listDocumentsQuerySchema,
} from "./schemas";

const router = Router();

/**
 * GET /v1/admin/site-documents
 * List all site documents (includes inactive)
 */
router.get(
  "/",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = listDocumentsQuerySchema.parse(req.query);
      const result = await siteDocumentService.listDocuments(validated);

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

/**
 * GET /v1/admin/site-documents/:id
 * Get document by ID
 */
router.get(
  "/:id",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const document = await siteDocumentService.getDocumentById(id);

      res.json({
        success: true,
        data: { document },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /v1/admin/site-documents/upload-url
 * Request presigned URL for uploading new document
 */
router.post(
  "/upload-url",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = requestUploadUrlSchema.parse(req.body);

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const result = await siteDocumentService.requestUploadUrl(
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

/**
 * POST /v1/admin/site-documents
 * Create document record after upload
 */
router.post(
  "/",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = createDocumentSchema.parse(req.body);

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const document = await siteDocumentService.createDocument(
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

/**
 * PATCH /v1/admin/site-documents/:id
 * Update document metadata
 */
router.patch(
  "/:id",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const validated = updateDocumentSchema.parse(req.body);

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const document = await siteDocumentService.updateDocument(
        id,
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

/**
 * POST /v1/admin/site-documents/:id/replace-url
 * Request presigned URL for replacing document file
 */
router.post(
  "/:id/replace-url",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const validated = requestReplaceUploadUrlSchema.parse(req.body);

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const result = await siteDocumentService.requestReplaceUrl(
        id,
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

/**
 * POST /v1/admin/site-documents/:id/replace
 * Confirm document file replacement
 */
router.post(
  "/:id/replace",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const validated = confirmReplaceSchema.parse(req.body);

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const document = await siteDocumentService.confirmReplace(
        id,
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

/**
 * DELETE /v1/admin/site-documents/:id
 * Soft delete document
 */
router.delete(
  "/:id",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      await siteDocumentService.deleteDocument(id, req.user.user_id, req);

      res.json({
        success: true,
        data: { message: "Document deleted successfully" },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /v1/admin/site-documents/:id/restore
 * Restore soft-deleted document
 */
router.post(
  "/:id/restore",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const document = await siteDocumentService.restoreDocument(
        id,
        req.user.user_id,
        req
      );

      res.json({
        success: true,
        data: { document },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /v1/admin/site-documents/:id/download
 * Get presigned download URL for document (admin can download any document including inactive)
 */
router.get(
  "/:id/download",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await siteDocumentService.getAdminDownloadUrl(id);

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

export const siteDocumentAdminRouter = router;

