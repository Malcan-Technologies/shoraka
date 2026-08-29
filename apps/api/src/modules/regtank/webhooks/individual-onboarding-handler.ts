import { BaseWebhookHandler } from "./base-webhook-handler";
import { RegTankService } from "../service";
import { RegTankIndividualOnboardingWebhook, PortalType } from "../types";
import { logger } from "../../../lib/logger";
import { RegTankRepository, RegTankOnboardingWithRelations } from "../repository";
import { OrganizationRepository } from "../../organization/repository";
import { OnboardingStatus, Prisma, UserRole } from "@prisma/client";
import { NotificationService } from "../../notification/service";
import { NotificationTypeIds } from "../../notification/registry";
import { prisma } from "../../../lib/prisma";
import { createOnboardingLogRow, persistOrganizationUpdateAndOnboardingLogs, webhookAuditContext } from "../../../lib/audit";
import {
  mergeCtosPartySupplementDocument,
  normalizeRawStatus,
} from "@cashsouk/types";
import { findCtosPartySupplementByOnboardingJsonMatch } from "../../organization/ctos-party-supplement-webhook-lookup";
import { getIndividualWaitForApprovalUpdate } from "../helpers/individual-onboarding-transition";
import {
  isCancelledOnboardingRow,
  logCancelledOnboardingSkip,
  isIndividualWebhookFamilyMatch,
  logWebhookFamilyTypeMismatch,
} from "./onboarding-webhook-guards";

const PERSONAL_EXACT_LOOKUP_MAX_ATTEMPTS = 3;
const PERSONAL_EXACT_LOOKUP_DELAY_MS = 75;

/**
 * Individual Onboarding Webhook Handler
 * Handles webhooks from /liveness endpoint
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.6-individual-onboarding-notification-definition
 */
export class IndividualOnboardingWebhookHandler extends BaseWebhookHandler {
  private service: RegTankService;
  private repository: RegTankRepository;
  private organizationRepository: OrganizationRepository;
  private notificationService: NotificationService;

  constructor() {
    super();
    this.service = new RegTankService();
    this.repository = new RegTankRepository();
    this.organizationRepository = new OrganizationRepository();
    this.notificationService = new NotificationService();
  }

  protected getWebhookType(): string {
    return "Individual Onboarding";
  }

