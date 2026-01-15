import { BaseWebhookHandler } from "./base-webhook-handler";
import { RegTankKYBWebhook } from "../types";
import { logger } from "../../../lib/logger";
import { RegTankRepository } from "../repository";
import { OrganizationRepository } from "../../organization/repository";
import { AuthRepository } from "../../auth/repository";
import { OnboardingStatus, UserRole } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import type { PortalType } from "../types";

/**
 * KYB (Know Your Business) Webhook Handler
 * Handles webhooks from /kyb and /djkyb endpoints
 * References:
 * - https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.3-kyb-notification-definition
 * - https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.4-djkyb-notification-definition
 */
export class KYBWebhookHandler extends BaseWebhookHandler {
  private repository: RegTankRepository;
  private organizationRepository: OrganizationRepository;
  private authRepository: AuthRepository;
  private provider: "ACURIS" | "DOWJONES";

  constructor(provider: "ACURIS" | "DOWJONES" = "ACURIS") {
    super();
    this.repository = new RegTankRepository();
    this.organizationRepository = new OrganizationRepository();
    this.authRepository = new AuthRepository();
    this.provider = provider;
  }

  protected getWebhookType(): string {
    return `KYB (${this.provider})`;
  }

  protected async handle(payload: RegTankKYBWebhook): Promise<void> {
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
        kybRequestId: requestId,
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
      "[KYB Webhook] Processing KYB webhook - kybRequestId is the KYB ID, onboardingId is the onboarding request ID"
    );

    // Find onboarding record
    // Priority order:
    // 1. onboardingId (if provided) - this is the onboarding request ID:
    //    - For individual onboarding: Individual Onboarding unique ID (e.g., "LD71656-R30")
    //    - For corporate onboarding: COD requestId (e.g., "COD01860" or "COD12345")
    // 2. referenceId (if available) - our internal reference ID
    // Note: requestId is the KYB/DJKYB ID (e.g., "KYB00087" or "DJKYB00012"), NOT the onboarding request ID, so we don't use it directly
    let onboarding;
    let foundBy = "";
    
    if (onboardingId) {
      logger.debug(
        { onboardingId, kybRequestId: requestId },
        "[KYB Webhook] Attempting to find onboarding record by onboardingId"
      );
      onboarding = await this.repository.findByRequestId(onboardingId);
      if (onboarding) {
        foundBy = "onboardingId";
        logger.info(
          { 
            onboardingId, 
            kybRequestId: requestId,
            onboardingRequestId: onboarding.request_id,
            foundBy 
          },
          "[KYB Webhook] ✓ Found onboarding record by onboardingId"
        );
      } else {
        logger.debug(
          { onboardingId, kybRequestId: requestId },
          "[KYB Webhook] No onboarding record found by onboardingId"
        );
      }
    }
    
    if (!onboarding && referenceId) {
      logger.debug(
        { referenceId, kybRequestId: requestId },
        "[KYB Webhook] Attempting to find onboarding record by referenceId"
      );
      onboarding = await this.repository.findByReferenceId(referenceId);
      if (onboarding) {
        foundBy = "referenceId";
        logger.info(
          { 
            referenceId, 
            kybRequestId: requestId,
            onboardingRequestId: onboarding.request_id,
            foundBy 
          },
          "[KYB Webhook] ✓ Found onboarding record by referenceId"
        );
      } else {
        logger.debug(
          { referenceId, kybRequestId: requestId },
          "[KYB Webhook] No onboarding record found by referenceId"
        );
      }
    }

    if (!onboarding) {
      logger.warn(
        { 
          kybRequestId: requestId, 
          referenceId, 
          onboardingId,
          note: "KYB requestId is the KYB ID, not the onboarding request ID. Use onboardingId field instead."
        },
        "[KYB Webhook] ⚠ No matching onboarding record found - KYB webhook may be standalone or onboardingId/referenceId missing"
      );
      // Don't throw error - KYB webhooks may not always have associated onboarding records
      return;
    }

