import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/http/error-handler";
import { siteDocumentService } from "./service";
import type { SiteDocumentType } from "./schemas";

const router = Router();

// Enum values for validation
const siteDocumentTypes: SiteDocumentType[] = ["TERMS_AND_CONDITIONS", "PRIVACY_POLICY", "RISK_DISCLOSURE", "PLATFORM_AGREEMENT", "INVESTOR_GUIDE", "ISSUER_GUIDE", "OTHER"];

/**
 * GET /v1/documents
 * List all active site documents
 */
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const documents = await siteDocumentService.listActiveDocuments();

    res.json({
      success: true,
      data: { documents },
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/documents/account
 * List documents for account page (show_in_account = true)
 */
router.get("/account", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const documents = await siteDocumentService.listAccountDocuments();

    res.json({
      success: true,
      data: { documents },
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/documents/type/:type
 * Get active document by type
 */
router.get(
  "/type/:type",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.params;

      if (!siteDocumentTypes.includes(type as SiteDocumentType)) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          `Invalid document type. Valid types: ${siteDocumentTypes.join(", ")}`
        );
      }

      const document = await siteDocumentService.getActiveDocumentByType(
        type as SiteDocumentType
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
 * GET /v1/documents/:id/download
 * Get presigned download URL for document
 */
router.get(
  "/:id/download",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await siteDocumentService.getDownloadUrl(id);

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

export const siteDocumentUserRouter = router;

