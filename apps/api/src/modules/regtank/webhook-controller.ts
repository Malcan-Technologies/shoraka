import { Router, Request, Response, NextFunction } from "express";
import express from "express";
import { RegTankWebhookHandler } from "./webhook-handler";
import { RegTankDevWebhookHandler } from "./webhook-handler-dev";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";

const router = Router();
const webhookHandler = new RegTankWebhookHandler();
const devWebhookHandler = new RegTankDevWebhookHandler();

// Use express.raw() to capture raw body for signature verification
// This must be applied before express.json() processes the body
// Note: This router should be registered before express.json() middleware
// or we need to handle raw body capture differently

/**
 * @swagger
 * /v1/webhooks/regtank:
 *   post:
 *     summary: RegTank webhook endpoint (public, no auth)
 *     tags: [RegTank]
 *     description: Receives webhook notifications from RegTank for onboarding status updates
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requestId, status]
 *             properties:
 *               requestId:
 *                 type: string
 *               status:
 *                 type: string
 *               substatus:
 *                 type: string
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       401:
 *         description: Invalid signature
 *       400:
 *         description: Invalid payload
 */
router.post(
  "/regtank",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      // Get raw body (Buffer from express.raw())
      const rawBody = req.body instanceof Buffer 
        ? req.body.toString("utf8")
        : typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body);
      
      const signature = req.headers["x-regtank-signature"] as string | undefined;

      logger.debug(
        {
          hasSignature: !!signature,
          contentType: req.headers["content-type"],
          bodyLength: rawBody.length,
        },
        "RegTank webhook received"
      );

      await webhookHandler.processWebhook(rawBody, signature);

      // Return 200 OK immediately (webhook processing is async)
      res.status(200).json({
        success: true,
        message: "Webhook received and processed",
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Error processing RegTank webhook"
      );

      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.code,
          message: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "INTERNAL_ERROR",
          message: "Internal server error processing webhook",
        });
      }
    }
  }
);

/**
 * @swagger
 * /v1/webhooks/regtank/dev:
 *   post:
 *     summary: RegTank dev webhook endpoint (public, no auth)
 *     tags: [RegTank]
 *     description: Receives webhook notifications from RegTank for onboarding status updates and writes to DEV database. Use this for testing webhooks in production.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requestId, status]
 *             properties:
 *               requestId:
 *                 type: string
 *               status:
 *                 type: string
 *               substatus:
 *                 type: string
 *     responses:
 *       200:
 *         description: Webhook processed successfully (written to dev database)
 *       401:
 *         description: Invalid signature
 *       400:
 *         description: Invalid payload
 */
router.post(
  "/regtank/dev",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      // Get raw body (Buffer from express.raw())
      const rawBody = req.body instanceof Buffer 
        ? req.body.toString("utf8")
        : typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body);
      
      const signature = req.headers["x-regtank-signature"] as string | undefined;

      logger.debug(
        {
          hasSignature: !!signature,
          contentType: req.headers["content-type"],
          bodyLength: rawBody.length,
          database: "dev",
        },
        "RegTank dev webhook received"
      );

      await devWebhookHandler.processWebhook(rawBody, signature);

      // Return 200 OK immediately (webhook processing is async)
      res.status(200).json({
        success: true,
        message: "Webhook received and processed (dev database)",
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          database: "dev",
        },
        "Error processing RegTank dev webhook"
      );

      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.code,
          message: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "INTERNAL_ERROR",
          message: "Internal server error processing webhook",
        });
      }
    }
  }
);

export { router as regTankWebhookRouter };

