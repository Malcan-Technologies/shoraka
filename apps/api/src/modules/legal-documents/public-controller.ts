import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/http/error-handler";
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

router.get(
  "/versions/:versionId/view",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await legalDocumentAcceptanceService.getPublicViewUrl(req.params.versionId);
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

router.get("/:slug/download", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const document = await legalDocumentAcceptanceService.getPublicDocumentBySlug(req.params.slug);
    const result = await legalDocumentAcceptanceService.getPublicDownloadUrl(
      document.legalDocumentVersionId
    );
    res.json({
      success: true,
      data: {
        ...result,
        document,
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

router.get("/:slug/view", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const document = await legalDocumentAcceptanceService.getPublicDocumentBySlug(req.params.slug);
    const result = await legalDocumentAcceptanceService.getPublicViewUrl(
      document.legalDocumentVersionId
    );
    res.json({
      success: true,
      data: {
        ...result,
        document,
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

router.get("/:slug", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const document = await legalDocumentAcceptanceService.getPublicDocumentBySlug(req.params.slug);
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
});

export const legalDocumentPublicRouter = router;