    // Append to history using the onboarding request_id (not the KYB requestId)
    logger.debug(
      {
        kybRequestId: requestId,
        onboardingRequestId: onboarding.request_id,
        foundBy,
      },
      "[KYB Webhook] Appending webhook payload to onboarding record history"
    );
    
    await this.repository.appendWebhookPayload(
      onboarding.request_id,
      payload as Prisma.InputJsonValue
    );

    logger.info(
      {
        kybRequestId: requestId,
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
      "[KYB Webhook] ✓ Successfully processed and linked to onboarding record"
    );

    // Handle KYB approval for corporate onboarding - update organization status to PENDING_SSM_REVIEW
    const statusUpper = status?.toUpperCase();
    const organizationId = onboarding.investor_organization_id || onboarding.issuer_organization_id;
    const portalType = onboarding.portal_type as PortalType;
    const isCorporateOnboarding = onboarding.onboarding_type === "CORPORATE";

    if (statusUpper === "APPROVED" && organizationId && isCorporateOnboarding) {
      try {
        logger.info(
          {
            kybRequestId: requestId,
            onboardingRequestId: onboarding.request_id,
            organizationId,
            portalType,
            riskLevel,
            riskScore,
          },
          "[KYB Webhook] Processing KYB approval for corporate onboarding - updating organization status to PENDING_SSM_REVIEW"
        );

        if (portalType === "investor") {
          const org = await this.organizationRepository.findInvestorOrganizationById(organizationId);
          if (org) {
            const previousStatus = org.onboarding_status;
            // Set aml_approved = true and update status to PENDING_SSM_REVIEW
            await prisma.investorOrganization.update({
              where: { id: organizationId },
              data: {
                onboarding_status: OnboardingStatus.PENDING_SSM_REVIEW,
                aml_approved: true,
              },
            });

            // Create onboarding log
            try {
              const isCorporateOnboarding = onboarding.onboarding_type === "CORPORATE";
              await this.authRepository.createOnboardingLog({
                userId: onboarding.user_id,
                role: UserRole.INVESTOR,
                eventType: isCorporateOnboarding ? "CORPORATE_AML_APPROVED" : "KYB_APPROVED",
                portal: portalType,
                metadata: {
                  organizationId,
                  kybRequestId: requestId,
                  onboardingRequestId: onboarding.request_id,
                  previousStatus,
                  newStatus: OnboardingStatus.PENDING_SSM_REVIEW,
                  trigger: "KYB_APPROVED",
                  riskLevel,
                  riskScore,
                  isCorporateOnboarding,
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId,
                  kybRequestId: requestId,
                },
                "[KYB Webhook] Failed to create KYB_APPROVED log (non-blocking)"
              );
            }

            logger.info(
              {
                kybRequestId: requestId,
                onboardingRequestId: onboarding.request_id,
                organizationId,
                previousStatus,
                newStatus: OnboardingStatus.PENDING_SSM_REVIEW,
              },
              "[KYB Webhook] ✓ Updated investor organization status to PENDING_SSM_REVIEW after KYB approval"
            );
          }
        } else {
          const org = await this.organizationRepository.findIssuerOrganizationById(organizationId);
          if (org) {
            const previousStatus = org.onboarding_status;
            // Set aml_approved = true and update status to PENDING_SSM_REVIEW
            await prisma.issuerOrganization.update({
              where: { id: organizationId },
              data: {
                onboarding_status: OnboardingStatus.PENDING_SSM_REVIEW,
                aml_approved: true,
              },
            });

            // Create onboarding log
            try {
              const isCorporateOnboarding = onboarding.onboarding_type === "CORPORATE";
              await this.authRepository.createOnboardingLog({
                userId: onboarding.user_id,
                role: UserRole.ISSUER,
                eventType: isCorporateOnboarding ? "CORPORATE_AML_APPROVED" : "KYB_APPROVED",
                portal: portalType,
                metadata: {
                  organizationId,
                  kybRequestId: requestId,
                  onboardingRequestId: onboarding.request_id,
                  previousStatus,
                  newStatus: OnboardingStatus.PENDING_SSM_REVIEW,
                  trigger: "KYB_APPROVED",
                  riskLevel,
                  riskScore,
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId,
                  kybRequestId: requestId,
                },
                "[KYB Webhook] Failed to create KYB_APPROVED log (non-blocking)"
              );
            }

            logger.info(
              {
                kybRequestId: requestId,
                onboardingRequestId: onboarding.request_id,
                organizationId,
                previousStatus,
                newStatus: OnboardingStatus.PENDING_SSM_REVIEW,
              },
              "[KYB Webhook] ✓ Updated issuer organization status to PENDING_SSM_REVIEW after KYB approval"
            );
          }
        }
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            organizationId,
            portalType,
            kybRequestId: requestId,
          },
          "[KYB Webhook] Failed to update organization status after KYB approval (non-blocking)"
        );
        // Don't throw - allow webhook to complete even if organization update fails
      }
    } else if (statusUpper === "APPROVED" && organizationId) {
      // For non-corporate onboarding, KYB approval may have different handling
      logger.debug(
        {
          kybRequestId: requestId,
          onboardingRequestId: onboarding.request_id,
          organizationId,
          isCorporateOnboarding,
        },
        "[KYB Webhook] KYB approved but not corporate onboarding - skipping status update"
      );
    }

    // Handle KYB webhook for business shareholders (corporate shareholders)
    // If onboardingId is provided and it's a COD requestId for a business shareholder,
    // or if kybId matches a stored business shareholder kybId, update that business shareholder's KYB AML status
    // Process all statuses, not just APPROVED
    if (onboardingId || requestId) {
      try {
        // Find all corporate onboardings that might contain this business shareholder
        const corporateOnboardings = await prisma.regTankOnboarding.findMany({
          where: {
            OR: [
              { investor_organization_id: { not: null } },
              { issuer_organization_id: { not: null } },
            ],
            onboarding_type: "CORPORATE",
          },
          include: {
            investor_organization: {
              select: {
                id: true,
                corporate_entities: true,
                director_aml_status: true,
                onboarding_status: true,
              },
            },
            issuer_organization: {
              select: {
                id: true,
                corporate_entities: true,
                director_aml_status: true,
                onboarding_status: true,
              },
            },
          },
        });

        for (const corpOnboarding of corporateOnboardings) {
          const orgId = corpOnboarding.investor_organization_id || corpOnboarding.issuer_organization_id;
          const org = corpOnboarding.investor_organization || corpOnboarding.issuer_organization;
          const portalType = corpOnboarding.portal_type as PortalType;

          if (!org || !orgId || !org.corporate_entities) continue;

          const corporateEntities = org.corporate_entities as any;
          if (!corporateEntities.corporateShareholders || !Array.isArray(corporateEntities.corporateShareholders)) {
            continue;
          }

          // Get existing director_aml_status to update businessShareholders array
          let directorAmlStatus = (org.director_aml_status as any) || { 
            directors: [], 
            businessShareholders: [], 
            lastSyncedAt: new Date().toISOString() 
          };
          if (!directorAmlStatus.businessShareholders || !Array.isArray(directorAmlStatus.businessShareholders)) {
            directorAmlStatus.businessShareholders = [];
          }

          // Check if this onboardingId matches any business shareholder's COD requestId
          // OR if the kybId (requestId) matches a stored business shareholder kybId
          let foundShareholder = false;
          for (const shareholder of corporateEntities.corporateShareholders) {
            const codRequestId = (shareholder as any).corporateOnboardingRequest?.requestId || (shareholder as any).requestId || null;
            const storedKybId = (shareholder as any).kybId;
            
            // Match by COD requestId (onboardingId) OR by stored kybId
            // onboardingId from webhook is the COD requestId for the business shareholder
            const matchesByCodRequestId = onboardingId && codRequestId === onboardingId;
            const matchesByKybId = requestId && storedKybId === requestId;
            
            if (matchesByCodRequestId || matchesByKybId) {
              foundShareholder = true;
              
              // This KYB webhook is for this business shareholder
              // Always update the KYB AML status (even if one already exists) to ensure it's current
              const kybStatus = status?.toUpperCase() || "";
              let amlStatus: "Unresolved" | "Approved" | "Rejected" | "Pending" = "Pending";
              
              if (kybStatus === "APPROVED") {
                amlStatus = "Approved";
              } else if (kybStatus === "REJECTED") {
                amlStatus = "Rejected";
              } else if (kybStatus === "UNRESOLVED") {
                amlStatus = "Unresolved";
              } else if (kybStatus === "NO_MATCH") {
                amlStatus = "Pending";
              }

              const amlMessageStatus = (messageStatus || "PENDING") as "DONE" | "PENDING" | "ERROR";
              const amlRiskScore = riskScore ? parseFloat(String(riskScore)) : null;
              const amlRiskLevel = riskLevel || null;

              // Extract share percentage from corporate_entities for reference
              const sharePercentage = (shareholder as any).sharePercentage || 
                (shareholder as any).share_percentage || 
                (shareholder as any).formContent?.displayAreas?.[0]?.content?.find((f: any) => f.fieldName === "% of Shares")?.fieldValue || null;

              // Create business shareholder AML status object
              const businessShareholderAmlStatus = {
                codRequestId: onboardingId || codRequestId,
                kybId: requestId, // KYB requestId is the kybId
                businessName: (shareholder as any).businessName || (shareholder as any).name || "Unknown",
                sharePercentage: sharePercentage ? parseFloat(String(sharePercentage)) : null,
                amlStatus,
                amlMessageStatus,
                amlRiskScore,
                amlRiskLevel,
                lastUpdated: new Date().toISOString(),
              };

              // Update or add to director_aml_status.businessShareholders[]
              const existingBusinessIndex = directorAmlStatus.businessShareholders.findIndex(
                (b: any) => (b.codRequestId === businessShareholderAmlStatus.codRequestId) || (b.kybId === requestId)
              );

              const previousStatus = existingBusinessIndex !== -1 
                ? directorAmlStatus.businessShareholders[existingBusinessIndex].amlStatus 
                : null;

              if (existingBusinessIndex !== -1) {
                // Update existing entry
                directorAmlStatus.businessShareholders[existingBusinessIndex] = businessShareholderAmlStatus;
              } else {
                // Add new entry
                directorAmlStatus.businessShareholders.push(businessShareholderAmlStatus);
              }

              // Still keep kybId in corporate_entities for reference (but not kybAmlStatus)
              (shareholder as any).kybId = requestId;

              // Update lastSyncedAt
              directorAmlStatus.lastSyncedAt = new Date().toISOString();

              // Update the organization with both corporate_entities (for kybId) and director_aml_status (for AML status)
              const updateData: {
                corporate_entities?: Prisma.InputJsonValue;
                director_aml_status?: Prisma.InputJsonValue;
              } = {
                corporate_entities: corporateEntities as Prisma.InputJsonValue,
                director_aml_status: directorAmlStatus as Prisma.InputJsonValue,
              };

              if (portalType === "investor") {
                await prisma.investorOrganization.update({
                  where: { id: orgId },
                  data: updateData,
                });
              } else {
                await prisma.issuerOrganization.update({
                  where: { id: orgId },
                  data: updateData,
                });
              }

              logger.info(
                {
                  kybRequestId: requestId,
                  codRequestId: onboardingId || codRequestId,
                  shareholderName: (shareholder as any).name || (shareholder as any).businessName,
                  organizationId: orgId,
                  amlStatus,
                  previousStatus,
                  matchedBy: matchesByCodRequestId ? "codRequestId" : "kybId",
                },
                "[KYB Webhook] ✓ Updated business shareholder KYB AML status in director_aml_status from KYB webhook"
              );
              break;
            }
          }

          if (foundShareholder) {
            break; // Found and updated, no need to check other onboardings
          }
        }
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            kybRequestId: requestId,
            onboardingId,
          },
          "[KYB Webhook] Failed to update business shareholder KYB AML status (non-blocking)"
        );
        // Don't throw - allow webhook to complete even if business shareholder update fails
      }
    }
  }
}

