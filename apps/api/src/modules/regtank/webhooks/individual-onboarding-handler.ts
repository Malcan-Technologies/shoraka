import { BaseWebhookHandler } from "./base-webhook-handler";
import { RegTankService } from "../service";
import { RegTankIndividualOnboardingWebhook, PortalType } from "../types";
import { logger } from "../../../lib/logger";
import { RegTankRepository, RegTankOnboardingWithRelations } from "../repository";
import { OrganizationRepository } from "../../organization/repository";
import { OnboardingStatus, Prisma } from "@prisma/client";
import { NotificationService } from "../../notification/service";
import { NotificationTypeIds } from "../../notification/registry";
import { prisma } from "../../../lib/prisma";
import {
  mergeCtosPartySupplementDocument,
  normalizeRawStatus,
} from "@cashsouk/types";
import { findCtosPartySupplementByOnboardingJsonMatch } from "../../organization/ctos-party-supplement-webhook-lookup";
import { getIndividualWaitForApprovalUpdate } from "../helpers/individual-onboarding-transition";
import {
  claimLandPendingApproval,
  claimOnboardingRejected,
} from "../../onboarding/utils/onboarding-transition-claims";
import {
  isCancelledOnboardingRow,
  logCancelledOnboardingSkip,
  isIndividualWebhookFamilyMatch,
  logWebhookFamilyTypeMismatch,
} from "./onboarding-webhook-guards";
import { writeOnboardingAuditLog } from "../../onboarding/audit/writer";
import { ONBOARDING_AUDIT_TARGET_TYPE } from "../../onboarding/audit/events";
import {
  AUDIT_PORTAL,
  auditPortalFromLegacy,
  organizationKindFromPortalType,
  webhookAuditContext,
} from "../../../lib/audit/context";

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

    // If rejected, claim REJECTED once (does not overwrite COMPLETED).
    if (statusUpper === "REJECTED" && organizationId) {
      const portalType = onboarding.portal_type as PortalType;

      try {
        const isInvestor = portalType === "investor";
        const orgExists = isInvestor
          ? await this.organizationRepository.findInvestorOrganizationById(organizationId)
          : await this.organizationRepository.findIssuerOrganizationById(organizationId);

        if (orgExists) {
          const previousStatus = orgExists.onboarding_status;
          const claimed = await prisma.$transaction(async (tx) => {
            const won = await claimOnboardingRejected({
              organizationId,
              portalType,
              db: tx,
            });
            if (!won) return false;
            await writeOnboardingAuditLog(
              {
                eventType: "ONBOARDING_REJECTED",
                context: webhookAuditContext({
                  portal: isInvestor ? AUDIT_PORTAL.INVESTOR : AUDIT_PORTAL.ISSUER,
                }),
                subjectUserId: onboarding.user_id,
                onboardingId: onboarding.id,
                organizationId,
                organizationKind: isInvestor ? "INVESTOR" : "ISSUER",
                organizationType: orgExists.type,
                targetType: ONBOARDING_AUDIT_TARGET_TYPE.ORGANIZATION,
                targetId: organizationId,
                metadata: {
                  previousStatus,
                  newStatus: OnboardingStatus.REJECTED,
                  provider: "REGTANK",
                  sourceFamily: "INDIVIDUAL",
                },
              },
              tx
            );
            return true;
          });

          logger.info(
            { organizationId, portalType, requestId, previousStatus, claimed },
            claimed
              ? "Updated organization status to REJECTED and logged rejection event"
              : "Skipped REJECTED org mutation (already REJECTED or COMPLETED)"
          );

          if (claimed) {
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
    failureLogMessage: string;
  }): Promise<void> {
    const { organizationId, portalType, onboarding, requestId, trigger, failureLogMessage } = params;

    try {
      const isInvestor = portalType === "investor";
      const orgExists = isInvestor
        ? await this.organizationRepository.findInvestorOrganizationById(organizationId)
        : await this.organizationRepository.findIssuerOrganizationById(organizationId);

      if (!orgExists) return;

      const previousStatus = orgExists.onboarding_status;
      const update = getIndividualWaitForApprovalUpdate({ currentOnboardingStatus: previousStatus });

      if (update) {
        const claimed = await prisma.$transaction(async (tx) => {
          const won = await claimLandPendingApproval({
            organizationId,
            portalType,
            resetCompanySsmGate: true,
            db: tx,
          });
          if (!won) return false;
          await writeOnboardingAuditLog(
            {
              eventType: "ONBOARDING_STATUS_CHANGED",
              context: webhookAuditContext({
                portal: auditPortalFromLegacy(portalType),
              }),
              subjectUserId: onboarding.user_id,
              onboardingId: onboarding.id,
              organizationId,
              organizationKind: organizationKindFromPortalType(portalType),
              organizationType: orgExists.type,
              targetType: ONBOARDING_AUDIT_TARGET_TYPE.ORGANIZATION,
              targetId: organizationId,
              metadata: {
                previousStatus,
                newStatus: OnboardingStatus.PENDING_APPROVAL,
                trigger,
              },
            },
            tx
          );
          return true;
        });

        logger.info(
          {
            organizationId,
            portalType,
            requestId,
            previousStatus,
            resultingOnboardingStatus: claimed ? OnboardingStatus.PENDING_APPROVAL : previousStatus,
            statusUpdateApplied: claimed,
          },
          claimed
            ? `Updated ${portalType} organization status to PENDING_APPROVAL (${trigger})`
            : `Skipped ${trigger} status update — landing already claimed or org already past pre-review`
        );
      } else {
        logger.info(
          {
            organizationId,
            portalType,
            requestId,
            previousStatus,
            resultingOnboardingStatus: previousStatus,
            statusUpdateApplied: false,
          },
          `Skipped ${trigger} status update — organization already at PENDING_APPROVAL or past review`
        );
      }
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

