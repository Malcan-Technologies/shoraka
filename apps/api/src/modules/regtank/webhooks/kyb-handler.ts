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
        requestId,
        referenceId,
        riskScore,
        riskLevel,
        status,
        messageStatus,
        possibleMatchCount,
        blacklistedMatchCount,
        provider: this.provider,
      },
      "Processing KYB webhook"
    );

    // Find onboarding record by referenceId (if available) or requestId
    let onboarding;
    if (referenceId) {
      onboarding = await this.repository.findByReferenceId(referenceId);
    }
    if (!onboarding && requestId) {
      onboarding = await this.repository.findByRequestId(requestId);
    }

    if (!onboarding) {
      logger.warn(
        { requestId, referenceId },
        "KYB webhook received for unknown requestId/referenceId"
      );
      // Don't throw error - KYB webhooks may not always have associated onboarding records
      return;
    }

    // Append to history
    await this.repository.appendWebhookPayload(
      onboarding.request_id,
      payload as Prisma.InputJsonValue
    );

    logger.info(
      {
        requestId,
        referenceId,
        onboardingId,
        status,
        riskLevel,
      },
      "KYB webhook processed"
    );

    // TODO: Handle KYB results - may need to update organization risk level or status
    // This depends on business logic requirements
  }
}

