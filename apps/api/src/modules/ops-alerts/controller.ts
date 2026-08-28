import { Router, Request, Response, NextFunction } from "express";
import { requirePermission } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { listOpsAlertsQuerySchema } from "./schemas";
import {
  acknowledgeOpsAlert,
  getOpsAlertById,
  listOpsAlerts,
  resolveOpsAlert,
} from "./service";

function actorUserId(req: Request): string {
  if (!req.user?.user_id) {
    throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
  }
  return req.user.user_id;
}

const router = Router();

router.get(
  "/",
  requirePermission("ops.alerts.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listOpsAlertsQuerySchema.parse(req.query);
      const result = await listOpsAlerts(query);
      res.json({ success: true, data: result, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/:id",
  requirePermission("ops.alerts.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alert = await getOpsAlertById(req.params.id);
      res.json({ success: true, data: { alert }, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:id/acknowledge",
  requirePermission("ops.alerts.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alert = await acknowledgeOpsAlert(req.params.id, actorUserId(req));
      res.json({ success: true, data: { alert }, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:id/resolve",
  requirePermission("ops.alerts.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alert = await resolveOpsAlert(req.params.id, actorUserId(req), false);
      res.json({ success: true, data: { alert }, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:id/close",
  requirePermission("ops.alerts.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alert = await resolveOpsAlert(req.params.id, actorUserId(req), true);
      res.json({ success: true, data: { alert }, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  }
);

export const opsAlertsAdminRouter = router;
