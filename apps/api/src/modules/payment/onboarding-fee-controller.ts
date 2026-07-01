import { Request, Response, NextFunction, Router } from "express";
import { UserRole } from "@prisma/client";
import { requireRole } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import {
  createIssuerOnboardingFeeSchema,
  issuerOnboardingFeeIdParamSchema,
} from "./onboarding-fee-schemas";
import { createIssuerOnboardingFee, getIssuerOnboardingFee } from "./onboarding-fee-service";

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

export const issuerOnboardingFeeRouter = Router();

issuerOnboardingFeeRouter.use(requireRole(UserRole.ISSUER));

issuerOnboardingFeeRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createIssuerOnboardingFeeSchema.parse(req.body);
    send(res, await createIssuerOnboardingFee(getActor(req, res), input), 201);
  } catch (error) {
    next(error);
  }
});

issuerOnboardingFeeRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = issuerOnboardingFeeIdParamSchema.parse(req.params);
    send(res, await getIssuerOnboardingFee(getActor(req, res), id));
  } catch (error) {
    next(error);
  }
});
