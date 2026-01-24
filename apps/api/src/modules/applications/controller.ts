import { Request, Response, NextFunction, Router } from "express";
import { applicationService } from "./service";
import {
  createApplicationSchema,
  updateApplicationStepSchema,
  applicationIdParamSchema,
} from "./schemas";
import { requireAuth } from "../../lib/auth/middleware";

/**
 * Create a new application
 * POST /v1/applications
 */
async function createApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createApplicationSchema.parse(req.body);
    const application = await applicationService.createApplication(input);

    res.status(201).json({
      success: true,
      data: application,
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get application by ID
 * GET /v1/applications/:id
 */
async function getApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = applicationIdParamSchema.parse(req.params);
    const data = await applicationService.getApplication(id);

    res.json({
      success: true,
      data,
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update an application step
 * PATCH /v1/applications/:id/step
 */
async function updateApplicationStep(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = applicationIdParamSchema.parse(req.params);
    const input = updateApplicationStepSchema.parse(req.body);
    const application = await applicationService.updateStep(id, input);

    res.json({
      success: true,
      data: application,
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create router for application routes
 */
export function createApplicationRouter(): Router {
  const router = Router();

  router.post("/", requireAuth, createApplication);
  router.get("/:id", requireAuth, getApplication);
  router.patch("/:id/step", requireAuth, updateApplicationStep);

  return router;
}
