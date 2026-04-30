import { Router, Request, Response, NextFunction } from "express";
import express from "express";
import { IndividualOnboardingWebhookHandler } from "./webhooks/individual-onboarding-handler";
import { CODWebhookHandler } from "./webhooks/cod-handler";
import { EODWebhookHandler } from "./webhooks/eod-handler";
import { KYCWebhookHandler } from "./webhooks/kyc-handler";
import { KYBWebhookHandler } from "./webhooks/kyb-handler";
import { KYTWebhookHandler } from "./webhooks/kyt-handler";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";

const router = Router();

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
  const rawBody =
    req.body instanceof Buffer
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
 * RegTank appends path suffixes to the configured webhookUrl (e.g. base + /liveness).
 * Dev mode sets base to .../regtank/dev, so deliveries hit .../regtank/dev/codliveness, etc.
 *
 * Suffixed /regtank/dev/* routes use the same handlers as production so behaviour matches
 * (e.g. COD APPROVED after RegTank admin approval). The legacy RegTankDevWebhookHandler on
 * POST /regtank/dev alone remains for split DATABASE_URL_DEV testing.
 * @see https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications
 */
const devSuffixRoutes: ReadonlyArray<{
  suffix: string;
  handler: { processWebhook: (rawBody: string, signature?: string) => Promise<void> };
  label: string;
}> = [
  { suffix: "/liveness", handler: individualHandler, label: "Individual Onboarding (dev URL)" },
  { suffix: "/codliveness", handler: codHandler, label: "COD (dev URL)" },
  { suffix: "/eodliveness", handler: eodHandler, label: "EOD (dev URL)" },
  { suffix: "/kyc", handler: kycHandler, label: "KYC (Acuris) (dev URL)" },
  { suffix: "/djkyc", handler: djkycHandler, label: "DJKYC (dev URL)" },
  { suffix: "/kyb", handler: kybHandler, label: "KYB (Acuris) (dev URL)" },
  { suffix: "/djkyb", handler: djkybHandler, label: "DJKYB (dev URL)" },
  { suffix: "/kyt", handler: kytHandler, label: "KYT (dev URL)" },
];

const regTankWebhookRawJson = express.raw({ type: "application/json" });

/**
 * RegTank appends these suffixes to the configured webhook base URL alone (e.g. `https://api.example.com`
 * → POST `/liveness`). Mount at app root so that layout still works; canonical paths remain under `/v1/webhooks/regtank/*`.
 */
const regTankRootWebhookAliasRouter = Router();
for (const { suffix, handler, label } of devSuffixRoutes) {
  regTankRootWebhookAliasRouter.post(suffix, regTankWebhookRawJson, async (req: Request, res: Response) => {
    await handleWebhookRoute(req, res, handler, `${label} (root alias)`);
  });
}

/**
 * Dev webhook endpoints — only in non-production or when ENABLE_REGTANK_DEV_WEBHOOK=true
 */
if (process.env.NODE_ENV !== "production" || process.env.ENABLE_REGTANK_DEV_WEBHOOK === "true") {
  /**
   * @swagger
   * /v1/webhooks/regtank/dev:
   *   post:
   *     summary: RegTank dev webhook fallback (split DB testing)
   *     tags: [RegTank]
   *     description: Optional. RegTank normally POSTs to /v1/webhooks/regtank/dev/&lt;suffix&gt;. This route uses RegTankDevWebhookHandler (DATABASE_URL_DEV).
   */
  async function handleRegTankDevWebhookRoute(req: Request, res: Response): Promise<void> {
    try {
      const { RegTankDevWebhookHandler } = await import("./webhook-handler-dev");
      const devWebhookHandler = new RegTankDevWebhookHandler();

      const rawBody =
        req.body instanceof Buffer
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
          path: req.path,
        },
        "RegTank dev webhook received"
      );

      await devWebhookHandler.processWebhook(rawBody, signature);

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
          path: req.path,
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

  router.post("/regtank/dev", regTankWebhookRawJson, handleRegTankDevWebhookRoute);

  for (const { suffix, handler, label } of devSuffixRoutes) {
    router.post(`/regtank/dev${suffix}`, regTankWebhookRawJson, async (req, res) => {
      await handleWebhookRoute(req, res, handler, label);
    });
  }

  logger.info(
    {
      legacyDevPath: "/v1/webhooks/regtank/dev",
      productionParityPaths: devSuffixRoutes.map((r) => `/v1/webhooks/regtank/dev${r.suffix}`),
    },
    "Dev RegTank webhook endpoints enabled"
  );
}

export { router as regTankWebhookRouter, regTankRootWebhookAliasRouter };
