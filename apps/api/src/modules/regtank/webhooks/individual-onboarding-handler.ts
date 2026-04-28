import { BaseWebhookHandler } from "./base-webhook-handler";
import { RegTankService } from "../service";
import { RegTankIndividualOnboardingWebhook, PortalType } from "../types";
import { logger } from "../../../lib/logger";
import { RegTankRepository } from "../repository";
import { OrganizationRepository } from "../../organization/repository";
import { AuthRepository } from "../../auth/repository";
import { OnboardingStatus, Prisma, UserRole } from "@prisma/client";
import { NotificationService } from "../../notification/service";
import { NotificationTypeIds } from "../../notification/registry";
import { prisma } from "../../../lib/prisma";
import { mapRegtankIndividualLivenessRawToInternalStatus } from "@cashsouk/types";
import { findCtosPartySupplementByOnboardingJsonMatch } from "../../organization/ctos-party-supplement-webhook-lookup";
import { updateCtosSupplementNormalizedStatus } from "../helpers/update-ctos-normalized-status";

/**
 * Individual Onboarding Webhook Handler
 * Handles webhooks from /liveness endpoint
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.6-individual-onboarding-notification-definition
 */
export class IndividualOnboardingWebhookHandler extends BaseWebhookHandler {
  private service: RegTankService;
  private repository: RegTankRepository;
  private organizationRepository: OrganizationRepository;
  private authRepository: AuthRepository;
  private notificationService: NotificationService;

  constructor() {
    super();
    this.service = new RegTankService();
    this.repository = new RegTankRepository();
    this.organizationRepository = new OrganizationRepository();
    this.authRepository = new AuthRepository();
    this.notificationService = new NotificationService();
  }

  protected getWebhookType(): string {
    return "Individual Onboarding";
  }

  protected async handle(payload: RegTankIndividualOnboardingWebhook): Promise<void> {
    const { requestId, status } = payload;
    if (typeof status !== "string" || !status) {
      logger.warn(
        { requestId },
        "[Individual Webhook] Missing status in webhook payload, skipping persistence safely"
      );
      return;
    }

    // Find onboarding record
    const onboarding = await this.repository.findByRequestId(requestId);
    if (!onboarding) {
      const payloadRefRaw = (payload as Record<string, unknown>).referenceId;
      const payloadRef = typeof payloadRefRaw === "string" ? payloadRefRaw.trim() : "";
      const handledCtos = await this.tryUpdateCtosPartyOnboardingFromWebhook(requestId, status, payloadRef);
      if (handledCtos) {
        return;
      }
      logger.warn({ requestId }, "Webhook requestId not found in any flow");
      return;
    }

    // Append to history
    await this.repository.appendWebhookPayload(requestId, payload as Prisma.InputJsonValue);

    // Status transition logic for regtank_onboarding table:
    // IN_PROGRESS → PENDING_APPROVAL → PENDING_AML → COMPLETED/APPROVED
    // Note: Final approval is done on our side, not in RegTank
    const statusUpper = status.toUpperCase();
    const internalStatus = mapRegtankIndividualLivenessRawToInternalStatus(status);

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
              OnboardingStatus.PENDING_APPROVAL,
              { resetCompanySsmGateFromRegtankWebhook: true }
            );

