import { Router, Request, Response, NextFunction } from "express";
import { requirePermission } from "../../lib/auth/middleware";
import { listLegalExternalAcceptancesQuerySchema } from "./external-acceptance-admin-schemas";
import { legalExternalAcceptanceAdminService } from "./external-acceptance-admin-service";

const router = Router();

router.get(
  "/",
  requirePermission("document_management.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listLegalExternalAcceptancesQuerySchema.parse(req.query);
      const result = await legalExternalAcceptanceAdminService.listAcceptances(query);
      res.json({ success: true, data: result, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/:id",
  requirePermission("document_management.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const acceptance = await legalExternalAcceptanceAdminService.getAcceptanceById(req.params.id);
      res.json({
        success: true,
        data: { acceptance },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

export const legalExternalAcceptanceAdminRouter = router;
