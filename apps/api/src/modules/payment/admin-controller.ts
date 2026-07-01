import { NextFunction, Request, Response, Router } from "express";
import { UserRole } from "@prisma/client";
import { requirePermission, requireRole } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import {
  gatewayPaymentIdParamSchema,
  gatewayPaymentReasonSchema,
  listGatewayPaymentsQuerySchema,
} from "./admin-schemas";
import {
  approveNameCheck,
  getGatewayPaymentDetail,
  getGatewayPaymentsExceptionCount,
  initiateCompletedDepositRefund,
  listGatewayPayments,
  rejectNameCheck,
  retryHeldDepositRefund,
} from "./admin-service";

function getActor(req: Request, res: Response) {
  if (!req.user?.user_id) {
    throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
  }

  return {
    userId: req.user.user_id,
    correlationId: res.locals.correlationId,
  };
}

function send(res: Response, data: unknown, status = 200) {
  res.status(status).json({
    success: true,
    data,
    correlationId: res.locals.correlationId || "unknown",
  });
}

export const gatewayPaymentsAdminRouter = Router();

gatewayPaymentsAdminRouter.use(requireRole(UserRole.ADMIN));

gatewayPaymentsAdminRouter.get(
  "/",
  requirePermission("gateway_payments.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listGatewayPaymentsQuerySchema.parse(req.query);
      send(res, await listGatewayPayments(query));
    } catch (error) {
      next(error);
    }
  }
);

gatewayPaymentsAdminRouter.get(
  "/exceptions/pending-count",
  requirePermission("gateway_payments.view"),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      send(res, await getGatewayPaymentsExceptionCount());
    } catch (error) {
      next(error);
    }
  }
);

gatewayPaymentsAdminRouter.get(
  "/:id",
  requirePermission("gateway_payments.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = gatewayPaymentIdParamSchema.parse(req.params);
      send(res, await getGatewayPaymentDetail(id));
    } catch (error) {
      next(error);
    }
  }
);

gatewayPaymentsAdminRouter.post(
  "/:id/retry-refund",
  requirePermission("gateway_payments.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = gatewayPaymentIdParamSchema.parse(req.params);
      send(res, await retryHeldDepositRefund(getActor(req, res), id));
    } catch (error) {
      next(error);
    }
  }
);

gatewayPaymentsAdminRouter.post(
  "/:id/refund",
  requirePermission("gateway_payments.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = gatewayPaymentIdParamSchema.parse(req.params);
      const { reason } = gatewayPaymentReasonSchema.parse(req.body);
      send(res, await initiateCompletedDepositRefund(getActor(req, res), id, reason));
    } catch (error) {
      next(error);
    }
  }
);

gatewayPaymentsAdminRouter.post(
  "/:id/name-check/approve",
  requirePermission("gateway_payments.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = gatewayPaymentIdParamSchema.parse(req.params);
      send(res, await approveNameCheck(getActor(req, res), id));
    } catch (error) {
      next(error);
    }
  }
);

gatewayPaymentsAdminRouter.post(
  "/:id/name-check/reject",
  requirePermission("gateway_payments.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = gatewayPaymentIdParamSchema.parse(req.params);
      send(res, await rejectNameCheck(getActor(req, res), id));
    } catch (error) {
      next(error);
    }
  }
);
