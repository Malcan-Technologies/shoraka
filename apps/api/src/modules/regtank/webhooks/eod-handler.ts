import { BaseWebhookHandler } from "./base-webhook-handler";
import { RegTankEODWebhook } from "../types";
import { logger } from "../../../lib/logger";
import { AppError } from "../../../lib/http/error-handler";
import { RegTankRepository } from "../repository";

/**
 * EOD (Entity Onboarding Data) Webhook Handler
 * Handles webhooks from /eodliveness endpoint
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.8-business-onboarding-notification-definition-eod
 */
export class EODWebhookHandler extends BaseWebhookHandler {
  private repository: RegTankRepository;

  constructor() {
    super();
    this.repository = new RegTankRepository();
  }

  protected getWebhookType(): string {
    return "EOD (Entity Onboarding Data)";
  }

  protected async handle(payload: RegTankEODWebhook): Promise<void> {
    const { requestId, status, confidence, kycId } = payload;

    // Find onboarding record
    const onboarding = await this.repository.findByRequestId(requestId);
    if (!onboarding) {
      logger.warn({ requestId }, "EOD webhook received for unknown requestId");
      throw new AppError(
        404,
        "ONBOARDING_NOT_FOUND",
        `Onboarding not found for requestId: ${requestId}`
      );
    }

    // Append to history
    await this.repository.appendWebhookPayload(requestId, payload);

    // Status transition logic
    const statusUpper = status.toUpperCase();
    let internalStatus = statusUpper;

    if (statusUpper === "APPROVED" || statusUpper === "REJECTED") {
      internalStatus = statusUpper;
    }

    // Update database
    const updateData: {
      status: string;
      substatus?: string;
      completedAt?: Date;
    } = {
      status: internalStatus,
    };

    if (statusUpper === "APPROVED" || statusUpper === "REJECTED") {
      updateData.completedAt = new Date();
    }

    await this.repository.updateStatus(requestId, updateData);

    logger.info(
      {
        requestId,
        status: statusUpper,
        confidence,
        kycId,
      },
      "EOD webhook processed"
    );

    // TODO: Handle entity updates when EOD is approved
    // This may require additional logic to handle entity (director/shareholder) onboarding completion
  }
}

