import { NextFunction, Request, Response, Router } from "express";
import { UserRole } from "@prisma/client";
import { requireRole } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { issuerDashboardService } from "./service";

const router = Router();
router.use(requireRole(UserRole.ISSUER));

function send(res: Response, data: unknown, status = 200) {
  res.status(status).json({
    success: true,
    data,
    correlationId: res.locals.correlationId || "unknown",
  });
}

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = typeof req.query.organizationId === "string" ? req.query.organizationId.trim() : "";
    if (!organizationId) {
      throw new AppError(400, "BAD_REQUEST", "organizationId query parameter is required");
    }
    if (!req.user?.user_id) {
      throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
    }
    send(res, await issuerDashboardService.getDashboard(organizationId, req.user.user_id));
  } catch (error) {
    next(error);
  }
});

router.get("/contracts/:contractId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = typeof req.query.organizationId === "string" ? req.query.organizationId.trim() : "";
    if (!organizationId) {
      throw new AppError(400, "BAD_REQUEST", "organizationId query parameter is required");
    }
    const contractId = String(req.params.contractId ?? "").trim();
    if (!contractId) {
      throw new AppError(400, "BAD_REQUEST", "contractId is required");
    }
    if (!req.user?.user_id) {
      throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
    }
    send(res, await issuerDashboardService.getContractDetail(organizationId, req.user.user_id, contractId));
  } catch (error) {
    next(error);
  }
});

export const issuerDashboardRouter = router;
