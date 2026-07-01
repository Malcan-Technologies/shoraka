import { NextFunction, Request, Response, Router } from "express";
import { UserRole } from "@prisma/client";
import { requirePermission, requireRole } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import {
  listReconExceptionsQuerySchema,
  listReconRunsQuerySchema,
  reconExceptionIdParamSchema,
  reconRunIdParamSchema,
  resolveReconExceptionSchema,
  triggerReconRunSchema,
} from "./recon-schemas";
import {
  getReconRunDetail,
  getUnresolvedReconExceptionsCount,
  listReconExceptions,
  listReconRuns,
  resolveReconException,
  triggerReconRun,
} from "./recon-service";

function getActor(req: Request, res: Response) {
  if (!req.user?.user_id) {
    throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
  }

  return { userId: req.user.user_id, correlationId: res.locals.correlationId };
}

function send(res: Response, data: unknown, status = 200) {
  res.status(status).json({
    success: true,
    data,
    correlationId: res.locals.correlationId || "unknown",
  });
}

export const gatewayReconAdminRouter = Router();

gatewayReconAdminRouter.use(requireRole(UserRole.ADMIN));

gatewayReconAdminRouter.get(
  "/runs",
  requirePermission("gateway_payments.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listReconRunsQuerySchema.parse(req.query);
      send(res, await listReconRuns(query));
    } catch (error) {
      next(error);
    }
  }
);

gatewayReconAdminRouter.get(
  "/runs/:id",
  requirePermission("gateway_payments.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = reconRunIdParamSchema.parse(req.params);
      send(res, await getReconRunDetail(id));
    } catch (error) {
      next(error);
    }
  }
);

gatewayReconAdminRouter.get(
  "/exceptions",
  requirePermission("gateway_payments.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listReconExceptionsQuerySchema.parse(req.query);
      send(res, await listReconExceptions(query));
    } catch (error) {
      next(error);
    }
  }
);

gatewayReconAdminRouter.get(
  "/exceptions/pending-count",
  requirePermission("gateway_payments.view"),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      send(res, await getUnresolvedReconExceptionsCount());
    } catch (error) {
      next(error);
    }
  }
);

gatewayReconAdminRouter.post(
  "/run",
  requirePermission("gateway_payments.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = triggerReconRunSchema.parse(req.body ?? {});
      send(res, await triggerReconRun(getActor(req, res), body.runDate));
    } catch (error) {
      next(error);
    }
  }
);

gatewayReconAdminRouter.post(
  "/exceptions/:id/resolve",
  requirePermission("gateway_payments.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = reconExceptionIdParamSchema.parse(req.params);
      const { reason } = resolveReconExceptionSchema.parse(req.body);
      send(res, await resolveReconException(getActor(req, res), id, reason));
    } catch (error) {
      next(error);
    }
  }
);
