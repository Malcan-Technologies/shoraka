import { BaseWebhookHandler } from "./base-webhook-handler";
import { RegTankKYBWebhook } from "../types";
import { logger } from "../../../lib/logger";
import { RegTankRepository } from "../repository";
import { Prisma } from "@prisma/client";

/**
 * KYB (Know Your Business) Webhook Handler
 * Handles webhooks from /kyb and /djkyb endpoints
 * References:
 * - https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.3-kyb-notification-definition
 * - https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.4-djkyb-notification-definition
 */
export class KYBWebhookHandler extends BaseWebhookHandler {
  private repository: RegTankRepository;
  private provider: "ACURIS" | "DOWJONES";

  constructor(provider: "ACURIS" | "DOWJONES" = "ACURIS") {
    super();
    this.repository = new RegTankRepository();
    this.provider = provider;
  }

  protected getWebhookType(): string {
    return `KYB (${this.provider})`;
  }

  protected async handle(payload: RegTankKYBWebhook): Promise<void> {
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
        kybRequestId: requestId,
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
      "[KYB Webhook] Processing KYB webhook - kybRequestId is the KYB ID, onboardingId is the onboarding request ID"
    );

    // Find onboarding record
    // Priority order:
    // 1. onboardingId (if provided) - this is the Individual Onboarding unique ID (e.g., "LD71656-R30")
    // 2. referenceId (if available) - our internal reference ID
    // Note: requestId is the KYB ID (e.g., "KYB06407"), NOT the onboarding request ID, so we don't use it
    let onboarding;
    let foundBy = "";
    
    if (onboardingId) {
      logger.debug(
        { onboardingId, kybRequestId: requestId },
        "[KYB Webhook] Attempting to find onboarding record by onboardingId"
      );
      onboarding = await this.repository.findByRequestId(onboardingId);
      if (onboarding) {
        foundBy = "onboardingId";
        logger.info(
          { 
            onboardingId, 
            kybRequestId: requestId,
            onboardingRequestId: onboarding.request_id,
            foundBy 
          },
          "[KYB Webhook] ✓ Found onboarding record by onboardingId"
        );
      } else {
        logger.debug(
          { onboardingId, kybRequestId: requestId },
          "[KYB Webhook] No onboarding record found by onboardingId"
        );
      }
    }
    
    if (!onboarding && referenceId) {
      logger.debug(
        { referenceId, kybRequestId: requestId },
        "[KYB Webhook] Attempting to find onboarding record by referenceId"
      );
      onboarding = await this.repository.findByReferenceId(referenceId);
      if (onboarding) {
        foundBy = "referenceId";
        logger.info(
          { 
            referenceId, 
            kybRequestId: requestId,
            onboardingRequestId: onboarding.request_id,
            foundBy 
          },
          "[KYB Webhook] ✓ Found onboarding record by referenceId"
        );
      } else {
        logger.debug(
          { referenceId, kybRequestId: requestId },
          "[KYB Webhook] No onboarding record found by referenceId"
        );
      }
    }

    if (!onboarding) {
      logger.warn(
        { 
          kybRequestId: requestId, 
          referenceId, 
          onboardingId,
          note: "KYB requestId is the KYB ID, not the onboarding request ID. Use onboardingId field instead."
        },
        "[KYB Webhook] ⚠ No matching onboarding record found - KYB webhook may be standalone or onboardingId/referenceId missing"
      );
      // Don't throw error - KYB webhooks may not always have associated onboarding records
      return;
    }

    // Append to history using the onboarding request_id (not the KYB requestId)
    logger.debug(
      {
        kybRequestId: requestId,
        onboardingRequestId: onboarding.request_id,
        foundBy,
      },
      "[KYB Webhook] Appending webhook payload to onboarding record history"
    );
    
    await this.repository.appendWebhookPayload(
      onboarding.request_id,
      payload as Prisma.InputJsonValue
    );

    logger.info(
      {
        kybRequestId: requestId,
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
      "[KYB Webhook] ✓ Successfully processed and linked to onboarding record"
    );

    // TODO: Handle KYB results - may need to update organization risk level or status
    // This depends on business logic requirements
  }
}

