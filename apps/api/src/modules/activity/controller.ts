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

      // Ensure array parameters are actually arrays
      const queryData = {
        ...req.query,
        categories: req.query.categories
          ? Array.isArray(req.query.categories)
            ? req.query.categories
            : typeof req.query.categories === "string"
              ? req.query.categories.split(",")
              : [req.query.categories]
          : undefined,
        eventTypes: req.query.eventTypes
          ? Array.isArray(req.query.eventTypes)
            ? req.query.eventTypes
            : typeof req.query.eventTypes === "string"
              ? req.query.eventTypes.split(",")
              : [req.query.eventTypes]
          : undefined,
      };

      const query = getActivitiesQuerySchema.parse(queryData);
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
