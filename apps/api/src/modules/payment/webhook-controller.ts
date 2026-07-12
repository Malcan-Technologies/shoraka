import { randomUUID } from "crypto";
import { Router, Request, Response, NextFunction } from "express";
import express from "express";
import { CurlecGatewayAccount } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { ingestCurlecWebhook, processStoredCurlecWebhook } from "./webhook-service";

export const curlecWebhookRouter = Router();

function readRawBody(req: Request): string {
  if (req.body instanceof Buffer) {
    return req.body.toString("utf8");
  }
  if (typeof req.body === "string") {
    return req.body;
  }
  return "";
}

function resolveCorrelationId(req: Request, res: Response): string {
  const existing =
    (req.headers["x-correlation-id"] as string | undefined) ||
    (res.locals.correlationId as string | undefined);
  const correlationId = existing || randomUUID();
  res.setHeader("X-Correlation-ID", correlationId);
  return correlationId;
}

async function handleCurlecWebhookRoute(
  req: Request,
  res: Response,
  gatewayAccount: CurlecGatewayAccount
) {
  const correlationId = resolveCorrelationId(req, res);

  try {
    const rawBody = readRawBody(req);
    const signature = req.headers["x-razorpay-signature"] as string | undefined;
    const eventId = req.headers["x-razorpay-event-id"] as string | undefined;

    const result = await ingestCurlecWebhook({
      rawBody,
      signature,
      eventId,
      gatewayAccount,
    });

    await processStoredCurlecWebhook(result.eventId, undefined, gatewayAccount);

    res.status(200).json({
      success: true,
      data: {
        eventId: result.eventId,
        eventType: result.eventType,
        duplicate: result.duplicate,
      },
      correlationId,
    });
  } catch (error) {
    if (error instanceof AppError) {
      logger.warn(
        {
          correlationId,
          gatewayAccount,
          code: error.code,
          statusCode: error.statusCode,
        },
        "Curlec webhook rejected"
      );

      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
        correlationId,
      });
      return;
    }

    logger.error(
      {
        correlationId,
        gatewayAccount,
        error: error instanceof Error ? error.message : String(error),
      },
      "Unexpected Curlec webhook error"
    );

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error processing webhook",
      },
      correlationId,
    });
  }
}

function accountWebhookRoute(path: string, gatewayAccount: CurlecGatewayAccount) {
  curlecWebhookRouter.post(
    path,
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => handleCurlecWebhookRoute(req, res, gatewayAccount)
  );
}

/**
 * Curlec money-in webhooks — mounted before express.json() with express.raw().
 * Transitional route support:
 * - POST /v1/webhooks/curlec (LEGACY_DEFAULT only)
 * - POST /v1/webhooks/curlec/legacy
 * - POST /v1/webhooks/curlec/operating
 * - POST /v1/webhooks/curlec/investor-pool
 */
accountWebhookRoute("/curlec/legacy", CurlecGatewayAccount.LEGACY_DEFAULT);
accountWebhookRoute("/curlec/operating", CurlecGatewayAccount.OPERATING);
accountWebhookRoute("/curlec/investor-pool", CurlecGatewayAccount.INVESTOR_POOL);
curlecWebhookRouter.post(
  "/curlec",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response, _next: NextFunction) =>
    handleCurlecWebhookRoute(req, res, CurlecGatewayAccount.LEGACY_DEFAULT)
);
