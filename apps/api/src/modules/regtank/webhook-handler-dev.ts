import crypto from "crypto";
import { getRegTankConfig } from "../../config/regtank";
import { RegTankWebhookPayload } from "./types";
import { logger } from "../../lib/logger";
import { AppError } from "../../lib/http/error-handler";
import { prismaDev } from "../../lib/prisma-dev";
import { OnboardingStatus, UserRole } from "@prisma/client";
import { PortalType } from "./types";

/**
 * RegTank Dev Webhook Handler
 * Handles webhook signature verification and processing for DEV database
 * This allows testing webhooks in production by writing to dev database
 */
export class RegTankDevWebhookHandler {
  private config = getRegTankConfig();

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
   * Process webhook payload for DEV database
   * Verifies signature and processes the webhook to dev database
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
      logger.warn("No webhook signature provided - accepting request (dev mode)");
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
        database: "dev",
      },
      "Processing RegTank webhook (DEV database)"
    );

    // Process webhook using dev database
    await this.handleWebhookUpdate(payload);

    logger.info(
      {
        requestId: payload.requestId,
        status: payload.status,
        database: "dev",
      },
      "Webhook processed successfully (DEV database)"
    );
  }

  /**
   * Handle webhook update for DEV database
   */
  private async handleWebhookUpdate(
    payload: RegTankWebhookPayload
  ): Promise<void> {
    const { requestId, status, substatus } = payload;

    // Find onboarding record in dev database
    const onboarding = await prismaDev.regTankOnboarding.findUnique({
      where: { request_id: requestId },
      include: {
        investor_organization: true,
        issuer_organization: true,
        user: true,
      },
    });

    if (!onboarding) {
      logger.warn(
        { requestId, database: "dev" },
        "Webhook received for unknown requestId (DEV database)"
      );
      throw new AppError(
        404,
        "ONBOARDING_NOT_FOUND",
        `Onboarding not found for requestId: ${requestId}`
      );
    }

    // Append webhook payload to history
    const currentPayloads = (onboarding.webhook_payloads || []) as any[];
    await prismaDev.regTankOnboarding.update({
      where: { request_id: requestId },
      data: {
        webhook_payloads: {
          set: [...currentPayloads, payload],
        },
      },
    });

    // Update status
    const updateData: {
      status: string;
      substatus?: string;
      completed_at?: Date;
    } = {
      status: status.toUpperCase(),
    };

    if (substatus) {
      updateData.substatus = substatus;
    }

    // Set completed_at if status is APPROVED or REJECTED
    if (status === "APPROVED" || status === "REJECTED") {
      updateData.completed_at = new Date();
    }

    await prismaDev.regTankOnboarding.update({
      where: { request_id: requestId },
      data: updateData,
    });

    // If approved, update organization status in dev database
    const organizationId = onboarding.investor_organization_id || onboarding.issuer_organization_id;
    if (status === "APPROVED" && organizationId) {
      const portalType = onboarding.portal_type as PortalType;

      // Update organization onboarding status in dev database
      if (portalType === "investor") {
        await prismaDev.investorOrganization.update({
          where: { id: organizationId },
          data: {
            onboarding_status: OnboardingStatus.COMPLETED,
          },
        });
      } else {
        await prismaDev.issuerOrganization.update({
          where: { id: organizationId },
          data: {
            onboarding_status: OnboardingStatus.COMPLETED,
          },
        });
      }

      // Update user's account array in dev database
      const user = await prismaDev.user.findUnique({
        where: { user_id: onboarding.user_id },
      });

      if (user) {
        const accountArrayField =
          portalType === "investor" ? "investor_account" : "issuer_account";
        const currentArray =
          portalType === "investor"
            ? user.investor_account
            : user.issuer_account;

        // Find the first 'temp' and replace it with the organization ID
        const tempIndex = currentArray.indexOf("temp");
        if (tempIndex !== -1) {
          const updatedArray = [...currentArray];
          updatedArray[tempIndex] = organizationId;

          await prismaDev.user.update({
            where: { user_id: onboarding.user_id },
            data: {
              [accountArrayField]: { set: updatedArray },
            },
          });
        }
      }

      // Log onboarding completed in dev database
      const role =
        portalType === "investor" ? UserRole.INVESTOR : UserRole.ISSUER;

      await prismaDev.onboardingLog.create({
        data: {
          user_id: onboarding.user_id,
          role,
          event_type: "ONBOARDING_COMPLETED",
          portal: portalType,
          metadata: {
            organizationId,
            requestId,
            status: "APPROVED",
            database: "dev",
          },
        },
      });

      logger.info(
        {
          requestId,
          organizationId,
          portalType,
          database: "dev",
        },
        "Organization onboarding completed via RegTank webhook (DEV database)"
      );
    }
  }
}

