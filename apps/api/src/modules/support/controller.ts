import { NextFunction, Request, Response, Router } from "express";
import { getPlainConfig, isPlainChatConfigured } from "../../config/plain";
import { requireAuth } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { buildSupportChatIdentity } from "./service";

const router = Router();

/**
 * @swagger
 * /v1/support/chat-identity:
 *   get:
 *     summary: Get the signed-in user's Plain chat identity
 *     tags: [Support]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Plain chat identity
 *       503:
 *         description: Support chat is not configured
 */
router.get(
  "/chat-identity",
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isPlainChatConfigured()) {
        throw new AppError(
          503,
          "PLAIN_CHAT_NOT_CONFIGURED",
          "Support chat is not configured."
        );
      }

      const chatSecret = getPlainConfig().chatSecret!;
      const data = buildSupportChatIdentity(req.user!, chatSecret);

      res.json({
        success: true,
        data,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

export const supportRouter = router;
