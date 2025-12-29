import { BaseWebhookHandler } from "./base-webhook-handler";
import { RegTankKYCWebhook } from "../types";
import { logger } from "../../../lib/logger";
import { RegTankRepository } from "../repository";
import { Prisma } from "@prisma/client";

/**
 * KYC (Know Your Customer) Webhook Handler
 * Handles webhooks from /kyc and /djkyc endpoints
 * References:
 * - https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.1-kyc-notification-definition
 * - https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.2-djkyc-notification-definition
 */
export class KYCWebhookHandler extends BaseWebhookHandler {
  private repository: RegTankRepository;
  private provider: "ACURIS" | "DOWJONES";

  constructor(provider: "ACURIS" | "DOWJONES" = "ACURIS") {
    super();
    this.repository = new RegTankRepository();
    this.provider = provider;
  }

  protected getWebhookType(): string {
    return `KYC (${this.provider})`;
  }

  protected async handle(payload: RegTankKYCWebhook): Promise<void> {
    const {
      requestId,
      referenceId,
      riskScore,
      riskLevel,
      status,
      messageStatus,
      possibleMatchCount,
      blacklistedMatchCount,
      onboardingId,
    } = payload;

    logger.info(
      {
        kycRequestId: requestId,
        referenceId,
        onboardingId,
        riskScore,
        riskLevel,
        status,
        messageStatus,
        possibleMatchCount,
        blacklistedMatchCount,
        provider: this.provider,
      },
      "[KYC Webhook] Processing KYC webhook - kycRequestId is the KYC ID, onboardingId is the onboarding request ID"
    );

    // Find onboarding record
    // Priority order:
    // 1. onboardingId (if provided) - this is the Individual Onboarding unique ID (e.g., "LD71656-R30")
    // 2. referenceId (if available) - our internal reference ID
    // Note: requestId is the KYC ID (e.g., "KYC06407"), NOT the onboarding request ID, so we don't use it
    let onboarding;
    let foundBy = "";
    
    if (onboardingId) {
      logger.debug(
        { onboardingId, kycRequestId: requestId },
        "[KYC Webhook] Attempting to find onboarding record by onboardingId"
      );
      onboarding = await this.repository.findByRequestId(onboardingId);
      if (onboarding) {
        foundBy = "onboardingId";
        logger.info(
          { 
            onboardingId, 
            kycRequestId: requestId,
            onboardingRequestId: onboarding.request_id,
            foundBy 
          },
          "[KYC Webhook] ✓ Found onboarding record by onboardingId"
        );
      } else {
        logger.debug(
          { onboardingId, kycRequestId: requestId },
          "[KYC Webhook] No onboarding record found by onboardingId"
        );
      }
    }
    
    if (!onboarding && referenceId) {
      logger.debug(
        { referenceId, kycRequestId: requestId },
        "[KYC Webhook] Attempting to find onboarding record by referenceId"
      );
      onboarding = await this.repository.findByReferenceId(referenceId);
      if (onboarding) {
        foundBy = "referenceId";
        logger.info(
          { 
            referenceId, 
            kycRequestId: requestId,
            onboardingRequestId: onboarding.request_id,
            foundBy 
          },
          "[KYC Webhook] ✓ Found onboarding record by referenceId"
        );
      } else {
        logger.debug(
          { referenceId, kycRequestId: requestId },
          "[KYC Webhook] No onboarding record found by referenceId"
        );
      }
    }

    if (!onboarding) {
      logger.warn(
        { 
          kycRequestId: requestId, 
          referenceId, 
          onboardingId,
          note: "KYC requestId is the KYC ID, not the onboarding request ID. Use onboardingId field instead."
        },
        "[KYC Webhook] ⚠ No matching onboarding record found - KYC webhook may be standalone or onboardingId/referenceId missing"
      );
      // Don't throw error - KYC webhooks may not always have associated onboarding records
      // They might be standalone KYC checks
      return;
    }

    // Append to history using the onboarding request_id (not the KYC requestId)
    logger.debug(
      {
        kycRequestId: requestId,
        onboardingRequestId: onboarding.request_id,
        foundBy,
      },
      "[KYC Webhook] Appending webhook payload to onboarding record history"
    );
    
    await this.repository.appendWebhookPayload(
      onboarding.request_id,
      payload as Prisma.InputJsonValue
    );

    logger.info(
      {
        kycRequestId: requestId,
        onboardingRequestId: onboarding.request_id,
        referenceId,
        onboardingId,
        status,
        riskLevel,
        riskScore,
        foundBy,
        organizationId: onboarding.investor_organization_id || onboarding.issuer_organization_id,
        portalType: onboarding.portal_type,
      },
      "[KYC Webhook] ✓ Successfully processed and linked to onboarding record"
    );

    // TODO: Handle KYC results - may need to update organization risk level or status
    // This depends on business logic requirements
  }
}

