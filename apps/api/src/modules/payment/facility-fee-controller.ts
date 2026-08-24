import { Request, Response, NextFunction, Router } from "express";
import { AppError } from "../../lib/http/error-handler";
import {
  facilityFeePaymentIdParamsSchema,
  facilityFeePaymentParamsSchema,
} from "./facility-fee-schemas";
import { createFacilityFeePayment, getFacilityFeePayment } from "./facility-fee-payment-service";

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

export const facilityFeePaymentRouter = Router({ mergeParams: true });

facilityFeePaymentRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contractId } = facilityFeePaymentParamsSchema.parse(req.params);
    send(res, await createFacilityFeePayment(getActor(req, res), contractId), 201);
  } catch (error) {
    next(error);
  }
});

facilityFeePaymentRouter.get(
  "/:paymentId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contractId, paymentId } = facilityFeePaymentIdParamsSchema.parse(req.params);
      send(res, await getFacilityFeePayment(getActor(req, res), contractId, paymentId));
    } catch (error) {
      next(error);
    }
  }
);
