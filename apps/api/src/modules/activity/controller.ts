import { Router, Request, Response, NextFunction } from "express";
import { activityService } from "./service";
import { getActivitiesQuerySchema } from "./schemas";
import { AppError } from "../../lib/http/error-handler";
import { requireAuth } from "../../lib/auth/middleware";

const router = Router();

/**
 * GET /v1/activities
 * List current user's activities
 */
router.get(
  "/",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const query = getActivitiesQuerySchema.parse(req.query);
      const result = await activityService.getActivities(userId, query);

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        return next(new AppError(400, "VALIDATION_ERROR", error.message));
      }
      next(error);
    }
  }
);

export const activityRouter = router;
