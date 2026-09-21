import { Request, Response, NextFunction, Router } from "express";
import { UserRole } from "@prisma/client";
import { requireRole } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import {
  createInvestorDepositSchema,
  investorDepositIdParamSchema,
  gatewayPaymentIdParamSchema,
  gatewayPaymentReceiptModeQuerySchema,
} from "./deposit-schemas";
import {
  createInvestorDeposit,
  getInvestorDeposit,
  getInvestorDepositLimits,
  getInvestorGatewayPaymentReceiptPdfUrl,
} from "./deposit-service";

function getActor(req: Request, res: Response) {
  if (!req.user?.user_id) {
    throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
  }

  return {
    userId: req.user.user_id,
    role: req.activeRole,
    portal: "INVESTOR",
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

export const investorDepositsRouter = Router();

investorDepositsRouter.use(requireRole(UserRole.INVESTOR));

investorDepositsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createInvestorDepositSchema.parse(req.body);
    send(res, await createInvestorDeposit(getActor(req, res), input), 201);
  } catch (error) {
    next(error);
  }
});

investorDepositsRouter.get("/limits", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    send(res, await getInvestorDepositLimits());
  } catch (error) {
    next(error);
  }
});

investorDepositsRouter.get(
  "/:gatewayPaymentId/receipt/pdf",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { gatewayPaymentId } = gatewayPaymentIdParamSchema.parse(req.params);
      const { mode } = gatewayPaymentReceiptModeQuerySchema.parse(req.query);
      send(res, await getInvestorGatewayPaymentReceiptPdfUrl(getActor(req, res), gatewayPaymentId, mode));
    } catch (error) {
      next(error);
    }
  }
);

investorDepositsRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = investorDepositIdParamSchema.parse(req.params);
    send(res, await getInvestorDeposit(getActor(req, res), id));
  } catch (error) {
    next(error);
  }
});
