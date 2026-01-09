import { BaseWebhookHandler } from "./base-webhook-handler";
import { RegTankEODWebhook } from "../types";
import { logger } from "../../../lib/logger";
import { RegTankRepository } from "../repository";
import { AuthRepository } from "../../auth/repository";
import { UserRole } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import type { PortalType } from "../types";
import { OrganizationRepository } from "../../organization/repository";

/**
 * EOD (Entity Onboarding Data) Webhook Handler
 * Handles webhooks from /eodliveness endpoint
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.8-business-onboarding-notification-definition-eod
 */
export class EODWebhookHandler extends BaseWebhookHandler {
  private repository: RegTankRepository;
  private authRepository: AuthRepository;
  private organizationRepository: OrganizationRepository;

  constructor() {
    super();
    this.repository = new RegTankRepository();
    this.authRepository = new AuthRepository();
    this.organizationRepository = new OrganizationRepository();
  }

  protected getWebhookType(): string {
    return "EOD (Entity Onboarding Data)";
  }

  protected async handle(payload: RegTankEODWebhook): Promise<void> {
    const { requestId: eodRequestId, status, confidence, kycId } = payload;

    // EOD requestId is for individual entities (directors/shareholders), not the company
    // The main onboarding record stores COD requestId, not EOD requestId
    // We need to find the parent COD onboarding record by searching for COD webhooks that contain this EOD requestId
    // The EOD requestId appears in COD webhook payload's corpIndvDirectors, corpIndvShareholders, or corpBizShareholders arrays
    
    // Find the parent COD onboarding record by searching through all corporate onboarding records
    // and checking if their COD webhook payloads contain this EOD requestId
    let onboarding = null;
    
    // Query all corporate onboarding records
    const allCorporateOnboardings = await prisma.regTankOnboarding.findMany({
      where: {
        onboarding_type: "CORPORATE",
      },
      include: {
        user: {
          select: {
            user_id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        investor_organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        issuer_organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });
    
    for (const corporateOnboarding of allCorporateOnboardings) {
      // Check webhook payloads for COD webhook that contains this EOD requestId
      if (corporateOnboarding.webhook_payloads && Array.isArray(corporateOnboarding.webhook_payloads)) {
        for (const webhookPayload of corporateOnboarding.webhook_payloads) {
          if (webhookPayload && typeof webhookPayload === "object" && !Array.isArray(webhookPayload)) {
            const payloadObj = webhookPayload as Record<string, unknown>;
            // Check if this is a COD webhook (has corpIndvDirectors, corpIndvShareholders, or corpBizShareholders)
            const corpIndvDirectors = payloadObj.corpIndvDirectors as string[] | undefined;
            const corpIndvShareholders = payloadObj.corpIndvShareholders as string[] | undefined;
            const corpBizShareholders = payloadObj.corpBizShareholders as string[] | undefined;
            
            if (
              (corpIndvDirectors && Array.isArray(corpIndvDirectors) && corpIndvDirectors.includes(eodRequestId)) ||
              (corpIndvShareholders && Array.isArray(corpIndvShareholders) && corpIndvShareholders.includes(eodRequestId)) ||
              (corpBizShareholders && Array.isArray(corpBizShareholders) && corpBizShareholders.includes(eodRequestId))
            ) {
              onboarding = corporateOnboarding;
              logger.info(
                {
                  eodRequestId,
                  codRequestId: corporateOnboarding.request_id,
                  organizationId: corporateOnboarding.investor_organization_id || corporateOnboarding.issuer_organization_id,
                },
                "[EOD Webhook] Found parent COD onboarding record by searching COD webhook payloads"
              );
              break;
            }
          }
        }
        if (onboarding) break;
      }
    }

    if (!onboarding) {
      logger.warn(
        { eodRequestId },
        "[EOD Webhook] EOD webhook received but parent COD onboarding record not found. EOD requestId may not be linked to any COD record yet (COD webhook may not have arrived with the EOD requestId in its arrays)."
      );
      // Don't throw error - EOD webhooks may arrive before COD webhook that links them
      // We'll log the webhook but can't process it without the parent record
      return;
    }

    // Append to history using the COD requestId (the parent onboarding record's request_id)
    // This ensures EOD webhooks are stored with the correct COD onboarding record
    await this.repository.appendWebhookPayload(onboarding.request_id, payload as Prisma.InputJsonValue);

    // Note: We don't update the COD onboarding record status with EOD status
    // EOD status represents individual entities (directors/shareholders), not the company
    // The COD onboarding record status is updated by COD webhooks, not EOD webhooks
    // We only store the EOD webhook payload in the COD onboarding record's webhook_payloads array

    const statusUpper = status.toUpperCase();

    logger.info(
      {
        eodRequestId,
        codRequestId: onboarding.request_id,
        status: statusUpper,
        confidence,
        kycId,
        organizationId: onboarding.investor_organization_id || onboarding.issuer_organization_id,
      },
      "[EOD Webhook] EOD webhook processed and appended to parent COD onboarding record"
    );

    // Create onboarding log entry for EOD webhook
    const organizationId = onboarding.investor_organization_id || onboarding.issuer_organization_id;
    const portalType = onboarding.portal_type as PortalType;
    const role = portalType === "investor" ? UserRole.INVESTOR : UserRole.ISSUER;

    try {
      const eventType = statusUpper === "APPROVED" ? "EOD_APPROVED" : statusUpper === "REJECTED" ? "EOD_REJECTED" : "EOD_WEBHOOK";
      
      await this.authRepository.createOnboardingLog({
        userId: onboarding.user_id,
        role,
        eventType,
        portal: portalType,
        metadata: {
          eodRequestId,
          codRequestId: onboarding.request_id,
          status: statusUpper,
          confidence,
          kycId,
          organizationId: organizationId || null,
          onboardingType: onboarding.onboarding_type,
        },
      });

      logger.debug(
        {
          eodRequestId,
          codRequestId: onboarding.request_id,
          userId: onboarding.user_id,
          role,
          eventType,
          portalType,
        },
        "[EOD Webhook] Created EOD onboarding log entry"
      );
    } catch (logError) {
      // Log error but don't fail the webhook processing
      logger.error(
        {
          error: logError instanceof Error ? logError.message : String(logError),
          eodRequestId,
          codRequestId: onboarding.request_id,
          userId: onboarding.user_id,
        },
        "[EOD Webhook] Failed to create EOD onboarding log entry (non-blocking)"
      );
    }

    // Update director KYC status in parent organization's director_kyc_status JSON field
    if (organizationId) {
      try {
        const portalType = onboarding.portal_type as PortalType;
        
        // Map EOD status to KYC status
        let kycStatus = "PENDING";
        if (statusUpper === "LIVENESS_STARTED") {
          kycStatus = "LIVENESS_STARTED";
        } else if (statusUpper === "WAIT_FOR_APPROVAL") {
          kycStatus = "WAIT_FOR_APPROVAL";
        } else if (statusUpper === "APPROVED") {
          kycStatus = "APPROVED";
        } else if (statusUpper === "REJECTED") {
          kycStatus = "REJECTED";
        }

        if (portalType === "investor") {
          const org = await this.organizationRepository.findInvestorOrganizationById(organizationId);
          if (org && org.director_kyc_status) {
            const directorKycStatus = org.director_kyc_status as {
              directors: Array<{
                eodRequestId: string;
                name: string;
                email: string;
                role: string;
                kycStatus: string;
                kycId?: string;
                lastUpdated: string;
              }>;
              [key: string]: unknown;
            };

            // Find and update the matching director
            const updatedDirectors = directorKycStatus.directors.map((director) => {
              if (director.eodRequestId === eodRequestId) {
                return {
                  ...director,
                  kycStatus,
                  kycId: kycId || director.kycId,
                  lastUpdated: new Date().toISOString(),
                };
              }
              return director;
            });

            // Update organization with new director statuses
            await prisma.investorOrganization.update({
              where: { id: organizationId },
              data: {
                director_kyc_status: {
                  ...directorKycStatus,
                  directors: updatedDirectors,
                  lastSyncedAt: new Date().toISOString(),
                } as Prisma.InputJsonValue,
              },
            });

            logger.info(
              {
                eodRequestId,
                codRequestId: onboarding.request_id,
                organizationId,
                kycStatus,
                kycId,
              },
              "[EOD Webhook] Updated director KYC status in investor organization"
            );
          }
        } else {
          const org = await this.organizationRepository.findIssuerOrganizationById(organizationId);
          if (org && org.director_kyc_status) {
            const directorKycStatus = org.director_kyc_status as {
              directors: Array<{
                eodRequestId: string;
                name: string;
                email: string;
                role: string;
                kycStatus: string;
                kycId?: string;
                lastUpdated: string;
              }>;
              [key: string]: unknown;
            };

            // Find and update the matching director
            const updatedDirectors = directorKycStatus.directors.map((director) => {
              if (director.eodRequestId === eodRequestId) {
                return {
                  ...director,
                  kycStatus,
                  kycId: kycId || director.kycId,
                  lastUpdated: new Date().toISOString(),
                };
              }
              return director;
            });

            // Update organization with new director statuses
            await prisma.issuerOrganization.update({
              where: { id: organizationId },
              data: {
                director_kyc_status: {
                  ...directorKycStatus,
                  directors: updatedDirectors,
                  lastSyncedAt: new Date().toISOString(),
                } as Prisma.InputJsonValue,
              },
            });

            logger.info(
              {
                eodRequestId,
                codRequestId: onboarding.request_id,
                organizationId,
                kycStatus,
                kycId,
              },
              "[EOD Webhook] Updated director KYC status in issuer organization"
            );
          }
        }
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            eodRequestId,
            codRequestId: onboarding.request_id,
            organizationId,
          },
          "[EOD Webhook] Failed to update director KYC status (non-blocking)"
        );
        // Don't throw - allow webhook to complete even if director status update fails
      }
    }

    // Note: EOD represents individual directors/shareholders, not the company itself
    // Organization status is updated via COD webhook, not EOD webhook
  }
}

