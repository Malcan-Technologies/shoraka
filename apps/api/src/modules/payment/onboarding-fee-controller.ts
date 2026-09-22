import { Request, Response, NextFunction, Router } from "express";
import { UserRole } from "@prisma/client";
import { requireRole } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import {
  createIssuerOnboardingFeeSchema,
  issuerOnboardingFeeIdParamSchema,
  issuerOnboardingFeeStatusParamSchema,
} from "./onboarding-fee-schemas";
import { gatewayPaymentReceiptModeQuerySchema } from "./deposit-schemas";
import {
  createIssuerOnboardingFee,
  getIssuerOnboardingFee,
  getIssuerOnboardingFeeStatus,
} from "./onboarding-fee-service";
import { getIssuerOnboardingFeeReceiptPdfUrl } from "./receipt/issuer-receipt-service";

function getActor(req: Request, res: Response) {
  if (!req.user?.user_id) {
    throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
  }

  return {
    userId: req.user.user_id,
    role: req.activeRole,
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

issuerOnboardingFeeRouter.get(
  "/status/:issuerOrganizationId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { issuerOrganizationId } = issuerOnboardingFeeStatusParamSchema.parse(req.params);
      send(res, await getIssuerOnboardingFeeStatus(getActor(req, res), issuerOrganizationId));
    } catch (error) {
      next(error);
    }
  }
);

issuerOnboardingFeeRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = issuerOnboardingFeeIdParamSchema.parse(req.params);
    send(res, await getIssuerOnboardingFee(getActor(req, res), id));
  } catch (error) {
    next(error);
  }
});

issuerOnboardingFeeRouter.get(
  "/:id/receipt/pdf",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = issuerOnboardingFeeIdParamSchema.parse(req.params);
      const { mode } = gatewayPaymentReceiptModeQuerySchema.parse(req.query);
      send(res, await getIssuerOnboardingFeeReceiptPdfUrl(getActor(req, res), id, mode));
    } catch (error) {
      next(error);
    }
  }
);