  private async findByExactRequestIdWithBoundedRetry(requestId: string) {
    let onboarding = await this.repository.findByRequestId(requestId);
    if (onboarding) return onboarding;

    for (let attempt = 2; attempt <= PERSONAL_EXACT_LOOKUP_MAX_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, PERSONAL_EXACT_LOOKUP_DELAY_MS));
      onboarding = await this.repository.findByRequestId(requestId);
      if (onboarding) {
        logger.info(
          {
            webhookFamily: "liveness",
            requestId,
            attempt,
          },
          "[Individual Webhook] Exact requestId matched after bounded retry"
        );
        return onboarding;
      }
    }

    return null;
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
    const onboarding = await this.findByExactRequestIdWithBoundedRetry(requestId);
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

    // Type-family check runs before persistence: a confirmed mismatch must not be
    // appended to the wrong-type record at all.
    if (!isIndividualWebhookFamilyMatch(onboarding)) {
      logWebhookFamilyTypeMismatch({
        webhookFamily: "liveness",
        webhookRequestId: requestId,
        onboarding,
        expected: "onboarding_type INDIVIDUAL",
      });
      return;
    }

    // Append to history
    await this.repository.appendWebhookPayload(requestId, payload as Prisma.InputJsonValue);

    if (isCancelledOnboardingRow(onboarding)) {
      logCancelledOnboardingSkip({
        webhookFamily: "liveness",
        webhookRequestId: requestId,
        onboarding,
      });
      return;
    }

    const statusUpper = status.toUpperCase();
    const persistedRegtankStatus = normalizeRawStatus(status);

    const updateData: {
      status: string;
      substatus?: string;
      completedAt?: Date;
    } = {
      status: persistedRegtankStatus,
    };

    if (statusUpper === "REJECTED") {
      updateData.completedAt = new Date();
    }

    await this.repository.updateStatus(requestId, updateData);

    // Update organization status based on RegTank status
    const organizationId = onboarding.investor_organization_id || onboarding.issuer_organization_id;
    const portalType = onboarding.portal_type as PortalType;

    // Update organization to PENDING_APPROVAL when liveness test completes.
    // Duplicate/out-of-order deliveries must not regress an organization that has
    // already progressed past review (see individual-onboarding-transition.ts).
    if (statusUpper === "LIVENESS_PASSED" && organizationId) {
      await this.applyWaitForApprovalStyleUpdate({
        organizationId,
        portalType,
        onboarding,
        requestId,
        trigger: "LIVENESS_PASSED",
        eventType: portalType === "investor" ? "FORM_FILLED" : "ONBOARDING_STATUS_UPDATED",
        failureLogMessage: "Failed to update organization status after LIVENESS_PASSED",
      });
    }

    // Update organization to PENDING_APPROVAL when WAIT_FOR_APPROVAL.
    // Duplicate/out-of-order deliveries must not regress an organization that has
    // already progressed past review (see individual-onboarding-transition.ts).
    if (statusUpper === "WAIT_FOR_APPROVAL" && organizationId) {
      await this.applyWaitForApprovalStyleUpdate({
        organizationId,
        portalType,
        onboarding,
        requestId,
        trigger: "WAIT_FOR_APPROVAL",
        eventType: "ONBOARDING_STATUS_UPDATED",
        failureLogMessage: "Failed to update organization status to PENDING_APPROVAL",
      });
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
            await persistOrganizationUpdateAndOnboardingLogs({
              portalType: "investor",
              organizationId,
              data: {
                onboarding_status: OnboardingStatus.REJECTED,
                onboarded_at: null,
              },
              logs: [
                {
                  userId: onboarding.user_id,
                  role: UserRole.INVESTOR,
                  eventType: "ONBOARDING_REJECTED",
                  portal: portalType,
                  organizationName: orgExists.name || undefined,
                  investorOrganizationId: organizationId,
                  issuerOrganizationId: undefined,
                  context: webhookAuditContext(),
                  metadata: {
                    organizationId,
                    requestId,
                    previousStatus,
                    newStatus: OnboardingStatus.REJECTED,
                    trigger: "REGTANK_REJECTION",
                  },
                },
              ],
            });

            logger.info(
              { organizationId, portalType, requestId, previousStatus },
              "Updated investor organization status to REJECTED and logged rejection event"
            );

            // Send platform notification
            try {
              await this.notificationService.sendTypedAndLogSystem(onboarding.user_id, NotificationTypeIds.ONBOARDING_REJECTED, {
                onboardingType: onboarding.onboarding_type,
                orgName: orgExists.name || "your organization",
                portalType: "investor",
              }, `onboarding:${onboarding.id}:rejected`);
            } catch (notifError) {
              logger.error({ error: notifError, userId: onboarding.user_id }, "Failed to send rejection notification");
            }
          }
        } else {
          const orgExists = await this.organizationRepository.findIssuerOrganizationById(organizationId);
          if (orgExists) {
            previousStatus = orgExists.onboarding_status;
            await persistOrganizationUpdateAndOnboardingLogs({
              portalType: "issuer",
              organizationId,
              data: {
                onboarding_status: OnboardingStatus.REJECTED,
                onboarded_at: null,
              },
              logs: [
                {
                  userId: onboarding.user_id,
                  role: UserRole.ISSUER,
                  eventType: "ONBOARDING_REJECTED",
                  portal: portalType,
                  organizationName: orgExists.name || undefined,
                  investorOrganizationId: undefined,
                  issuerOrganizationId: organizationId,
                  context: webhookAuditContext(),
                  metadata: {
                    organizationId,
                    requestId,
                    previousStatus,
                    newStatus: OnboardingStatus.REJECTED,
                    trigger: "REGTANK_REJECTION",
                  },
                },
              ],
            });

            logger.info(
              { organizationId, portalType, requestId, previousStatus },
              "Updated issuer organization status to REJECTED and logged rejection event"
            );

            // Send platform notification
            try {
              await this.notificationService.sendTypedAndLogSystem(onboarding.user_id, NotificationTypeIds.ONBOARDING_REJECTED, {
                onboardingType: onboarding.onboarding_type,
                orgName: orgExists.name || "your organization",
                portalType: "issuer",
              }, `onboarding:${onboarding.id}:rejected`);
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
        throw orgError;
      }
    }
  }

  /**
   * Shared logic for `LIVENESS_PASSED` and `WAIT_FOR_APPROVAL`: land the organization on
   * `PENDING_APPROVAL`, but only while it is still in a pre-review stage. Duplicate or
   * out-of-order deliveries must not regress an organization that has already advanced
   * past review (see `getIndividualWaitForApprovalUpdate`).
   */
  private async applyWaitForApprovalStyleUpdate(params: {
    organizationId: string;
    portalType: PortalType;
    onboarding: RegTankOnboardingWithRelations;
    requestId: string;
    trigger: "LIVENESS_PASSED" | "WAIT_FOR_APPROVAL";
    eventType: string;
    failureLogMessage: string;
  }): Promise<void> {
    const { organizationId, portalType, onboarding, requestId, trigger, eventType, failureLogMessage } = params;

    try {
      const isInvestor = portalType === "investor";
      const orgExists = isInvestor
        ? await this.organizationRepository.findInvestorOrganizationById(organizationId)
        : await this.organizationRepository.findIssuerOrganizationById(organizationId);

      if (!orgExists) return;

      const previousStatus = orgExists.onboarding_status;
      const update = getIndividualWaitForApprovalUpdate({ currentOnboardingStatus: previousStatus });

      await prisma.$transaction(async (tx) => {
        if (update) {
          if (isInvestor) {
            await this.organizationRepository.updateInvestorOrganizationOnboarding(
              organizationId,
              OnboardingStatus.PENDING_APPROVAL,
              { resetCompanySsmGateFromRegtankWebhook: true },
              tx
            );
          } else {
            await this.organizationRepository.updateIssuerOrganizationOnboarding(
              organizationId,
              OnboardingStatus.PENDING_APPROVAL,
              { resetCompanySsmGateFromRegtankWebhook: true },
              tx
            );
          }
        }

        await createOnboardingLogRow(
          {
            userId: onboarding.user_id,
            role: isInvestor ? UserRole.INVESTOR : UserRole.ISSUER,
            eventType,
            portal: portalType,
            organizationName: orgExists.name || undefined,
            investorOrganizationId: isInvestor ? organizationId : undefined,
            issuerOrganizationId: isInvestor ? undefined : organizationId,
            context: webhookAuditContext(),
            metadata: {
              organizationId,
              requestId,
              previousStatus,
              newStatus: update ? OnboardingStatus.PENDING_APPROVAL : previousStatus,
              trigger,
              statusUpdateApplied: Boolean(update),
            },
          },
          tx
        );
      });

      logger.info(
        {
          organizationId,
          portalType,
          requestId,
          previousStatus,
          resultingOnboardingStatus: update ? OnboardingStatus.PENDING_APPROVAL : previousStatus,
          statusUpdateApplied: Boolean(update),
        },
        update
          ? `Updated ${portalType} organization status to PENDING_APPROVAL (${trigger})`
          : `Skipped ${trigger} status update — organization already progressed past review`
      );
    } catch (orgError) {
      logger.error(
        {
          error: orgError instanceof Error ? orgError.message : String(orgError),
          organizationId,
          portalType,
          requestId,
        },
        failureLogMessage
      );
      throw orgError;
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

    const prevRoot = supplement.onboarding_json;
    const mergedBase = mergeCtosPartySupplementDocument(prevRoot, {
      regtankPipelineStatus: normalizeRawStatus(status),
    });

    await prisma.ctosPartySupplement.update({
      where: { id: supplement.id },
      data: {
        onboarding_json: mergedBase as Prisma.InputJsonValue,
      },
    });

    logger.info(
      {
        requestId,
        status,
        rawRegTankStatus: status.toUpperCase(),
        partyKey: supplement.party_key,
        issuerOrganizationId: supplement.issuer_organization_id,
        investorOrganizationId: supplement.investor_organization_id,
      },
      "CTOS onboarding webhook handled"
    );

    return true;
  }
}

