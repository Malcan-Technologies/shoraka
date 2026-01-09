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
import { prisma } from "../../../lib/prisma";
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

    // Status transition logic for corporate onboarding
    // New flow: ONBOARDING_STARTED -> WAIT_FOR_APPROVAL -> PENDING_AML -> AML_APPROVED
    const statusUpper = status.toUpperCase();
    let internalStatus = statusUpper;

    // Map URL_GENERATED to ONBOARDING_STARTED
    if (statusUpper === "URL_GENERATED") {
      internalStatus = "ONBOARDING_STARTED";
    } else if (statusUpper === "WAIT_FOR_APPROVAL") {
      internalStatus = "WAIT_FOR_APPROVAL";
    } else if (statusUpper === "APPROVED") {
      // When COD is approved, check if KYB exists
      // If KYB exists, set to PENDING_AML, otherwise keep as APPROVED (will be updated when KYB webhook arrives)
      if (kybId) {
        internalStatus = "PENDING_AML";
      } else {
        // Keep as APPROVED for now, will transition to PENDING_AML when KYB webhook arrives
        internalStatus = "APPROVED";
      }
    } else if (statusUpper === "REJECTED") {
      internalStatus = "REJECTED";
    }

    // Update database
    const updateData: {
      status: string;
      substatus?: string;
      completedAt?: Date;
    } = {
      status: internalStatus,
    };

    // Set completed_at only for REJECTED or AML_APPROVED
    // Note: APPROVED becomes PENDING_AML, so we don't set completed_at yet
    if (statusUpper === "REJECTED") {
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

    // Handle organization updates
    const organizationId = onboarding.investor_organization_id || onboarding.issuer_organization_id;
    const portalType = onboarding.portal_type as PortalType;

    // When WAIT_FOR_APPROVAL: Extract directors and store in director_kyc_status JSON
    if (statusUpper === "WAIT_FOR_APPROVAL" && organizationId) {
      try {
        // Fetch COD details to get full director information
        logger.info(
          { requestId, organizationId, portalType },
          "Fetching RegTank COD details to extract director information"
        );

        const codDetails = await this.apiClient.getCorporateOnboardingDetails(requestId);
        
        // Extract director information from COD details
        // Use a Map to deduplicate by eodRequestId and merge roles for people who are both directors and shareholders
        const directorsMap = new Map<string, {
          eodRequestId: string;
          name: string;
          email: string;
          role: string;
          kycStatus: string;
          kycId?: string;
          lastUpdated: string;
        }>();

        // Process individual directors
        if (codDetails.corpIndvDirectors && Array.isArray(codDetails.corpIndvDirectors)) {
          for (const director of codDetails.corpIndvDirectors) {
            const eodRequestId = director.corporateIndividualRequest?.requestId || "";
            const userInfo = director.corporateUserRequestInfo;
            const formContent = userInfo?.formContent?.content || [];
            
            // Extract name, email, role from formContent
            const firstName = formContent.find((f: any) => f.fieldName === "First Name")?.fieldValue || "";
            const lastName = formContent.find((f: any) => f.fieldName === "Last Name")?.fieldValue || "";
            const designation = formContent.find((f: any) => f.fieldName === "Designation")?.fieldValue || "";
            const email = formContent.find((f: any) => f.fieldName === "Email Address")?.fieldValue || userInfo?.email || "";
            
            directorsMap.set(eodRequestId, {
              eodRequestId,
              name: `${firstName} ${lastName}`.trim() || userInfo?.fullName || "",
              email,
              role: designation || "Director",
              kycStatus: director.corporateIndividualRequest?.status || "PENDING",
              kycId: director.kycRequestInfo?.kycId,
              lastUpdated: new Date().toISOString(),
            });
          }
        }

        // Process individual shareholders
        // If they already exist as directors, merge the roles; otherwise add as new entry
        if (codDetails.corpIndvShareholders && Array.isArray(codDetails.corpIndvShareholders)) {
          for (const shareholder of codDetails.corpIndvShareholders) {
            const eodRequestId = shareholder.corporateIndividualRequest?.requestId || "";
            const userInfo = shareholder.corporateUserRequestInfo;
            const formContent = userInfo?.formContent?.content || [];
            
            const firstName = formContent.find((f: any) => f.fieldName === "First Name")?.fieldValue || "";
            const lastName = formContent.find((f: any) => f.fieldName === "Last Name")?.fieldValue || "";
            const email = formContent.find((f: any) => f.fieldName === "Email Address")?.fieldValue || userInfo?.email || "";
            const sharePercent = formContent.find((f: any) => f.fieldName === "% of Shares")?.fieldValue || "";
            
            const existingDirector = directorsMap.get(eodRequestId);
            const shareholderRole = `Shareholder${sharePercent ? ` (${sharePercent}%)` : ""}`;
            
            if (existingDirector) {
              // Person is both director and shareholder - merge roles
              existingDirector.role = `${existingDirector.role}, ${shareholderRole}`;
              // Update KYC status if shareholder has a more recent or different status
              const shareholderStatus = shareholder.corporateIndividualRequest?.status || "PENDING";
              if (shareholderStatus !== existingDirector.kycStatus) {
                // Prioritize APPROVED > WAIT_FOR_APPROVAL > LIVENESS_STARTED > PENDING
                const statusPriority = {
                  APPROVED: 4,
                  WAIT_FOR_APPROVAL: 3,
                  LIVENESS_STARTED: 2,
                  PENDING: 1,
                  REJECTED: 0,
                };
                const currentPriority = statusPriority[existingDirector.kycStatus as keyof typeof statusPriority] || 0;
                const newPriority = statusPriority[shareholderStatus as keyof typeof statusPriority] || 0;
                if (newPriority > currentPriority) {
                  existingDirector.kycStatus = shareholderStatus;
                }
              }
              // Update KYC ID if available from shareholder
              if (shareholder.kycRequestInfo?.kycId && !existingDirector.kycId) {
                existingDirector.kycId = shareholder.kycRequestInfo.kycId;
              }
              existingDirector.lastUpdated = new Date().toISOString();
            } else {
              // Person is only a shareholder - add as new entry
              directorsMap.set(eodRequestId, {
                eodRequestId,
                name: `${firstName} ${lastName}`.trim() || userInfo?.fullName || "",
                email,
                role: shareholderRole,
                kycStatus: shareholder.corporateIndividualRequest?.status || "PENDING",
                kycId: shareholder.kycRequestInfo?.kycId,
                lastUpdated: new Date().toISOString(),
              });
            }
          }
        }

        // Convert Map to Array
        const directors = Array.from(directorsMap.values());

        // Store director KYC status in organization
        const directorKycStatus = {
          corpIndvDirectorCount: codDetails.corpIndvDirectorCount || 0,
          corpIndvShareholderCount: codDetails.corpIndvShareholderCount || 0,
          corpBizShareholderCount: codDetails.corpBizShareholderCount || 0,
          directors,
          lastSyncedAt: new Date().toISOString(),
        };

        if (portalType === "investor") {
          const org = await this.organizationRepository.findInvestorOrganizationById(organizationId);
          if (org) {
            const previousStatus = org.onboarding_status;
            await prisma.investorOrganization.update({
              where: { id: organizationId },
              data: {
                onboarding_status: OnboardingStatus.PENDING_APPROVAL,
                onboarding_approved: true,
                director_kyc_status: directorKycStatus as Prisma.InputJsonValue,
              },
            });

            // Create onboarding log
            try {
              await this.authRepository.createOnboardingLog({
                userId: onboarding.user_id,
                role: UserRole.INVESTOR,
                eventType: "CORPORATE_ONBOARDING_APPROVED",
                portal: portalType,
                metadata: {
                  organizationId,
                  requestId,
                  previousStatus,
                  newStatus: OnboardingStatus.PENDING_APPROVAL,
                  directorCount: directors.length,
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId,
                  requestId,
                },
                "Failed to create COD_WAIT_FOR_APPROVAL log (non-blocking)"
              );
            }

            logger.info(
              { organizationId, portalType, requestId, directorCount: directors.length },
              "Updated investor organization: stored director KYC status, set onboarding_approved=true, status=PENDING_APPROVAL"
            );
          }
        } else {
          const org = await this.organizationRepository.findIssuerOrganizationById(organizationId);
          if (org) {
            const previousStatus = org.onboarding_status;
            await prisma.issuerOrganization.update({
              where: { id: organizationId },
              data: {
                onboarding_status: OnboardingStatus.PENDING_APPROVAL,
                onboarding_approved: true,
                director_kyc_status: directorKycStatus as Prisma.InputJsonValue,
              },
            });

            // Create onboarding log
            try {
              await this.authRepository.createOnboardingLog({
                userId: onboarding.user_id,
                role: UserRole.ISSUER,
                eventType: "CORPORATE_ONBOARDING_APPROVED",
                portal: portalType,
                metadata: {
                  organizationId,
                  requestId,
                  previousStatus,
                  newStatus: OnboardingStatus.PENDING_APPROVAL,
                  directorCount: directors.length,
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId,
                  requestId,
                },
                "Failed to create COD_WAIT_FOR_APPROVAL log (non-blocking)"
              );
            }

            logger.info(
              { organizationId, portalType, requestId, directorCount: directors.length },
              "Updated issuer organization: stored director KYC status, set onboarding_approved=true, status=PENDING_APPROVAL"
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
          "Failed to extract director info or update organization (non-blocking)"
        );
        // Don't throw - allow webhook to complete even if organization update fails
      }
    } else if (statusUpper === "APPROVED" && organizationId) {
      try {
        // Fetch COD details from RegTank API
        logger.info(
          { requestId, organizationId, portalType },
          "Fetching RegTank COD details after approval"
        );

        let codDetails = await this.apiClient.getCorporateOnboardingDetails(requestId);
        
        // Extract kybId from COD details (try kybRequestDto.kybId first, then payload kybId)
        let extractedKybId = kybId || null;
        
        // Check if kybId exists in COD details (kybRequestDto structure)
        if (codDetails && typeof codDetails === "object" && !Array.isArray(codDetails)) {
          const codDetailsObj = codDetails as Record<string, unknown>;
          if (codDetailsObj.kybRequestDto && typeof codDetailsObj.kybRequestDto === "object" && !Array.isArray(codDetailsObj.kybRequestDto)) {
            const kybDto = codDetailsObj.kybRequestDto as Record<string, unknown>;
            if (kybDto.kybId && typeof kybDto.kybId === "string") {
              extractedKybId = kybDto.kybId;
              logger.info(
                { requestId, organizationId, extractedKybId },
                "Extracted kybId from COD details kybRequestDto"
              );
            }
          }
        }

        // If kybId is still not found, wait 3 seconds and retry fetching COD details
        if (!extractedKybId) {
          logger.info(
            { requestId, organizationId },
            "kybId not found in initial COD details, waiting 3 seconds before retry"
          );
          
          await new Promise((resolve) => setTimeout(resolve, 3000));
          
          try {
            codDetails = await this.apiClient.getCorporateOnboardingDetails(requestId);
            if (codDetails && typeof codDetails === "object" && !Array.isArray(codDetails)) {
              const codDetailsObj = codDetails as Record<string, unknown>;
              if (codDetailsObj.kybRequestDto && typeof codDetailsObj.kybRequestDto === "object" && !Array.isArray(codDetailsObj.kybRequestDto)) {
                const kybDto = codDetailsObj.kybRequestDto as Record<string, unknown>;
                if (kybDto.kybId && typeof kybDto.kybId === "string") {
                  extractedKybId = kybDto.kybId;
                  logger.info(
                    { requestId, organizationId, extractedKybId },
                    "Extracted kybId from COD details after 3-second delay"
                  );
                }
              }
            }
          } catch (retryError) {
            logger.warn(
              {
                error: retryError instanceof Error ? retryError.message : String(retryError),
                requestId,
                organizationId,
              },
              "Failed to fetch COD details on retry (non-blocking, will fall back to webhook payloads)"
            );
          }
        }

        // If kybId was extracted from COD details, append it to webhook payloads for later retrieval
        if (extractedKybId && !kybId) {
          try {
            // Create a payload object with the extracted kybId for storage in webhook_payloads
            const kybIdPayload = {
              kybId: extractedKybId,
              extractedFrom: "COD_DETAILS",
              extractedAt: new Date().toISOString(),
              requestId: onboarding.request_id,
            };
            // Append to webhook payloads so it can be found when building response
            await this.repository.appendWebhookPayload(requestId, kybIdPayload as Prisma.InputJsonValue);
            logger.info(
              { requestId, organizationId, kybId: extractedKybId },
              "Appended extracted kybId to webhook payloads for later retrieval"
            );
          } catch (appendError) {
            logger.warn(
              {
                error: appendError instanceof Error ? appendError.message : String(appendError),
                requestId,
                organizationId,
                kybId: extractedKybId,
              },
              "Failed to append extracted kybId to webhook payloads (non-blocking)"
            );
          }
        }

        // If still not found, will fall back to webhook payloads extraction in admin service
        const finalKybId = extractedKybId;

        // When COD is APPROVED and KYB exists, update to PENDING_AML
        // Set onboarding_approved = true if not already set
        if (portalType === "investor") {
          const org = await this.organizationRepository.findInvestorOrganizationById(organizationId);
          if (org) {
            const previousStatus = org.onboarding_status;
            await prisma.investorOrganization.update({
              where: { id: organizationId },
              data: {
                onboarding_status: finalKybId ? OnboardingStatus.PENDING_AML : OnboardingStatus.PENDING_APPROVAL,
                onboarding_approved: true,
              },
            });

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
                  newStatus: finalKybId ? OnboardingStatus.PENDING_AML : OnboardingStatus.PENDING_APPROVAL,
                  kybId: finalKybId,
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
              { organizationId, portalType, requestId, kybId: finalKybId, newStatus: finalKybId ? "PENDING_AML" : "PENDING_APPROVAL" },
              "Updated investor organization after COD approval"
            );
          }
        } else {
          const org = await this.organizationRepository.findIssuerOrganizationById(organizationId);
          if (org) {
            const previousStatus = org.onboarding_status;
            await prisma.issuerOrganization.update({
              where: { id: organizationId },
              data: {
                onboarding_status: finalKybId ? OnboardingStatus.PENDING_AML : OnboardingStatus.PENDING_APPROVAL,
                onboarding_approved: true,
              },
            });

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
                  newStatus: finalKybId ? OnboardingStatus.PENDING_AML : OnboardingStatus.PENDING_APPROVAL,
                  kybId: finalKybId,
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
              { organizationId, portalType, requestId, kybId: finalKybId, newStatus: finalKybId ? "PENDING_AML" : "PENDING_APPROVAL" },
              "Updated issuer organization after COD approval"
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

