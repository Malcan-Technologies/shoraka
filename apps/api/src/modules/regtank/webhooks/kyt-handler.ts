import { BaseWebhookHandler } from "./base-webhook-handler";
import { RegTankKYTWebhook } from "../types";
import { logger } from "../../../lib/logger";
import { RegTankRepository } from "../repository";

/**
 * KYT (Know Your Transaction) Webhook Handler
 * Handles webhooks from /kyt endpoint
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.5-kyt-notification-definition
 */
export class KYTWebhookHandler extends BaseWebhookHandler {
  private repository: RegTankRepository;

  constructor() {
    super();
    this.repository = new RegTankRepository();
  }

  protected getWebhookType(): string {
    return "KYT (Know Your Transaction)";
  }

  protected async handle(payload: RegTankKYTWebhook): Promise<void> {
    const {
      requestId,
      referenceId,
      riskScore,
      riskLevel,
      typeOfChange,
      status,
      messageStatus,
      assignee,
      timestamp,
    } = payload;

    logger.info(
      {
        requestId,
        referenceId,
        riskScore,
        riskLevel,
        typeOfChange,
        status,
        messageStatus,
      },
      "Processing KYT webhook"
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
        "KYT webhook received for unknown requestId/referenceId"
      );
      // Don't throw error - KYT webhooks may not always have associated onboarding records
      // They are transaction monitoring webhooks
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
        status,
        riskLevel,
        typeOfChange,
      },
      "KYT webhook processed"
    );

    // TODO: Handle KYT results - may need to update transaction status or trigger alerts
    // This depends on business logic requirements
  }
}

