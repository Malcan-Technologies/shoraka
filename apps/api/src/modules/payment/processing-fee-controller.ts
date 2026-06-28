import { Request, Response, NextFunction, Router } from "express";
import { AppError } from "../../lib/http/error-handler";
import {
  applicationProcessingFeeIdParamsSchema,
  applicationProcessingFeeParamsSchema,
} from "./processing-fee-schemas";
import {
  createApplicationProcessingFee,
  getApplicationProcessingFee,
} from "./processing-fee-service";

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

export const applicationProcessingFeeRouter = Router({ mergeParams: true });

applicationProcessingFeeRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { applicationId } = applicationProcessingFeeParamsSchema.parse(req.params);
    send(res, await createApplicationProcessingFee(getActor(req, res), applicationId), 201);
  } catch (error) {
    next(error);
  }
});

applicationProcessingFeeRouter.get(
  "/:feePaymentId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { applicationId, feePaymentId } = applicationProcessingFeeIdParamsSchema.parse(
        req.params
      );
      send(res, await getApplicationProcessingFee(getActor(req, res), applicationId, feePaymentId));
    } catch (error) {
      next(error);
    }
  }
);
