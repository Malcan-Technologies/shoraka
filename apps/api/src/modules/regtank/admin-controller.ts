import { Router, Request, Response, NextFunction } from "express";
import { requireAuth, requireRole } from "../../lib/auth/middleware";
import { RegTankService } from "./service";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";

const router = Router();
const regTankService = new RegTankService();

/**
 * GET /v1/regtank/admin/onboarding-settings/:formId
 * Get current onboarding settings for a formId
 * Requires ADMIN role
 * 
 * Note: To configure webhook preferences and onboarding settings, call RegTank API directly:
 * - POST {{companySpecificRegtankServerURL}}/alert/preferences (for webhook)
 * - POST {{companySpecificRegtankServerURL}}/v3/onboarding/indv/setting (for onboarding settings)
 */
router.get(
  "/admin/onboarding-settings/:formId",
  requireAuth,
  requireRole("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const formId = parseInt(req.params.formId, 10);

      if (isNaN(formId) || formId <= 0) {
        throw new AppError(
          400,
          "INVALID_FORM_ID",
          "formId must be a positive integer"
        );
      }

      logger.info(
        {
          formId,
          userId: req.user!.user_id,
        },
        "Admin fetching RegTank onboarding settings"
      );

      const settings = await regTankService.getOnboardingSettings(formId);

      res.json({
        success: true,
        data: settings,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as regTankAdminRouter };

