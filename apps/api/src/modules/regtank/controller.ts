import { Router, Request, Response, NextFunction } from "express";
import { RegTankService } from "./service";
import { AppError } from "../../lib/http/error-handler";
import { requireAuth } from "../../lib/auth/middleware";
import {
  startOnboardingSchema,
  organizationIdParamSchema,
  type StartOnboardingInput,
} from "./schemas";

const router = Router();
const regTankService = new RegTankService();

/**
 * @swagger
 * /v1/regtank/start-onboarding:
 *   post:
 *     summary: Start RegTank onboarding for an organization
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
  "/start-onboarding",
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

export { router as regTankRouter };

