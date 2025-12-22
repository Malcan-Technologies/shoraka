import { BaseWebhookHandler } from "./base-webhook-handler";
import { RegTankKYCWebhook } from "../types";
import { logger } from "../../../lib/logger";
import { RegTankRepository } from "../repository";

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
      "Processing KYC webhook"
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
        "KYC webhook received for unknown requestId/referenceId"
      );
      // Don't throw error - KYC webhooks may not always have associated onboarding records
      // They might be standalone KYC checks
      return;
    }

    // Append to history
    await this.repository.appendWebhookPayload(
      onboarding.request_id,
      payload
    );

    logger.info(
      {
        requestId,
        referenceId,
        onboardingId,
        status,
        riskLevel,
      },
      "KYC webhook processed"
    );

    // TODO: Handle KYC results - may need to update organization risk level or status
    // This depends on business logic requirements
  }
}

