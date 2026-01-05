import { BaseWebhookHandler } from "./base-webhook-handler";
import { RegTankKYCWebhook } from "../types";
import { logger } from "../../../lib/logger";
import { RegTankRepository } from "../repository";
import { Prisma } from "@prisma/client";
import { OrganizationRepository } from "../../organization/repository";
import { OnboardingStatus, UserRole } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

/**
 * KYC (Know Your Customer) Webhook Handler
 * Handles webhooks from /kyc and /djkyc endpoints
 * References:
 * - https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.1-kyc-notification-definition
 * - https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.2-djkyc-notification-definition
 */
export class KYCWebhookHandler extends BaseWebhookHandler {
  private repository: RegTankRepository;
  private organizationRepository: OrganizationRepository;
  private provider: "ACURIS" | "DOWJONES";

  constructor(provider: "ACURIS" | "DOWJONES" = "ACURIS") {
    super();
    this.repository = new RegTankRepository();
    this.organizationRepository = new OrganizationRepository();
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
        kycRequestId: requestId,
        referenceId,
        onboardingId,
        riskScore,
        riskLevel,
        status,
        messageStatus,
        possibleMatchCount,
        blacklistedMatchCount,
        provider: this.provider,
      },
      "[KYC Webhook] Processing KYC webhook - kycRequestId is the KYC ID, onboardingId is the onboarding request ID"
    );

    // Find onboarding record
    // Priority order:
    // 1. onboardingId (if provided) - this is the onboarding request ID:
    //    - For individual onboarding: Individual Onboarding unique ID (e.g., "LD71656-R30")
    //    - For corporate onboarding: COD requestId (e.g., "COD01860") or EOD requestId (e.g., "EOD02188")
    // 2. referenceId (if available) - our internal reference ID
    // Note: requestId is the KYC/DJKYC ID (e.g., "KYC06407" or "DJKYC08238"), NOT the onboarding request ID, so we don't use it directly
    let onboarding;
    let foundBy = "";
    
    if (onboardingId) {
      logger.debug(
        { onboardingId, kycRequestId: requestId },
        "[KYC Webhook] Attempting to find onboarding record by onboardingId"
      );
      onboarding = await this.repository.findByRequestId(onboardingId);
      if (onboarding) {
        foundBy = "onboardingId";
        logger.info(
          { 
            onboardingId, 
            kycRequestId: requestId,
            onboardingRequestId: onboarding.request_id,
            foundBy 
          },
          "[KYC Webhook] ✓ Found onboarding record by onboardingId"
        );
      } else {
        logger.debug(
          { onboardingId, kycRequestId: requestId },
          "[KYC Webhook] No onboarding record found by onboardingId"
        );
      }
    }
    
    if (!onboarding && referenceId) {
      logger.debug(
        { referenceId, kycRequestId: requestId },
        "[KYC Webhook] Attempting to find onboarding record by referenceId"
      );
      onboarding = await this.repository.findByReferenceId(referenceId);
      if (onboarding) {
        foundBy = "referenceId";
        logger.info(
          { 
            referenceId, 
            kycRequestId: requestId,
            onboardingRequestId: onboarding.request_id,
            foundBy 
          },
          "[KYC Webhook] ✓ Found onboarding record by referenceId"
        );
      } else {
        logger.debug(
          { referenceId, kycRequestId: requestId },
          "[KYC Webhook] No onboarding record found by referenceId"
        );
      }
    }

    if (!onboarding) {
      logger.warn(
        { 
          kycRequestId: requestId, 
          referenceId, 
          onboardingId,
          note: "KYC requestId is the KYC ID, not the onboarding request ID. Use onboardingId field instead."
        },
        "[KYC Webhook] ⚠ No matching onboarding record found - KYC webhook may be standalone or onboardingId/referenceId missing"
      );
      // Don't throw error - KYC webhooks may not always have associated onboarding records
      // They might be standalone KYC checks
      return;
    }

    // Append to history using the onboarding request_id (not the KYC requestId)
    logger.debug(
      {
        kycRequestId: requestId,
        onboardingRequestId: onboarding.request_id,
        foundBy,
      },
      "[KYC Webhook] Appending webhook payload to onboarding record history"
    );
    
    await this.repository.appendWebhookPayload(
      onboarding.request_id,
      payload as Prisma.InputJsonValue
    );

    logger.info(
      {
        kycRequestId: requestId,
        onboardingRequestId: onboarding.request_id,
        referenceId,
        onboardingId,
        status,
        riskLevel,
        riskScore,
        foundBy,
        organizationId: onboarding.investor_organization_id || onboarding.issuer_organization_id,
        portalType: onboarding.portal_type,
      },
      "[KYC Webhook] ✓ Successfully processed and linked to onboarding record"
    );

    // Handle KYC approval - update regtank_onboarding status and organization aml_approved flag
    const statusUpper = status?.toUpperCase();
    const organizationId = onboarding.investor_organization_id || onboarding.issuer_organization_id;
    const portalType = onboarding.portal_type;

    if (statusUpper === "APPROVED" && organizationId) {
      try {
        logger.info(
          {
            kycRequestId: requestId,
            onboardingRequestId: onboarding.request_id,
            organizationId,
            portalType,
            riskLevel,
            riskScore,
          },
          "[KYC Webhook] Processing KYC approval - updating regtank_onboarding status and organization aml_approved flag"
        );

        // Update regtank_onboarding.status to APPROVED
        await this.repository.updateStatus(onboarding.request_id, {
          status: "APPROVED",
        });

        logger.info(
          {
            kycRequestId: requestId,
            onboardingRequestId: onboarding.request_id,
            previousRegTankStatus: onboarding.status,
            newRegTankStatus: "APPROVED",
          },
          "[KYC Webhook] ✓ Updated regtank_onboarding.status to APPROVED"
        );

        if (portalType === "investor" && onboarding.investor_organization_id) {
          const org = await this.organizationRepository.findInvestorOrganizationById(
            onboarding.investor_organization_id
          );
          if (org) {
            const previousStatus = org.onboarding_status;
            // For corporate onboarding, KYC approval should set status to PENDING_AML (not PENDING_FINAL_APPROVAL)
            // For personal onboarding, KYC approval sets status to PENDING_FINAL_APPROVAL
            const isCorporateOnboarding = onboarding.onboarding_type === "CORPORATE";
            const newStatus = isCorporateOnboarding 
              ? OnboardingStatus.PENDING_AML 
              : OnboardingStatus.PENDING_FINAL_APPROVAL;

            // Update aml_approved flag, status, and store KYC response
            await prisma.investorOrganization.update({
              where: { id: onboarding.investor_organization_id },
              data: { 
                aml_approved: true,
                onboarding_status: newStatus,
                kyc_response: payload as Prisma.InputJsonValue,
              },
            });

            // Create AML approved log (AML/KYC check passed)
            try {
              await prisma.onboardingLog.create({
                data: {
                  user_id: onboarding.user_id,
                  role: UserRole.INVESTOR,
                  event_type: "AML_APPROVED",
                  portal: portalType,
                  metadata: {
                    organizationId: onboarding.investor_organization_id,
                    kycRequestId: requestId,
                    onboardingRequestId: onboarding.request_id,
                    previousStatus,
                    newStatus: newStatus,
                    trigger: "KYC_APPROVED",
                    isCorporateOnboarding,
                  },
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId: onboarding.investor_organization_id,
                  kycRequestId: requestId,
                },
                "Failed to create AML approved log (non-blocking)"
              );
            }

            logger.info(
              {
                kycRequestId: requestId,
                onboardingRequestId: onboarding.request_id,
                organizationId: onboarding.investor_organization_id,
                organizationType: org.type,
                previousStatus: org.onboarding_status,
                newStatus: newStatus,
                amlApproved: true,
                isCorporateOnboarding,
              },
              `[KYC Webhook] ✓ Updated investor organization: aml_approved=true, status=${newStatus}, kyc_response stored`
            );
          }
        } else if (portalType === "issuer" && onboarding.issuer_organization_id) {
          const org = await this.organizationRepository.findIssuerOrganizationById(
            onboarding.issuer_organization_id
          );
          if (org) {
            const previousStatus = org.onboarding_status;
            // For corporate onboarding, KYC approval should set status to PENDING_AML (not PENDING_FINAL_APPROVAL)
            // For personal onboarding, KYC approval sets status to PENDING_FINAL_APPROVAL
            const isCorporateOnboarding = onboarding.onboarding_type === "CORPORATE";
            const newStatus = isCorporateOnboarding 
              ? OnboardingStatus.PENDING_AML 
              : OnboardingStatus.PENDING_FINAL_APPROVAL;

            // Update aml_approved flag, status, and store KYC response
            await prisma.issuerOrganization.update({
              where: { id: onboarding.issuer_organization_id },
              data: { 
                aml_approved: true,
                onboarding_status: newStatus,
                kyc_response: payload as Prisma.InputJsonValue,
              },
            });

            // Create AML approved log (AML/KYC check passed)
            try {
              await prisma.onboardingLog.create({
                data: {
                  user_id: onboarding.user_id,
                  role: UserRole.ISSUER,
                  event_type: "AML_APPROVED",
                  portal: portalType,
                  metadata: {
                    organizationId: onboarding.issuer_organization_id,
                    kycRequestId: requestId,
                    onboardingRequestId: onboarding.request_id,
                    previousStatus,
                    newStatus: newStatus,
                    trigger: "KYC_APPROVED",
                    isCorporateOnboarding,
                  },
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId: onboarding.issuer_organization_id,
                  kycRequestId: requestId,
                },
                "Failed to create AML approved log (non-blocking)"
              );
            }

            logger.info(
              {
                kycRequestId: requestId,
                onboardingRequestId: onboarding.request_id,
                organizationId: onboarding.issuer_organization_id,
                organizationType: org.type,
                previousStatus: org.onboarding_status,
                newStatus: newStatus,
                amlApproved: true,
                isCorporateOnboarding,
              },
              `[KYC Webhook] ✓ Updated issuer organization: aml_approved=true, status=${newStatus}, kyc_response stored`
            );
          }
        }
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            kycRequestId: requestId,
            onboardingRequestId: onboarding.request_id,
            organizationId,
            portalType,
            status: statusUpper,
          },
          "[KYC Webhook] Failed to update organization aml_approved flag"
        );
        // Don't throw - allow webhook to complete even if organization update fails
      }
    } else if (statusUpper && statusUpper !== "APPROVED") {
      logger.debug(
        {
          kycRequestId: requestId,
          onboardingRequestId: onboarding.request_id,
          status: statusUpper,
          note: "KYC status is not APPROVED, skipping organization update",
        },
        "[KYC Webhook] KYC status is not APPROVED, no organization update needed"
      );
    }
  }
}

