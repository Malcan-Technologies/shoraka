import { BaseWebhookHandler } from "./base-webhook-handler";
import { RegTankCODWebhook } from "../types";
import { logger } from "../../../lib/logger";
import { AppError } from "../../../lib/http/error-handler";
import { RegTankRepository } from "../repository";

/**
 * COD (Company Onboarding Data) Webhook Handler
 * Handles webhooks from /codliveness endpoint
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.7-business-onboarding-notification-definition-cod
 */
export class CODWebhookHandler extends BaseWebhookHandler {
  private repository: RegTankRepository;

  constructor() {
    super();
    this.repository = new RegTankRepository();
  }

  protected getWebhookType(): string {
    return "COD (Company Onboarding Data)";
  }

  protected async handle(payload: RegTankCODWebhook): Promise<void> {
    const { requestId, status, isPrimary, corpIndvDirectors, corpIndvShareholders, corpBizShareholders, kybId } = payload;

    // Find onboarding record
    const onboarding = await this.repository.findByRequestId(requestId);
    if (!onboarding) {
      logger.warn({ requestId }, "COD webhook received for unknown requestId");
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
        isPrimary,
        directorCount: corpIndvDirectors.length,
        shareholderCount: corpIndvShareholders.length,
        bizShareholderCount: corpBizShareholders.length,
        kybId,
      },
      "COD webhook processed"
    );

    // TODO: Handle organization updates when COD is approved
    // This may require additional logic to handle corporate onboarding completion
  }
}

