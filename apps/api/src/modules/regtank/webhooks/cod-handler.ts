import { BaseWebhookHandler } from "./base-webhook-handler";
import { RegTankCODWebhook } from "../types";
import { logger } from "../../../lib/logger";
import { AppError } from "../../../lib/http/error-handler";
import { RegTankRepository } from "../repository";
import { OrganizationRepository } from "../../organization/repository";
import { AuthRepository } from "../../auth/repository";
import { getRegTankAPIClient } from "../api-client";
import { OnboardingStatus, UserRole } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { PortalType } from "../types";

/**
 * COD (Company Onboarding Data) Webhook Handler
 * Handles webhooks from /codliveness endpoint
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.7-business-onboarding-notification-definition-cod
 */
export class CODWebhookHandler extends BaseWebhookHandler {
  private repository: RegTankRepository;
  private organizationRepository: OrganizationRepository;
  private authRepository: AuthRepository;
  private apiClient: ReturnType<typeof getRegTankAPIClient>;

  constructor() {
    super();
    this.repository = new RegTankRepository();
    this.organizationRepository = new OrganizationRepository();
    this.authRepository = new AuthRepository();
    this.apiClient = getRegTankAPIClient();
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
    await this.repository.appendWebhookPayload(requestId, payload as Prisma.InputJsonValue);

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

    // Handle organization updates when COD is approved
    const organizationId = onboarding.investor_organization_id || onboarding.issuer_organization_id;
    const portalType = onboarding.portal_type as PortalType;

    if (statusUpper === "APPROVED" && organizationId) {
      try {
        // Fetch COD details from RegTank API
        logger.info(
          { requestId, organizationId, portalType },
          "Fetching RegTank COD details after approval"
        );

        const codDetails = await this.apiClient.getCorporateOnboardingDetails(requestId);

        // Update organization status to PENDING_APPROVAL
        if (portalType === "investor") {
          const org = await this.organizationRepository.findInvestorOrganizationById(organizationId);
          if (org) {
            const previousStatus = org.onboarding_status;
            await this.organizationRepository.updateInvestorOrganizationOnboarding(
              organizationId,
              OnboardingStatus.PENDING_APPROVAL
            );

            // Create onboarding log
            try {
              await this.authRepository.createOnboardingLog({
                userId: onboarding.user_id,
                role: UserRole.INVESTOR,
                eventType: "COD_APPROVED",
                portal: portalType,
                metadata: {
                  organizationId,
                  requestId,
                  previousStatus,
                  newStatus: OnboardingStatus.PENDING_APPROVAL,
                  codDetails: codDetails,
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId,
                  requestId,
                },
                "Failed to create COD_APPROVED log (non-blocking)"
              );
            }

            logger.info(
              { organizationId, portalType, requestId },
              "Updated investor organization status to PENDING_APPROVAL after COD approval"
            );
          }
        } else {
          const org = await this.organizationRepository.findIssuerOrganizationById(organizationId);
          if (org) {
            const previousStatus = org.onboarding_status;
            await this.organizationRepository.updateIssuerOrganizationOnboarding(
              organizationId,
              OnboardingStatus.PENDING_APPROVAL
            );

            // Create onboarding log
            try {
              await this.authRepository.createOnboardingLog({
                userId: onboarding.user_id,
                role: UserRole.ISSUER,
                eventType: "COD_APPROVED",
                portal: portalType,
                metadata: {
                  organizationId,
                  requestId,
                  previousStatus,
                  newStatus: OnboardingStatus.PENDING_APPROVAL,
                  codDetails: codDetails,
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId,
                  requestId,
                },
                "Failed to create COD_APPROVED log (non-blocking)"
              );
            }

            logger.info(
              { organizationId, portalType, requestId },
              "Updated issuer organization status to PENDING_APPROVAL after COD approval"
            );
          }
        }
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            organizationId,
            portalType,
            requestId,
          },
          "Failed to fetch COD details or update organization (non-blocking)"
        );
        // Don't throw - allow webhook to complete even if organization update fails
      }
    } else if (statusUpper === "REJECTED" && organizationId) {
      // Update organization status to REJECTED
      try {
        if (portalType === "investor") {
          const org = await this.organizationRepository.findInvestorOrganizationById(organizationId);
          if (org) {
            const previousStatus = org.onboarding_status;
            await this.organizationRepository.updateInvestorOrganizationOnboarding(
              organizationId,
              OnboardingStatus.REJECTED
            );

            // Create onboarding log
            try {
              await this.authRepository.createOnboardingLog({
                userId: onboarding.user_id,
                role: UserRole.INVESTOR,
                eventType: "COD_REJECTED",
                portal: portalType,
                metadata: {
                  organizationId,
                  requestId,
                  previousStatus,
                  newStatus: OnboardingStatus.REJECTED,
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId,
                  requestId,
                },
                "Failed to create COD_REJECTED log (non-blocking)"
              );
            }

            logger.info(
              { organizationId, portalType, requestId },
              "Updated investor organization status to REJECTED after COD rejection"
            );
          }
        } else {
          const org = await this.organizationRepository.findIssuerOrganizationById(organizationId);
          if (org) {
            const previousStatus = org.onboarding_status;
            await this.organizationRepository.updateIssuerOrganizationOnboarding(
              organizationId,
              OnboardingStatus.REJECTED
            );

            // Create onboarding log
            try {
              await this.authRepository.createOnboardingLog({
                userId: onboarding.user_id,
                role: UserRole.ISSUER,
                eventType: "COD_REJECTED",
                portal: portalType,
                metadata: {
                  organizationId,
                  requestId,
                  previousStatus,
                  newStatus: OnboardingStatus.REJECTED,
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId,
                  requestId,
                },
                "Failed to create COD_REJECTED log (non-blocking)"
              );
            }

            logger.info(
              { organizationId, portalType, requestId },
              "Updated issuer organization status to REJECTED after COD rejection"
            );
          }
        }
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            organizationId,
            portalType,
            requestId,
          },
          "Failed to update organization status to REJECTED (non-blocking)"
        );
      }
    }
  }
}

