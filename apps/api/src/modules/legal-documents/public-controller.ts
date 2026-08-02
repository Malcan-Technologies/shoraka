import { Router, Request, Response, NextFunction } from "express";
import { legalDocumentAcceptanceService } from "./acceptance-service";

const router = Router();

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

router.get(
  "/versions/:versionId/download",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await legalDocumentAcceptanceService.getPublicDownloadUrl(
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

export const legalDocumentPublicRouter = router;
