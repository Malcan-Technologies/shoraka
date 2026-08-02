import { Router, Request, Response, NextFunction } from "express";
import { legalDocumentAcceptanceService } from "./acceptance-service";

const router = Router();

/**
 * GET /v1/public/legal-documents
 * Currently published onboarding/public legal PDFs for footer links.
 */
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const documents = await legalDocumentAcceptanceService.listPublicPublishedDocuments();
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
 * GET /v1/public/legal-documents/:id/download
 * Presigned download for a published legal document (no auth).
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

export const legalDocumentPublicRouter = router;
