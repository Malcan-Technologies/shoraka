import { Router, type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import { AppError, formatZodMessage } from "../../lib/http/error-handler";
import { completeBodySchema, failBodySchema, statusQuerySchema } from "./schemas";
import { signingService } from "../signing/service";

const router = Router();

router.get("/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = statusQuerySchema.parse(req.query);
    const data = await signingService.getRecipientEkycStatus(token);
    res.json({
      success: true,
      data,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return next(new AppError(400, "VALIDATION_ERROR", formatZodMessage(error)));
    }
    next(error);
  }
});

router.post("/fail", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, reason } = failBodySchema.parse(req.body);
    const data = await signingService.failRecipientEkyc(token, reason);
    res.json({
      success: true,
      data,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return next(new AppError(400, "VALIDATION_ERROR", formatZodMessage(error)));
    }
    next(error);
  }
});

router.post("/complete", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, result } = completeBodySchema.parse(req.body);
    const data = await signingService.completeRecipientEkyc(token, result);
    res.json({
      success: true,
      data,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return next(new AppError(400, "VALIDATION_ERROR", formatZodMessage(error)));
    }
    next(error);
  }
});

export const ekycRouter = router;
