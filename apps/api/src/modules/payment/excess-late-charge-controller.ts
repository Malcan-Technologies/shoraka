import { Request, Response, NextFunction, Router } from "express";
import { AppError } from "../../lib/http/error-handler";
import {
  excessLateChargePaymentIdParamsSchema,
  excessLateChargePaymentParamsSchema,
} from "./excess-late-charge-schemas";
import {
  createExcessLateChargePayment,
  getExcessLateChargePayment,
} from "./excess-late-charge-payment-service";

function getActor(req: Request, res: Response) {
  if (!req.user?.user_id) {
    throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
  }

  return {
    userId: req.user.user_id,
    role: req.activeRole ?? req.user.roles[0],
    portal: "ISSUER",
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

export const excessLateChargePaymentRouter = Router({ mergeParams: true });

excessLateChargePaymentRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { noteId } = excessLateChargePaymentParamsSchema.parse(req.params);
    send(res, await createExcessLateChargePayment(getActor(req, res), noteId), 201);
  } catch (error) {
    next(error);
  }
});

excessLateChargePaymentRouter.get(
  "/:paymentId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { noteId, paymentId } = excessLateChargePaymentIdParamsSchema.parse(req.params);
      send(res, await getExcessLateChargePayment(getActor(req, res), noteId, paymentId));
    } catch (error) {
      next(error);
    }
  }
);
