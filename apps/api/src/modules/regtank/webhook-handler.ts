import crypto from "crypto";
import { getRegTankConfig } from "../../config/regtank";
import { RegTankService } from "./service";
import { RegTankWebhookPayload } from "./types";
import { logger } from "../../lib/logger";
import { AppError } from "../../lib/http/error-handler";

/**
 * RegTank Webhook Handler
 * Handles webhook signature verification and processing
 */
export class RegTankWebhookHandler {
  private config = getRegTankConfig();
  private service: RegTankService;

  constructor() {
    this.service = new RegTankService();
  }

  /**
   * Verify HMAC-SHA256 signature of webhook payload
   */
  verifySignature(rawBody: string, receivedSignature: string): boolean {
    if (!this.config.webhookSecret) {
      logger.warn("RegTank webhook secret not configured");
      return false;
    }

    // Compute HMAC-SHA256 signature
    const computedSignature = crypto
      .createHmac("sha256", this.config.webhookSecret)
      .update(rawBody)
      .digest("hex");

    // Extract signature from header (handle different formats)
    // Expected formats:
    // - "sha256=<signature>"
    // - "<signature>"
    let signatureToCompare = receivedSignature;
    if (receivedSignature.startsWith("sha256=")) {
      signatureToCompare = receivedSignature.substring(7);
    }

    // Use constant-time comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(computedSignature, "hex"),
        Buffer.from(signatureToCompare, "hex")
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          computedLength: computedSignature.length,
          receivedLength: signatureToCompare.length,
        },
        "Error comparing webhook signatures"
      );
      return false;
    }
  }

  /**
   * Process webhook payload
   * Verifies signature and processes the webhook
   */
  async processWebhook(
    rawBody: string,
    signature: string | undefined
  ): Promise<void> {
    // Verify signature if provided
    if (signature) {
      const isValid = this.verifySignature(rawBody, signature);

      if (!isValid) {
        logger.warn(
          {
            signatureProvided: !!signature,
            signatureLength: signature?.length,
          },
          "Invalid webhook signature - rejecting request"
        );
        throw new AppError(
          401,
          "INVALID_SIGNATURE",
          "Invalid webhook signature"
        );
      }

      logger.debug("Webhook signature verified successfully");
    } else {
      logger.warn("No webhook signature provided - accepting request (development mode)");
      // In production, you might want to reject requests without signatures
      // For now, we'll allow it in case RegTank hasn't implemented signatures yet
    }

    // Parse payload
    let payload: RegTankWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          bodyPreview: rawBody.substring(0, 200),
        },
        "Failed to parse webhook payload"
      );
      throw new AppError(400, "INVALID_PAYLOAD", "Invalid JSON payload");
    }

    // Validate required fields
    if (!payload.requestId) {
      logger.error({ payload }, "Webhook payload missing requestId");
      throw new AppError(400, "MISSING_REQUEST_ID", "Missing requestId in payload");
    }

    if (!payload.status) {
      logger.error({ payload }, "Webhook payload missing status");
      throw new AppError(400, "MISSING_STATUS", "Missing status in payload");
    }

    logger.info(
      {
        requestId: payload.requestId,
        status: payload.status,
        substatus: payload.substatus,
      },
      "Processing RegTank webhook"
    );

    // Process webhook (with idempotency check in service layer)
    await this.service.handleWebhookUpdate(payload);

    logger.info(
      {
        requestId: payload.requestId,
        status: payload.status,
      },
      "Webhook processed successfully"
    );
  }
}



