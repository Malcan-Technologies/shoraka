import { BaseWebhookHandler } from "./base-webhook-handler";
import { RegTankService } from "../service";
import { RegTankIndividualOnboardingWebhook, PortalType } from "../types";
import { logger } from "../../../lib/logger";
import { AppError } from "../../../lib/http/error-handler";
import { RegTankRepository } from "../repository";
import { OrganizationRepository } from "../../organization/repository";
import { OnboardingStatus } from "@prisma/client";

/**
 * Individual Onboarding Webhook Handler
 * Handles webhooks from /liveness endpoint
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.6-individual-onboarding-notification-definition
 */
export class IndividualOnboardingWebhookHandler extends BaseWebhookHandler {
  private service: RegTankService;
  private repository: RegTankRepository;
  private organizationRepository: OrganizationRepository;

  constructor() {
    super();
    this.service = new RegTankService();
    this.repository = new RegTankRepository();
    this.organizationRepository = new OrganizationRepository();
  }

  protected getWebhookType(): string {
    return "Individual Onboarding";
  }

  protected async handle(payload: RegTankIndividualOnboardingWebhook): Promise<void> {
    const { requestId, status } = payload;

    // Find onboarding record
    const onboarding = await this.repository.findByRequestId(requestId);
    if (!onboarding) {
      logger.warn({ requestId }, "Webhook received for unknown requestId");
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

    // NEW: Explicit LIVENESS_PASSED status
    if (statusUpper === "LIVENESS_PASSED") {
      internalStatus = "LIVENESS_PASSED";
    } else if (statusUpper === "WAIT_FOR_APPROVAL") {
      internalStatus = "PENDING_APPROVAL";
    } else if (statusUpper === "APPROVED" || statusUpper === "REJECTED") {
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

    // Update organization status based on RegTank status
    const organizationId = onboarding.investor_organization_id || onboarding.issuer_organization_id;
    const portalType = onboarding.portal_type as PortalType;

    // Update organization to LIVENESS_PASSED when liveness test completes
    if (statusUpper === "LIVENESS_PASSED" && organizationId) {
      try {
        if (portalType === "investor") {
          const orgExists = await this.organizationRepository.findInvestorOrganizationById(organizationId);
          if (orgExists) {
            await this.organizationRepository.updateInvestorOrganizationOnboarding(
              organizationId,
              OnboardingStatus.PENDING_APPROVAL
            );
            logger.info(
              { organizationId, portalType, requestId, status: statusUpper },
              "Liveness test passed, updated investor organization status to PENDING_APPROVAL"
            );
          }
        } else {
          const orgExists = await this.organizationRepository.findIssuerOrganizationById(organizationId);
          if (orgExists) {
            await this.organizationRepository.updateIssuerOrganizationOnboarding(
              organizationId,
              OnboardingStatus.PENDING_APPROVAL
            );
            logger.info(
              { organizationId, portalType, requestId, status: statusUpper },
              "Liveness test passed, updated issuer organization status to PENDING_APPROVAL"
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
          },
          "Failed to update organization status after LIVENESS_PASSED"
        );
      }
    }

    // Update organization to PENDING_APPROVAL when WAIT_FOR_APPROVAL
    if (statusUpper === "WAIT_FOR_APPROVAL" && organizationId) {
      try {
        if (portalType === "investor") {
          const orgExists = await this.organizationRepository.findInvestorOrganizationById(organizationId);
          if (orgExists) {
            await this.organizationRepository.updateInvestorOrganizationOnboarding(
              organizationId,
              OnboardingStatus.PENDING_APPROVAL
            );
            logger.info(
              { organizationId, portalType, requestId },
              "Updated investor organization status to PENDING_APPROVAL"
            );
          }
        } else {
          const orgExists = await this.organizationRepository.findIssuerOrganizationById(organizationId);
          if (orgExists) {
            await this.organizationRepository.updateIssuerOrganizationOnboarding(
              organizationId,
              OnboardingStatus.PENDING_APPROVAL
            );
            logger.info(
              { organizationId, portalType, requestId },
              "Updated issuer organization status to PENDING_APPROVAL"
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
          },
          "Failed to update organization status to PENDING_APPROVAL"
        );
      }
    }

    // If approved, update organization status to COMPLETED
    if (statusUpper === "APPROVED" && organizationId) {
      await this.service.handleWebhookUpdate({
        requestId,
        status: "APPROVED",
        referenceId: onboarding.reference_id,
      } as any);
    }
  }
}

