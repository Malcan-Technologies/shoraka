import { Router, type NextFunction, type Request, type Response } from "express";
import { requireAuth } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import {
  completeBodySchema,
  failBodySchema,
  sessionBodySchema,
  statusQuerySchema,
} from "./schemas";
import { ekycService } from "./service";

const router = Router();

function getUserId(req: Request): string {
  if (!req.user?.user_id) {
    throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
  }

  return req.user.user_id;
}

router.get("/me", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ekycService.getMeStatus(getUserId(req));
    res.json({
      success: true,
      data,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/session", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { docType, force } = sessionBodySchema.parse(req.body);
    const data = await ekycService.createSession(getUserId(req), docType, { force });
    res.json({
      success: true,
      data,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return next(new AppError(400, "VALIDATION_ERROR", error.message));
    }
    next(error);
  }
});

router.get("/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = statusQuerySchema.parse(req.query);
    const data = await ekycService.getSessionStatus(token);
    res.json({
      success: true,
      data,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return next(new AppError(400, "VALIDATION_ERROR", error.message));
    }
    next(error);
  }
});

router.post("/fail", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, reason, code } = failBodySchema.parse(req.body);
    const data = await ekycService.failSession(token, reason, code);
    res.json({
      success: true,
      data,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return next(new AppError(400, "VALIDATION_ERROR", error.message));
    }
    next(error);
  }
});

router.post("/complete", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, result } = completeBodySchema.parse(req.body);
    const data = await ekycService.completeSession(token, result);
    res.json({
      success: true,
      data,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return next(new AppError(400, "VALIDATION_ERROR", error.message));
    }
    next(error);
  }
});

export const ekycRouter = router;
