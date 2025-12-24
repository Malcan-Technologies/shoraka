import { Router, Request, Response, NextFunction } from "express";
import { RegTankService } from "./service";
import { AppError } from "../../lib/http/error-handler";
import { requireAuth } from "../../lib/auth/middleware";
import {
  startOnboardingSchema,
  organizationIdParamSchema,
  setOnboardingSettingsSchema,
  type StartOnboardingInput,
  type SetOnboardingSettingsInput,
} from "./schemas";

const router = Router();
const regTankService = new RegTankService();

/**
 * @swagger
 * /v1/regtank/start-individual-onboarding:
 *   post:
 *     summary: Start RegTank individual onboarding for an organization
 *     tags: [RegTank]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [organizationId, portalType]
 *             properties:
 *               organizationId:
 *                 type: string
 *                 description: Organization ID to start onboarding for
 *               portalType:
 *                 type: string
 *                 enum: [investor, issuer]
 *                 description: Portal type (investor or issuer)
 *     responses:
 *       200:
 *         description: Onboarding started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     verifyLink:
 *                       type: string
 *                       description: URL to redirect user to RegTank portal
 *                     requestId:
 *                       type: string
 *                       description: RegTank request ID
 *                     expiresIn:
 *                       type: number
 *                       description: Link expiration time in seconds
 *       400:
 *         description: Bad request (missing fields, already completed, etc.)
 *       403:
 *         description: Forbidden (not organization owner)
 *       404:
 *         description: Organization not found
 */
router.post(
  "/start-individual-onboarding",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.user_id;
      const body = startOnboardingSchema.parse(req.body) as StartOnboardingInput;

      const result = await regTankService.startPersonalOnboarding(
        req,
        userId,
        body.organizationId,
        body.portalType
      );

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      // Log the full error for debugging
      const logger = require("../../lib/logger").logger;
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          body: req.body,
          userId: req.user?.user_id,
        },
        "Error in /v1/regtank/start-individual-onboarding"
      );
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/regtank/start-corporate-onboarding:
 *   post:
 *     summary: Start RegTank corporate onboarding for an organization
 *     tags: [RegTank]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [organizationId, portalType]
 *             properties:
 *               organizationId:
 *                 type: string
 *                 description: Organization ID to start onboarding for (must be COMPANY type)
 *               portalType:
 *                 type: string
 *                 enum: [investor, issuer]
 *                 description: Portal type (investor or issuer)
 *     responses:
 *       200:
 *         description: Corporate onboarding started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     verifyLink:
 *                       type: string
 *                       description: URL to redirect user to RegTank portal
 *                     requestId:
 *                       type: string
 *                       description: RegTank request ID
 *                     expiresIn:
 *                       type: number
 *                       description: Link expiration time in seconds
 *                     organizationType:
 *                       type: string
 *                       example: COMPANY
 *       400:
 *         description: Bad request (missing fields, already completed, invalid organization type, etc.)
 *       403:
 *         description: Forbidden (not organization owner)
 *       404:
 *         description: Organization not found
 */
router.post(
  "/start-corporate-onboarding",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.user_id;
      const body = startOnboardingSchema.parse(req.body) as StartOnboardingInput;

      const result = await regTankService.startCorporateOnboarding(
        req,
        userId,
        body.organizationId,
        body.portalType
      );

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      // Log the full error for debugging
      const logger = require("../../lib/logger").logger;
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          body: req.body,
          userId: req.user?.user_id,
        },
        "Error in /v1/regtank/start-corporate-onboarding"
      );
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/regtank/start-onboarding:
 *   post:
 *     summary: Start RegTank onboarding for an organization (legacy endpoint)
 *     tags: [RegTank]
 *     deprecated: true
 *     description: This endpoint is deprecated. Use /start-individual-onboarding for individual onboarding or /start-corporate-onboarding for corporate onboarding.
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/start-onboarding",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.user_id;
      const body = startOnboardingSchema.parse(req.body) as StartOnboardingInput;

      // Legacy endpoint routes to individual onboarding for backward compatibility
      const result = await regTankService.startPersonalOnboarding(
        req,
        userId,
        body.organizationId,
        body.portalType
      );

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      const logger = require("../../lib/logger").logger;
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          body: req.body,
          userId: req.user?.user_id,
        },
        "Error in /v1/regtank/start-onboarding (legacy)"
      );
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/regtank/set-onboarding-settings:
 *   post:
 *     summary: Set onboarding settings for RegTank
 *     tags: [RegTank]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [formId, livenessConfidence, approveMode]
 *             properties:
 *               formId:
 *                 type: number
 *                 description: Form ID for the onboarding settings
 *                 example: 1036131
 *               livenessConfidence:
 *                 type: number
 *                 description: Liveness confidence threshold (0-100)
 *                 example: 90
 *               approveMode:
 *                 type: boolean
 *                 description: Enable/disable manual approve/reject button
 *                 example: true
 *               kycApprovalTarget:
 *                 type: string
 *                 enum: [ACURIS, DOWJONES]
 *                 description: KYC approval target provider
 *                 example: ACURIS
 *               enabledRegistrationEmail:
 *                 type: boolean
 *                 description: Send email on status changes
 *                 example: false
 *               redirectUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL to redirect after completion
 *                 example: https://investor.cashsouk.com/regtank-callback
 *     responses:
 *       200:
 *         description: Onboarding settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *       400:
 *         description: Bad request (validation error)
 *       500:
 *         description: Failed to update settings
 */
