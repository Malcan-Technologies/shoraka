import { Router, Request, Response, NextFunction } from "express";
import express from "express";
import { RegTankWebhookHandler } from "./webhook-handler";
import { RegTankDevWebhookHandler } from "./webhook-handler-dev";
import { IndividualOnboardingWebhookHandler } from "./webhooks/individual-onboarding-handler";
import { CODWebhookHandler } from "./webhooks/cod-handler";
import { EODWebhookHandler } from "./webhooks/eod-handler";
import { KYCWebhookHandler } from "./webhooks/kyc-handler";
import { KYBWebhookHandler } from "./webhooks/kyb-handler";
import { KYTWebhookHandler } from "./webhooks/kyt-handler";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";

const router = Router();
const webhookHandler = new RegTankWebhookHandler();
const devWebhookHandler = new RegTankDevWebhookHandler();

// Specialized webhook handlers
const individualHandler = new IndividualOnboardingWebhookHandler();
const codHandler = new CODWebhookHandler();
const eodHandler = new EODWebhookHandler();
const kycHandler = new KYCWebhookHandler("ACURIS");
const djkycHandler = new KYCWebhookHandler("DOWJONES");
const kybHandler = new KYBWebhookHandler("ACURIS");
const djkybHandler = new KYBWebhookHandler("DOWJONES");
const kytHandler = new KYTWebhookHandler();

/**
 * Helper function to extract raw body and signature from request
 */
function extractWebhookData(req: Request): { rawBody: string; signature: string | undefined } {
  const rawBody = req.body instanceof Buffer 
    ? req.body.toString("utf8")
    : typeof req.body === "string"
    ? req.body
    : JSON.stringify(req.body);
  
  const signature = req.headers["x-regtank-signature"] as string | undefined;
  
  return { rawBody, signature };
}

/**
 * Helper function to handle webhook processing with error handling
 */
async function handleWebhookRoute(
  req: Request,
  res: Response,
  handler: { processWebhook: (rawBody: string, signature?: string) => Promise<void> },
  webhookType: string
): Promise<void> {
  try {
    const { rawBody, signature } = extractWebhookData(req);

    logger.debug(
      {
        hasSignature: !!signature,
        contentType: req.headers["content-type"],
        bodyLength: rawBody.length,
        webhookType,
      },
      `RegTank ${webhookType} webhook received`
    );

    await handler.processWebhook(rawBody, signature);

    res.status(200).json({
      success: true,
      message: `${webhookType} webhook received and processed`,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        webhookType,
      },
      `Error processing RegTank ${webhookType} webhook`
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

// Use express.raw() to capture raw body for signature verification
// This must be applied before express.json() processes the body
// Note: This router should be registered before express.json() middleware
// or we need to handle raw body capture differently

/**
 * Individual Onboarding Webhook: /v1/webhooks/regtank/liveness
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.6-individual-onboarding-notification-definition
 */
router.post(
  "/regtank/liveness",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response, _next: NextFunction) => {
    await handleWebhookRoute(req, res, individualHandler, "Individual Onboarding");
  }
);

/**
 * COD (Company Onboarding Data) Webhook: /v1/webhooks/regtank/codliveness
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.7-business-onboarding-notification-definition-cod
 */
router.post(
  "/regtank/codliveness",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response, _next: NextFunction) => {
    await handleWebhookRoute(req, res, codHandler, "COD");
  }
);

/**
 * EOD (Entity Onboarding Data) Webhook: /v1/webhooks/regtank/eodliveness
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.8-business-onboarding-notification-definition-eod
 */
router.post(
  "/regtank/eodliveness",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response, _next: NextFunction) => {
    await handleWebhookRoute(req, res, eodHandler, "EOD");
  }
);

/**
 * KYC (Acuris) Webhook: /v1/webhooks/regtank/kyc
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.1-kyc-notification-definition
 */
router.post(
  "/regtank/kyc",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response, _next: NextFunction) => {
    await handleWebhookRoute(req, res, kycHandler, "KYC (Acuris)");
  }
);

/**
 * DJKYC (Dow Jones KYC) Webhook: /v1/webhooks/regtank/djkyc
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.2-djkyc-notification-definition
 */
router.post(
  "/regtank/djkyc",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response, _next: NextFunction) => {
    await handleWebhookRoute(req, res, djkycHandler, "DJKYC");
  }
);

/**
 * KYB (Acuris) Webhook: /v1/webhooks/regtank/kyb
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.3-kyb-notification-definition
 */
router.post(
  "/regtank/kyb",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response, _next: NextFunction) => {
    await handleWebhookRoute(req, res, kybHandler, "KYB (Acuris)");
  }
);

/**
 * DJKYB (Dow Jones KYB) Webhook: /v1/webhooks/regtank/djkyb
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.4-djkyb-notification-definition
 */
router.post(
  "/regtank/djkyb",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response, _next: NextFunction) => {
    await handleWebhookRoute(req, res, djkybHandler, "DJKYB");
  }
);

/**
 * KYT (Know Your Transaction) Webhook: /v1/webhooks/regtank/kyt
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.5-kyt-notification-definition
 */
router.post(
  "/regtank/kyt",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response, _next: NextFunction) => {
    await handleWebhookRoute(req, res, kytHandler, "KYT");
  }
);

/**
 * Legacy webhook endpoint: /v1/webhooks/regtank
 * Kept for backward compatibility - routes to Individual Onboarding handler
 * @deprecated Use /v1/webhooks/regtank/liveness instead
 */
router.post(
  "/regtank",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response, _next: NextFunction) => {
    await handleWebhookRoute(req, res, individualHandler, "Individual Onboarding (legacy)");
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

