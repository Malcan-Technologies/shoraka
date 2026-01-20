import { BaseWebhookHandler } from "./base-webhook-handler";
import { RegTankKYBWebhook } from "../types";
import { logger } from "../../../lib/logger";
import { RegTankRepository } from "../repository";
import { AmlIdentityRepository } from "../aml-identity-repository";
import { OrganizationRepository } from "../../organization/repository";
import { AuthRepository } from "../../auth/repository";
import { getRegTankAPIClient } from "../api-client";
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
  private amlIdentityRepository: AmlIdentityRepository;
  private apiClient: ReturnType<typeof getRegTankAPIClient>;
  private provider: "ACURIS" | "DOWJONES";

  constructor(provider: "ACURIS" | "DOWJONES" = "ACURIS") {
    super();
    this.repository = new RegTankRepository();
    this.organizationRepository = new OrganizationRepository();
    this.authRepository = new AuthRepository();
    this.amlIdentityRepository = new AmlIdentityRepository();
    this.apiClient = getRegTankAPIClient();
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

    // Determine if onboardingId is the main company's COD
    // If onboarding is found and its request_id matches onboardingId, it's the main company
    const isMainCompanyCod = onboarding && onboarding.request_id === onboardingId && onboardingId?.startsWith("COD");

    if (!onboarding) {
      logger.warn(
        {
          kybRequestId: requestId,
          referenceId,
          onboardingId,
          note: "KYB requestId is the KYB ID, not the onboarding request ID. Use onboardingId field instead. Will attempt to process as business shareholder if onboardingId is a COD."
        },
        "[KYB Webhook] ⚠ No matching onboarding record found - KYB webhook may be for business shareholder or standalone"
      );
      // Don't return early - continue to process as business shareholder if onboardingId is a COD
    } else {
      // Append to history using the onboarding request_id (not the KYB requestId)
      logger.debug(
        {
          kybRequestId: requestId,
          onboardingRequestId: onboarding.request_id,
          foundBy,
          isMainCompanyCod,
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
          isMainCompanyCod,
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
                organizationName: org.name || undefined,
                investorOrganizationId: organizationId,
                issuerOrganizationId: undefined,
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
                organizationName: org.name || undefined,
                investorOrganizationId: undefined,
                issuerOrganizationId: organizationId,
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

      // Update AML identity mapping for main company KYB
      if (isMainCompanyCod && organizationId && onboardingId) {
        try {
          // requestId IS the kybId
          const kybId = requestId;

          // Find organization to get business name
          const org = portalType === "investor"
            ? await this.organizationRepository.findInvestorOrganizationById(organizationId)
            : await this.organizationRepository.findIssuerOrganizationById(organizationId);

          if (org && org.name) {
            // Update or create mapping for main company (though main company doesn't have entity_type in our mapping)
            // Actually, main company KYB is stored at organization level, not in mapping table
            // But we can store it for reference if needed
            logger.debug(
              {
                kybId,
                codRequestId: onboardingId,
                organizationId,
                organizationName: org.name,
              },
              "[KYB Webhook] Main company KYB - not storing in AML identity mapping (stored at organization level)"
            );
          }
        } catch (mappingError) {
          logger.warn(
            {
              error: mappingError instanceof Error ? mappingError.message : String(mappingError),
              kybId: requestId,
              codRequestId: onboardingId,
              organizationId,
            },
            "[KYB Webhook] Failed to update AML identity mapping for main company (non-blocking)"
          );
        }
      }
    }

    // Handle business shareholder KYB webhooks
    // Only process if onboardingId is a COD that's NOT the main company's COD
    // If onboardingId is not found in regTankOnboarding, it might be a business shareholder COD
    if (onboardingId && onboardingId.startsWith("COD")) {
      if (isMainCompanyCod) {
        logger.debug(
          {
            onboardingId,
            kybRequestId: requestId,
            onboardingRequestId: onboarding?.request_id,
            note: "onboardingId is the main company COD, skipping business shareholder search"
          },
          "[KYB Webhook] Skipping business shareholder processing - this is main company KYB"
        );
      } else {
        // onboardingId is a COD but not the main company - process as business shareholder
        // This handles both cases:
        // 1. onboardingId found but doesn't match main company (shouldn't happen, but safe)
        // 2. onboardingId not found in regTankOnboarding (business shareholder COD)
        logger.info(
          {
            onboardingId,
            kybRequestId: requestId,
            isMainCompanyCod: false,
            onboardingFound: !!onboarding,
            note: onboarding ? "onboardingId is a business shareholder COD, processing as business shareholder" : "No onboarding record found, but onboardingId is COD - attempting business shareholder processing"
          },
          "[KYB Webhook] Processing as business shareholder KYB"
        );
        await this.handleBusinessShareholderKYB(payload);
      }
    } else if (!onboarding && !onboardingId && requestId) {
      // No onboardingId but we have kybId - try to find by kybId in corporate_entities
      logger.debug(
        {
          kybRequestId: requestId,
          note: "No onboardingId provided, attempting to find business shareholder by kybId"
        },
        "[KYB Webhook] Attempting to find business shareholder by kybId"
      );
      await this.handleBusinessShareholderKYB(payload);
    }
  }

  /**
   * Handle KYB webhook for business shareholders
   * Search all organizations for matching COD requestId in corporate_entities
   * This handles cases where:
   * 1. onboardingId is a business shareholder COD (not in regTankOnboarding table)
   * 2. kybId (requestId) matches a stored business shareholder kybId
   */
  private async handleBusinessShareholderKYB(payload: RegTankKYBWebhook): Promise<void> {
    const { requestId: kybId, onboardingId, status, riskScore, riskLevel, messageStatus } = payload;

    // If onboardingId is provided, it must be a COD for business shareholders
    // If not provided, we'll search by kybId
    if (onboardingId && !onboardingId.startsWith("COD")) {
      logger.debug(
        { onboardingId, kybId },
        "[KYB Webhook] onboardingId is not a COD - not a business shareholder KYB"
      );
      return;
    }

    logger.info(
      { kybId, onboardingId },
      "[KYB Webhook] Processing business shareholder KYB webhook"
    );

    // Search all organizations for this COD requestId
    // Note: Prisma doesn't support nested JSON queries directly, so we'll search all orgs and filter in code
    const [investorOrgs, issuerOrgs] = await Promise.all([
      prisma.investorOrganization.findMany({
        select: { id: true, corporate_entities: true, director_aml_status: true },
      }),
      prisma.issuerOrganization.findMany({
        select: { id: true, corporate_entities: true, director_aml_status: true },
      }),
    ]);

    // Filter organizations that have this COD requestId in their corporateShareholders
    // OR have this kybId stored in their corporateShareholders
    // Only include orgs that have corporate_entities with corporateShareholders
    const matchingInvestorOrgs = investorOrgs.filter(org => {
      if (!org.corporate_entities) return false;
      const corporateEntities = org.corporate_entities as any;
      const corporateShareholders = corporateEntities?.corporateShareholders || [];

      // Match by COD requestId (onboardingId) OR by kybId
      return corporateShareholders.some((s: any) => {
        const codRequestId = s.corporateOnboardingRequest?.requestId || s.requestId;
        const storedKybId = s.kybId;
        return (onboardingId && codRequestId === onboardingId) || (kybId && storedKybId === kybId);
      });
    });

    const matchingIssuerOrgs = issuerOrgs.filter(org => {
      if (!org.corporate_entities) return false;
      const corporateEntities = org.corporate_entities as any;
      const corporateShareholders = corporateEntities?.corporateShareholders || [];

      // Match by COD requestId (onboardingId) OR by kybId
      return corporateShareholders.some((s: any) => {
        const codRequestId = s.corporateOnboardingRequest?.requestId || s.requestId;
        const storedKybId = s.kybId;
        return (onboardingId && codRequestId === onboardingId) || (kybId && storedKybId === kybId);
      });
    });

    const allOrgs = [
      ...matchingInvestorOrgs.map(org => ({ ...org, portalType: "investor" as const })),
      ...matchingIssuerOrgs.map(org => ({ ...org, portalType: "issuer" as const })),
    ];

    if (allOrgs.length === 0) {
      logger.warn(
        {
          kybId,
          onboardingId,
          note: "No organization found with matching business shareholder COD or kybId. This may be a main company KYB or the business shareholder data hasn't been stored yet."
        },
        "[KYB Webhook] No organization found with matching business shareholder COD or kybId"
      );
      return;
    }

    // Update each organization
    for (const org of allOrgs) {
      try {
        // Fetch updated COD details (only if onboardingId is provided)
        let businessName = "Unknown";
        let sharePercentage: string | null = null;

        if (onboardingId) {
          const codDetails = await this.apiClient.getCorporateOnboardingDetails(onboardingId);

          // Extract business info
          const formContent = codDetails.formContent?.displayAreas?.find(
            (area: any) => area.displayArea === "Basic Information Setting"
          )?.content || [];

          businessName = formContent.find((f: any) => f.fieldName === "Business Name")?.fieldValue || "Unknown";
          sharePercentage = formContent.find((f: any) => f.fieldName === "% of Shares")?.fieldValue || null;
        } else {
          // If no onboardingId, try to extract from existing corporate_entities
          const corporateEntities = org.corporate_entities as any;
          const corporateShareholders = corporateEntities?.corporateShareholders || [];
          const shareholder = corporateShareholders.find((s: any) => {
            const storedKybId = s.kybId;
            return kybId && storedKybId === kybId;
          });

          if (shareholder) {
            businessName = (shareholder as any).businessName || (shareholder as any).name || "Unknown";
            sharePercentage = (shareholder as any).sharePercentage || (shareholder as any).share_percentage || null;
          }
        }

        // Map status
        let amlStatus: "Unresolved" | "Approved" | "Rejected" | "Pending" = "Pending";
        const statusUpper = status?.toUpperCase() || "";
        if (statusUpper === "RISK ASSESSED" || statusUpper === "APPROVED") {
          amlStatus = "Approved";
        } else if (statusUpper === "REJECTED") {
          amlStatus = "Rejected";
        } else if (statusUpper === "UNRESOLVED" || statusUpper === "NO_MATCH") {
          // "No Match" means screening is complete but no match found - treat similar to "Unresolved"
          // Both require admin review/action
          amlStatus = "Unresolved";
        }

        // Update director_aml_status.businessShareholders
        // Preserve existing directors array when updating businessShareholders
        const directorAmlStatus = (org.director_aml_status as any) || {
          directors: [],
          businessShareholders: [],
          lastSyncedAt: new Date().toISOString()
        };
        // Ensure directors array exists (preserve existing data)
        if (!directorAmlStatus.directors || !Array.isArray(directorAmlStatus.directors)) {
          directorAmlStatus.directors = [];
        }
        // Ensure businessShareholders array exists
        if (!directorAmlStatus.businessShareholders || !Array.isArray(directorAmlStatus.businessShareholders)) {
          directorAmlStatus.businessShareholders = [];
        }

        const existingIndex = directorAmlStatus.businessShareholders.findIndex(
          (bs: any) => bs.codRequestId === onboardingId || bs.kybId === kybId
        );

        const updatedShareholder = {
          codRequestId: onboardingId,
          kybId,
          businessName,
          sharePercentage: sharePercentage ? parseFloat(sharePercentage) : null,
          amlStatus,
          amlMessageStatus: messageStatus || "PENDING",
          amlRiskScore: riskScore ? parseFloat(String(riskScore)) : null,
          amlRiskLevel: riskLevel || null,
          lastUpdated: new Date().toISOString(),
        };

        if (existingIndex !== -1) {
          directorAmlStatus.businessShareholders[existingIndex] = updatedShareholder;
        } else {
          directorAmlStatus.businessShareholders.push(updatedShareholder);
        }

        directorAmlStatus.lastSyncedAt = new Date().toISOString();

        // Determine portal type from organization
        const portalType = org.portalType;
        const organizationId = org.id;

        // Update database
        if (portalType === "investor") {
          await prisma.investorOrganization.update({
            where: { id: organizationId },
            data: { director_aml_status: directorAmlStatus as Prisma.InputJsonValue },
          });
        } else {
          await prisma.issuerOrganization.update({
            where: { id: organizationId },
            data: { director_aml_status: directorAmlStatus as Prisma.InputJsonValue },
          });
        }

        // Update AML identity mapping
        try {
          await this.amlIdentityRepository.upsertMapping({
            organization_id: organizationId,
            organization_type: portalType,
            entity_type: "business_shareholder",
            business_name: businessName,
            cod_request_id: onboardingId || null,
            kyb_id: kybId,
          });

          logger.info(
            {
              kybId,
              codRequestId: onboardingId,
              businessName,
              organizationId,
            },
            "[KYB Webhook] Updated AML identity mapping for business shareholder"
          );
        } catch (mappingError) {
          logger.warn(
            {
              error: mappingError instanceof Error ? mappingError.message : String(mappingError),
              kybId,
              codRequestId: onboardingId,
              organizationId,
            },
            "[KYB Webhook] Failed to update AML identity mapping for business shareholder (non-blocking)"
          );
        }

        logger.info(
          { kybId, onboardingId, organizationId, amlStatus },
          "[KYB Webhook] ✓ Updated business shareholder AML status"
        );
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            kybId,
            onboardingId,
            organizationId: org.id,
          },
          "[KYB Webhook] Failed to update business shareholder AML status"
        );
      }
    }
  }
}