            // Create onboarding log - FORM_FILLED when form is completed
            try {
              await this.authRepository.createOnboardingLog({
                userId: onboarding.user_id,
                role: UserRole.INVESTOR,
                eventType: "FORM_FILLED",
                portal: portalType,
                organizationName: orgExists.name || undefined,
                investorOrganizationId: organizationId,
                issuerOrganizationId: undefined,
                metadata: {
                  organizationId,
                  requestId,
                  previousStatus,
                  newStatus: OnboardingStatus.PENDING_APPROVAL,
                  trigger: "LIVENESS_PASSED",
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId,
                  requestId,
                },
                "Failed to create onboarding log (non-blocking)"
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
              OnboardingStatus.PENDING_APPROVAL,
              { resetCompanySsmGateFromRegtankWebhook: true }
            );

            // Create onboarding status updated log
            try {
              await this.authRepository.createOnboardingLog({
                userId: onboarding.user_id,
                role: UserRole.ISSUER,
                eventType: "ONBOARDING_STATUS_UPDATED",
                portal: portalType,
                organizationName: orgExists.name || undefined,
                investorOrganizationId: undefined,
                issuerOrganizationId: organizationId,
                metadata: {
                  organizationId,
                  requestId,
                  previousStatus,
                  newStatus: OnboardingStatus.PENDING_APPROVAL,
                  trigger: "LIVENESS_PASSED",
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId,
                  requestId,
                },
                "Failed to create onboarding status updated log (non-blocking)"
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
              OnboardingStatus.PENDING_APPROVAL,
              { resetCompanySsmGateFromRegtankWebhook: true }
            );

            // Create onboarding status updated log
            try {
              await this.authRepository.createOnboardingLog({
                userId: onboarding.user_id,
                role: UserRole.INVESTOR,
                eventType: "ONBOARDING_STATUS_UPDATED",
                portal: portalType,
                organizationName: orgExists.name || undefined,
                investorOrganizationId: organizationId,
                issuerOrganizationId: undefined,
                metadata: {
                  organizationId,
                  requestId,
                  previousStatus,
                  newStatus: OnboardingStatus.PENDING_APPROVAL,
                  trigger: "WAIT_FOR_APPROVAL",
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId,
                  requestId,
                },
                "Failed to create onboarding status updated log (non-blocking)"
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
              OnboardingStatus.PENDING_APPROVAL,
              { resetCompanySsmGateFromRegtankWebhook: true }
            );

            // Create onboarding status updated log
            try {
              await this.authRepository.createOnboardingLog({
                userId: onboarding.user_id,
                role: UserRole.ISSUER,
                eventType: "ONBOARDING_STATUS_UPDATED",
                portal: portalType,
                organizationName: orgExists.name || undefined,
                investorOrganizationId: undefined,
                issuerOrganizationId: organizationId,
                metadata: {
                  organizationId,
                  requestId,
                  previousStatus,
                  newStatus: OnboardingStatus.PENDING_APPROVAL,
                  trigger: "WAIT_FOR_APPROVAL",
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId,
                  requestId,
                },
                "Failed to create onboarding status updated log (non-blocking)"
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
              await this.authRepository.createOnboardingLog({
                userId: onboarding.user_id,
                role: UserRole.INVESTOR,
                eventType: "ONBOARDING_REJECTED",
                portal: portalType,
                organizationName: orgExists.name || undefined,
                investorOrganizationId: organizationId,
                issuerOrganizationId: undefined,
                metadata: {
                  organizationId,
                  requestId,
                  previousStatus,
                  newStatus: OnboardingStatus.REJECTED,
                  trigger: "REGTANK_REJECTION",
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

            // Send platform notification
            try {
              await this.notificationService.sendTyped(onboarding.user_id, NotificationTypeIds.ONBOARDING_REJECTED, {
                onboardingType: onboarding.onboarding_type,
                orgName: orgExists.name || "your organization",
              });
            } catch (notifError) {
              logger.error({ error: notifError, userId: onboarding.user_id }, "Failed to send rejection notification");
            }
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
              await this.authRepository.createOnboardingLog({
                userId: onboarding.user_id,
                role: UserRole.ISSUER,
                eventType: "ONBOARDING_REJECTED",
                portal: portalType,
                organizationName: orgExists.name || undefined,
                investorOrganizationId: undefined,
                issuerOrganizationId: organizationId,
                metadata: {
                  organizationId,
                  requestId,
                  previousStatus,
                  newStatus: OnboardingStatus.REJECTED,
                  trigger: "REGTANK_REJECTION",
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

            // Send platform notification
            try {
              await this.notificationService.sendTyped(onboarding.user_id, NotificationTypeIds.ONBOARDING_REJECTED, {
                onboardingType: onboarding.onboarding_type,
                orgName: orgExists.name || "your organization",
              });
            } catch (notifError) {
              logger.error({ error: notifError, userId: onboarding.user_id }, "Failed to send rejection notification");
            }
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

  /**
   * Issuer CTOS party RegTank individual onboarding: row lives on ctos_party_supplements.onboarding_json only.
   * Normal org onboarding still uses reg_tank_onboarding (handled above).
   */
  private async tryUpdateCtosPartyOnboardingFromWebhook(
    requestId: string,
    status: string,
    webhookReferenceId: string
  ): Promise<boolean> {
    const supplement = await findCtosPartySupplementByOnboardingJsonMatch(requestId, webhookReferenceId);

    if (!supplement) {
      return false;
    }

    const statusUpper = status.toUpperCase();

    const prev =
      supplement.onboarding_json &&
      typeof supplement.onboarding_json === "object" &&
      !Array.isArray(supplement.onboarding_json)
        ? { ...(supplement.onboarding_json as Record<string, unknown>) }
        : {};
    const prevRest = { ...prev };
    delete prevRest.status;

    const now = new Date().toISOString();
    const updatedBase = {
      ...prevRest,
      regtankStatus: status,
      updatedAt: now,
    };
    const updated = updateCtosSupplementNormalizedStatus({
      onboardingJson: updatedBase,
      status,
      now,
      identifiers: {
        kycId: requestId,
      },
    });

    await prisma.ctosPartySupplement.update({
      where: { id: supplement.id },
      data: {
        onboarding_json: updated as Prisma.InputJsonValue,
      },
    });

    logger.info(
      {
        requestId,
        status,
        rawRegTankStatus: statusUpper,
        partyKey: supplement.party_key,
        issuerOrganizationId: supplement.issuer_organization_id,
        investorOrganizationId: supplement.investor_organization_id,
      },
      "CTOS onboarding webhook handled"
    );

    return true;
  }
}

