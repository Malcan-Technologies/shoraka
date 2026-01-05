import { BaseWebhookHandler } from "./base-webhook-handler";
import { RegTankService } from "../service";
import { RegTankIndividualOnboardingWebhook, PortalType } from "../types";
import { logger } from "../../../lib/logger";
import { AppError } from "../../../lib/http/error-handler";
import { RegTankRepository } from "../repository";
import { OrganizationRepository } from "../../organization/repository";
import { OnboardingStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

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
    await this.repository.appendWebhookPayload(requestId, payload as Prisma.InputJsonValue);

    // Status transition logic for regtank_onboarding table:
    // IN_PROGRESS → PENDING_APPROVAL → PENDING_AML → COMPLETED/APPROVED
    // Note: Final approval is done on our side, not in RegTank
    const statusUpper = status.toUpperCase();
    let internalStatus = statusUpper;

    // Map form filling statuses (before liveness test)
    if (statusUpper === "PROCESSING" || statusUpper === "ID_UPLOADED" || statusUpper === "LIVENESS_STARTED") {
      internalStatus = "FORM_FILLING";
    } else if (statusUpper === "LIVENESS_PASSED") {
      internalStatus = "LIVENESS_PASSED";
    } else if (statusUpper === "WAIT_FOR_APPROVAL") {
      internalStatus = "PENDING_APPROVAL";
    } else if (statusUpper === "APPROVED") {
      // When RegTank approves, set status to PENDING_AML (not APPROVED)
      // Final approval (COMPLETED) happens on our side after AML approval
      internalStatus = "PENDING_AML";
    } else if (statusUpper === "REJECTED") {
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

    // Set completed_at only if REJECTED
    // APPROVED from RegTank becomes PENDING_AML, completed_at set when status becomes COMPLETED
    if (statusUpper === "REJECTED") {
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
            const previousStatus = orgExists.onboarding_status;
            await this.organizationRepository.updateInvestorOrganizationOnboarding(
              organizationId,
              OnboardingStatus.PENDING_APPROVAL
            );
            
            // Create form filled log (user completed form and liveness test)
            try {
              await prisma.onboardingLog.create({
                data: {
                  user_id: onboarding.user_id,
                  role: UserRole.INVESTOR,
                  event_type: "FORM_FILLED",
                  portal: portalType,
                  metadata: {
                    organizationId,
                    requestId,
                    previousStatus,
                    newStatus: OnboardingStatus.PENDING_APPROVAL,
                    trigger: "LIVENESS_PASSED",
                  },
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId,
                  requestId,
                },
                "Failed to create form filled log (non-blocking)"
              );
            }
            
            logger.info(
              { organizationId, portalType, requestId, status: statusUpper },
              "Liveness test passed, updated investor organization status to PENDING_APPROVAL"
            );
          }
        } else {
          const orgExists = await this.organizationRepository.findIssuerOrganizationById(organizationId);
          if (orgExists) {
            const previousStatus = orgExists.onboarding_status;
            await this.organizationRepository.updateIssuerOrganizationOnboarding(
              organizationId,
              OnboardingStatus.PENDING_APPROVAL
            );
            
            // Create form filled log (user completed form and liveness test)
            try {
              await prisma.onboardingLog.create({
                data: {
                  user_id: onboarding.user_id,
                  role: UserRole.ISSUER,
                  event_type: "FORM_FILLED",
                  portal: portalType,
                  metadata: {
                    organizationId,
                    requestId,
                    previousStatus,
                    newStatus: OnboardingStatus.PENDING_APPROVAL,
                    trigger: "LIVENESS_PASSED",
                  },
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId,
                  requestId,
                },
                "Failed to create form filled log (non-blocking)"
              );
            }
            
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
            const previousStatus = orgExists.onboarding_status;
            await this.organizationRepository.updateInvestorOrganizationOnboarding(
              organizationId,
              OnboardingStatus.PENDING_APPROVAL
            );
            
            // Create form filled log (user completed form and liveness test)
            try {
              await prisma.onboardingLog.create({
                data: {
                  user_id: onboarding.user_id,
                  role: UserRole.INVESTOR,
                  event_type: "FORM_FILLED",
                  portal: portalType,
                  metadata: {
                    organizationId,
                    requestId,
                    previousStatus,
                    newStatus: OnboardingStatus.PENDING_APPROVAL,
                    trigger: "WAIT_FOR_APPROVAL",
                  },
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId,
                  requestId,
                },
                "Failed to create form filled log (non-blocking)"
              );
            }
            
            logger.info(
              { organizationId, portalType, requestId },
              "Updated investor organization status to PENDING_APPROVAL"
            );
          }
        } else {
          const orgExists = await this.organizationRepository.findIssuerOrganizationById(organizationId);
          if (orgExists) {
            const previousStatus = orgExists.onboarding_status;
            await this.organizationRepository.updateIssuerOrganizationOnboarding(
              organizationId,
              OnboardingStatus.PENDING_APPROVAL
            );
            
            // Create form filled log (user completed form and liveness test)
            try {
              await prisma.onboardingLog.create({
                data: {
                  user_id: onboarding.user_id,
                  role: UserRole.ISSUER,
                  event_type: "FORM_FILLED",
                  portal: portalType,
                  metadata: {
                    organizationId,
                    requestId,
                    previousStatus,
                    newStatus: OnboardingStatus.PENDING_APPROVAL,
                    trigger: "WAIT_FOR_APPROVAL",
                  },
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId,
                  requestId,
                },
                "Failed to create form filled log (non-blocking)"
              );
            }
            
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

    // If rejected, update organization status to REJECTED and log it
    if (statusUpper === "REJECTED" && organizationId) {
      const portalType = onboarding.portal_type as PortalType;
      
      try {
        let previousStatus: OnboardingStatus | null = null;
        
        if (portalType === "investor") {
          const orgExists = await this.organizationRepository.findInvestorOrganizationById(organizationId);
          if (orgExists) {
            previousStatus = orgExists.onboarding_status;
            await this.organizationRepository.updateInvestorOrganizationOnboarding(
              organizationId,
              OnboardingStatus.REJECTED
            );
            
            // Create ONBOARDING_REJECTED log
            try {
              await prisma.onboardingLog.create({
                data: {
                  user_id: onboarding.user_id,
                  role: UserRole.INVESTOR,
                  event_type: "ONBOARDING_REJECTED",
                  portal: portalType,
                  metadata: {
                    organizationId,
                    requestId,
                    previousStatus,
                    newStatus: OnboardingStatus.REJECTED,
                    trigger: "REGTANK_REJECTION",
                  },
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId,
                  requestId,
                },
                "Failed to create ONBOARDING_REJECTED log (non-blocking)"
              );
            }
            
            logger.info(
              { organizationId, portalType, requestId, previousStatus },
              "Updated investor organization status to REJECTED and logged rejection event"
            );
          }
        } else {
          const orgExists = await this.organizationRepository.findIssuerOrganizationById(organizationId);
          if (orgExists) {
            previousStatus = orgExists.onboarding_status;
            await this.organizationRepository.updateIssuerOrganizationOnboarding(
              organizationId,
              OnboardingStatus.REJECTED
            );
            
            // Create ONBOARDING_REJECTED log
            try {
              await prisma.onboardingLog.create({
                data: {
                  user_id: onboarding.user_id,
                  role: UserRole.ISSUER,
                  event_type: "ONBOARDING_REJECTED",
                  portal: portalType,
                  metadata: {
                    organizationId,
                    requestId,
                    previousStatus,
                    newStatus: OnboardingStatus.REJECTED,
                    trigger: "REGTANK_REJECTION",
                  },
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId,
                  requestId,
                },
                "Failed to create ONBOARDING_REJECTED log (non-blocking)"
              );
            }
            
            logger.info(
              { organizationId, portalType, requestId, previousStatus },
              "Updated issuer organization status to REJECTED and logged rejection event"
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
          "Failed to update organization status to REJECTED"
        );
      }
    }
  }
}

