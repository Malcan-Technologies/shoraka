import crypto from "crypto";
import { getRegTankConfig } from "../../config/regtank";
import { RegTankWebhookPayload } from "./types";
import { logger } from "../../lib/logger";
import { AppError } from "../../lib/http/error-handler";
import { prismaDev } from "../../lib/prisma-dev";
import { prisma } from "../../lib/prisma";
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

    // Try to find onboarding record in dev database first
    let onboarding = await prismaDev.regTankOnboarding.findUnique({
      where: { request_id: requestId },
      include: {
        investor_organization: true,
        issuer_organization: true,
        user: true,
      },
    });

    // If not found in dev, check production database (fallback)
    // This handles the case where onboarding was created in prod but webhook is sent to dev endpoint
    if (!onboarding) {
      logger.info(
        { requestId, database: "dev" },
        "Onboarding not found in dev database, checking production database"
      );
      
      const prodOnboarding = await prisma.regTankOnboarding.findUnique({
        where: { request_id: requestId },
        include: {
          investor_organization: true,
          issuer_organization: true,
          user: true,
        },
      });

      if (prodOnboarding) {
        logger.info(
          { requestId, database: "dev" },
          "Found onboarding in production database, creating copy in dev database"
        );
        
        // Create a copy in dev database for future webhook processing
        // This ensures subsequent webhooks can find it in dev
        const existingInDev = await prismaDev.regTankOnboarding.findUnique({
          where: { request_id: requestId },
        });

        if (!existingInDev) {
          await prismaDev.regTankOnboarding.create({
            data: {
              id: prodOnboarding.id,
              user_id: prodOnboarding.user_id,
              investor_organization_id: prodOnboarding.investor_organization_id,
              issuer_organization_id: prodOnboarding.issuer_organization_id,
              organization_type: prodOnboarding.organization_type,
              portal_type: prodOnboarding.portal_type,
              request_id: prodOnboarding.request_id,
              reference_id: prodOnboarding.reference_id,
              onboarding_type: prodOnboarding.onboarding_type,
              verify_link: prodOnboarding.verify_link,
              verify_link_expires_at: prodOnboarding.verify_link_expires_at,
              status: prodOnboarding.status,
              substatus: prodOnboarding.substatus,
              regtank_response: prodOnboarding.regtank_response as any,
              webhook_payloads: prodOnboarding.webhook_payloads as any,
              created_at: prodOnboarding.created_at,
              updated_at: prodOnboarding.updated_at,
              completed_at: prodOnboarding.completed_at,
            },
          });

          logger.info(
            { requestId, database: "dev" },
            "Created onboarding copy in dev database"
          );
        }

        // Re-query from dev database to ensure we have the dev version
        onboarding = await prismaDev.regTankOnboarding.findUnique({
          where: { request_id: requestId },
          include: {
            investor_organization: true,
            issuer_organization: true,
            user: true,
          },
        });

        if (!onboarding) {
          logger.error(
            { requestId, database: "dev" },
            "Failed to query onboarding after creating copy in dev database"
          );
          throw new AppError(
            500,
            "INTERNAL_ERROR",
            "Failed to query onboarding after creating copy"
          );
        }
      }
    }

    if (!onboarding) {
      logger.warn(
        { requestId, database: "dev" },
        "Webhook received for unknown requestId (checked both dev and prod databases)"
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
    const statusUpper = status.toUpperCase();
    
    // Detect when liveness test is completed
    // RegTank sends LIVENESS_PASSED or WAIT_FOR_APPROVAL when liveness is done
    const isLivenessCompleted = 
      statusUpper === "LIVENESS_PASSED" || 
      statusUpper === "WAIT_FOR_APPROVAL";

    // Map RegTank status to our internal status
    // When liveness completes, set to PENDING_APPROVAL in reg_tank_onboarding table
    let internalStatus = statusUpper;
    if (isLivenessCompleted) {
      internalStatus = "PENDING_APPROVAL";
    }

    const updateData: {
      status: string;
      substatus?: string;
      completed_at?: Date;
    } = {
      status: internalStatus,
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

    // Update organization status based on RegTank status
    const organizationId = onboarding.investor_organization_id || onboarding.issuer_organization_id;

    // Update organization to PENDING_APPROVAL when liveness test completes
    if (isLivenessCompleted && organizationId) {
      const portalType = onboarding.portal_type as PortalType;

      try {
        if (portalType === "investor") {
          const orgExists = await prismaDev.investorOrganization.findUnique({
            where: { id: organizationId },
          });
          
          if (orgExists) {
            await prismaDev.investorOrganization.update({
              where: { id: organizationId },
              data: {
                onboarding_status: OnboardingStatus.PENDING_APPROVAL,
              },
            });
            logger.info(
              { organizationId, portalType, requestId, status: statusUpper, database: "dev" },
              "Liveness test completed, updated investor organization status to PENDING_APPROVAL"
            );
          } else {
            logger.warn(
              { organizationId, requestId, database: "dev" },
              "Investor organization not found in dev database, skipping PENDING_APPROVAL update"
            );
          }
        } else {
          const orgExists = await prismaDev.issuerOrganization.findUnique({
            where: { id: organizationId },
          });
          
          if (orgExists) {
            await prismaDev.issuerOrganization.update({
              where: { id: organizationId },
              data: {
                onboarding_status: OnboardingStatus.PENDING_APPROVAL,
              },
            });
            logger.info(
              { organizationId, portalType, requestId, status: statusUpper, database: "dev" },
              "Liveness test completed, updated issuer organization status to PENDING_APPROVAL"
            );
          } else {
            logger.warn(
              { organizationId, requestId, database: "dev" },
              "Issuer organization not found in dev database, skipping PENDING_APPROVAL update"
            );
          }
        }
      } catch (orgError) {
        logger.error(
          {
            error: orgError instanceof Error ? orgError.message : String(orgError),
            organizationId,
            portalType,
            requestId,
            status: statusUpper,
            database: "dev",
          },
          "Failed to update organization status to PENDING_APPROVAL in dev database"
        );
      }
    }

    // If approved, update organization status to COMPLETED in dev database
    if (status === "APPROVED" && organizationId) {
      const portalType = onboarding.portal_type as PortalType;

      // Update organization onboarding status in dev database
      // Check if organization exists first (may not exist if record was copied from prod)
      try {
        if (portalType === "investor") {
          const orgExists = await prismaDev.investorOrganization.findUnique({
            where: { id: organizationId },
          });
          
          if (orgExists) {
            await prismaDev.investorOrganization.update({
              where: { id: organizationId },
              data: {
                onboarding_status: OnboardingStatus.COMPLETED,
                onboarded_at: new Date(),
              },
            });
            logger.info({ organizationId, database: "dev" }, "Updated investor organization status to COMPLETED");
          } else {
            logger.warn(
              { organizationId, database: "dev" },
              "Investor organization not found in dev database, skipping organization update"
            );
          }
        } else {
          const orgExists = await prismaDev.issuerOrganization.findUnique({
            where: { id: organizationId },
          });
          
          if (orgExists) {
            await prismaDev.issuerOrganization.update({
              where: { id: organizationId },
              data: {
                onboarding_status: OnboardingStatus.COMPLETED,
                onboarded_at: new Date(),
              },
            });
            logger.info({ organizationId, database: "dev" }, "Updated issuer organization status to COMPLETED");
          } else {
            logger.warn(
              { organizationId, database: "dev" },
              "Issuer organization not found in dev database, skipping organization update"
            );
          }
        }
      } catch (orgError) {
        logger.error(
          {
            error: orgError instanceof Error ? orgError.message : String(orgError),
            organizationId,
            portalType,
            database: "dev",
          },
          "Failed to update organization in dev database, continuing with user update"
        );
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