router.post(
  "/set-onboarding-settings",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
	try {
      const body = setOnboardingSettingsSchema.parse(req.body) as SetOnboardingSettingsInput;

      await regTankService.setOnboardingSettings({
        formId: body.formId,
        livenessConfidence: body.livenessConfidence,
        approveMode: body.approveMode,
        kycApprovalTarget: body.kycApprovalTarget,
        enabledRegistrationEmail: body.enabledRegistrationEmail,
        redirectUrl: body.redirectUrl,
      });

      res.json({
        success: true,
        data: {
          message: "Onboarding settings updated successfully",
        },
        correlationId: res.locals.correlationId,
      });
	} catch (error) {
      const logger = require("../../lib/logger").logger;
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          body: req.body,
          userId: req.user?.user_id,
        },
        "Error in /v1/regtank/set-onboarding-settings"
      );
		next(error);
	}
  }
);


/**
 * @swagger
 * /v1/regtank/status/{organizationId}:
 *   get:
 *     summary: Get onboarding status for an organization
 *     tags: [RegTank]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *       - in: query
 *         name: portalType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [investor, issuer]
 *         description: Portal type
 *     responses:
 *       200:
 *         description: Onboarding status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     substatus:
 *                       type: string
 *                     requestId:
 *                       type: string
 *                     verifyLink:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       403:
 *         description: Forbidden (no access to organization)
 *       404:
 *         description: Organization not found
 */
router.get(
  "/status/:organizationId",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.user_id;
      const { organizationId } = organizationIdParamSchema.parse(req.params);
      const portalType = req.query.portalType as "investor" | "issuer";

      if (!portalType || !["investor", "issuer"].includes(portalType)) {
        throw new AppError(
          400,
          "INVALID_PORTAL_TYPE",
          "portalType query parameter is required and must be 'investor' or 'issuer'"
        );
      }

      const status = await regTankService.getOnboardingStatus(
        userId,
        organizationId,
        portalType
      );

      res.json({
        success: true,
        data: status,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/regtank/retry/{organizationId}:
 *   post:
 *     summary: Retry failed or expired onboarding
 *     tags: [RegTank]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *       - in: query
 *         name: portalType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [investor, issuer]
 *         description: Portal type
 *     responses:
 *       200:
 *         description: Onboarding restarted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     verifyLink:
 *                       type: string
 *                     requestId:
 *                       type: string
 *                     expiresIn:
 *                       type: number
 *       403:
 *         description: Forbidden (not organization owner)
 *       404:
 *         description: Onboarding not found
 */
router.post(
  "/retry/:organizationId",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.user_id;
      const { organizationId } = organizationIdParamSchema.parse(req.params);
      const portalType = req.query.portalType as "investor" | "issuer";

      if (!portalType || !["investor", "issuer"].includes(portalType)) {
        throw new AppError(
          400,
          "INVALID_PORTAL_TYPE",
          "portalType query parameter is required and must be 'investor' or 'issuer'"
        );
      }

      const result = await regTankService.retryOnboarding(
        req,
        userId,
        organizationId,
        portalType
      );

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/regtank/sync-status/{organizationId}:
 *   post:
 *     summary: Manually sync onboarding status from RegTank API
 *     tags: [RegTank]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *       - in: query
 *         name: portalType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [investor, issuer]
 *         description: Portal type
 *     responses:
 *       200:
 *         description: Status synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     substatus:
 *                       type: string
 *                     requestId:
 *                       type: string
 *                     synced:
 *                       type: boolean
 *       403:
 *         description: Forbidden (no access to organization)
 *       404:
 *         description: Organization or onboarding not found
 */
router.post(
  "/sync-status/:organizationId",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.user_id;
      const { organizationId } = organizationIdParamSchema.parse(req.params);
      const portalType = req.query.portalType as "investor" | "issuer";

      if (!portalType || !["investor", "issuer"].includes(portalType)) {
        throw new AppError(
          400,
          "INVALID_PORTAL_TYPE",
          "portalType query parameter is required and must be 'investor' or 'issuer'"
        );
      }

      const result = await regTankService.syncOnboardingStatus(
        userId,
        organizationId,
        portalType
      );

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as regTankRouter };

