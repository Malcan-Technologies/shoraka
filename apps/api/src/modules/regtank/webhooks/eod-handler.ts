import { BaseWebhookHandler } from "./base-webhook-handler";
import { RegTankEODWebhook } from "../types";
import { logger } from "../../../lib/logger";
import { RegTankRepository } from "../repository";
import { AuthRepository } from "../../auth/repository";
import { AmlIdentityRepository } from "../aml-identity-repository";
import { UserRole } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import type { PortalType } from "../types";
import { OrganizationRepository } from "../../organization/repository";
import { getRegTankAPIClient } from "../api-client";

/**
 * EOD (Entity Onboarding Data) Webhook Handler
 * Handles webhooks from /eodliveness endpoint
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.8-business-onboarding-notification-definition-eod
 */
export class EODWebhookHandler extends BaseWebhookHandler {
  private repository: RegTankRepository;
  private authRepository: AuthRepository;
  private organizationRepository: OrganizationRepository;
  private amlIdentityRepository: AmlIdentityRepository;
  private apiClient: ReturnType<typeof getRegTankAPIClient>;

  constructor() {
    super();
    this.repository = new RegTankRepository();
    this.authRepository = new AuthRepository();
    this.organizationRepository = new OrganizationRepository();
    this.amlIdentityRepository = new AmlIdentityRepository();
    this.apiClient = getRegTankAPIClient();
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
        organizationName: onboarding.investor_organization?.name || onboarding.issuer_organization?.name || undefined,
        investorOrganizationId: onboarding.investor_organization_id || undefined,
        issuerOrganizationId: onboarding.issuer_organization_id || undefined,
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

    // After updating director_kyc_status, if status is APPROVED, fetch AML status
    if (statusUpper === "APPROVED" && organizationId) {
      // Wait 3 seconds for RegTank to process the KYC
      await new Promise((resolve) => setTimeout(resolve, 3000));

      try {
        const portalType = onboarding.portal_type as PortalType;
        let finalKycId = kycId;

        // If kycId is not in webhook payload, fetch EOD details to get it
        if (!finalKycId) {
          try {
            logger.info(
              {
                eodRequestId,
                codRequestId: onboarding.request_id,
                organizationId,
              },
              "[EOD Webhook] kycId not in webhook, fetching EOD details after 3-second delay"
            );

            const eodDetails = await this.apiClient.getEntityOnboardingDetails(eodRequestId);
            finalKycId = eodDetails.kycRequestInfo?.kycId;

            if (finalKycId) {
              // Update director_kyc_status with the fetched kycId
              const org = portalType === "investor"
                ? await prisma.investorOrganization.findUnique({
                  where: { id: organizationId },
                  select: { director_kyc_status: true },
                })
                : await prisma.issuerOrganization.findUnique({
                  where: { id: organizationId },
                  select: { director_kyc_status: true },
                });

              if (org && org.director_kyc_status) {
                const directorKycStatus = org.director_kyc_status as any;
                const updatedDirectors = directorKycStatus.directors.map((d: any) => {
                  if (d.eodRequestId === eodRequestId) {
                    return { ...d, kycId: finalKycId, lastUpdated: new Date().toISOString() };
                  }
                  return d;
                });

                if (portalType === "investor") {
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
                } else {
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
                }
              }
            }
          } catch (eodError) {
            logger.warn(
              {
                error: eodError instanceof Error ? eodError.message : String(eodError),
                eodRequestId,
                organizationId,
              },
              "[EOD Webhook] Failed to fetch EOD details for kycId (non-blocking, will retry on COD approval)"
            );
          }
        }

        // If we have a kycId, update AML identity mapping
        if (finalKycId && organizationId) {
          try {
            // Find mapping by EOD request ID
            const mapping = await this.amlIdentityRepository.findByEodRequestId(eodRequestId);
            
            if (mapping) {
              // Update mapping with kycId
              await this.amlIdentityRepository.upsertMapping({
                organization_id: organizationId,
                organization_type: portalType,
                entity_type: mapping.entity_type as "director" | "individual_shareholder",
                name: mapping.name,
                email: mapping.email,
                cod_request_id: mapping.cod_request_id,
                eod_request_id: eodRequestId,
                kyc_id: finalKycId,
              });

              // Find duplicates by name and email and copy kycId to them
              if (mapping.name && mapping.email) {
                await this.amlIdentityRepository.updateKycIdAndCopyToDuplicates(
                  organizationId,
                  finalKycId,
                  mapping.name,
                  mapping.email
                );
              }

              logger.info(
                {
                  eodRequestId,
                  codRequestId: onboarding.request_id,
                  kycId: finalKycId,
                  organizationId,
                  entityType: mapping.entity_type,
                },
                "[EOD Webhook] Updated AML identity mapping with kycId"
              );
            } else {
              // Mapping doesn't exist yet - try to create it from EOD details
              try {
                const eodDetails = await this.apiClient.getEntityOnboardingDetails(eodRequestId);
                const userInfo = eodDetails.corporateUserRequestInfo;
                const formContent = userInfo?.formContent?.content || [];
                const firstName = formContent.find((f: any) => f.fieldName === "First Name")?.fieldValue || "";
                const lastName = formContent.find((f: any) => f.fieldName === "Last Name")?.fieldValue || "";
                const email = formContent.find((f: any) => f.fieldName === "Email Address")?.fieldValue || userInfo?.email || null;
                const name = `${firstName} ${lastName}`.trim() || userInfo?.fullName || null;
                
                // Determine entity type from parent COD
                const codDetails = await this.apiClient.getCorporateOnboardingDetails(onboarding.request_id);
                const isDirector = codDetails.corpIndvDirectors?.some((d: any) => 
                  d.corporateIndividualRequest?.requestId === eodRequestId
                );
                const isShareholder = codDetails.corpIndvShareholders?.some((s: any) => 
                  s.corporateIndividualRequest?.requestId === eodRequestId
                );

                if (name && email) {
                  // Create mapping for director or shareholder
                  if (isDirector) {
                    await this.amlIdentityRepository.upsertMapping({
                      organization_id: organizationId,
                      organization_type: portalType,
                      entity_type: "director",
                      name,
                      email,
                      cod_request_id: onboarding.request_id,
                      eod_request_id: eodRequestId,
                      kyc_id: finalKycId,
                    });
                  }
                  
                  if (isShareholder) {
                    await this.amlIdentityRepository.upsertMapping({
                      organization_id: organizationId,
                      organization_type: portalType,
                      entity_type: "individual_shareholder",
                      name,
                      email,
                      cod_request_id: onboarding.request_id,
                      eod_request_id: eodRequestId,
                      kyc_id: finalKycId,
                    });
                  }

                  // Copy kycId to duplicates
                  await this.amlIdentityRepository.updateKycIdAndCopyToDuplicates(
                    organizationId,
                    finalKycId,
                    name,
                    email
                  );

                  logger.info(
                    {
                      eodRequestId,
                      codRequestId: onboarding.request_id,
                      kycId: finalKycId,
                      organizationId,
                      name,
                      email,
                    },
                    "[EOD Webhook] Created new AML identity mapping with kycId"
                  );
                }
              } catch (createError) {
                logger.warn(
                  {
                    error: createError instanceof Error ? createError.message : String(createError),
                    eodRequestId,
                    organizationId,
                  },
                  "[EOD Webhook] Failed to create AML identity mapping (non-blocking)"
                );
              }
            }
          } catch (mappingError) {
            logger.warn(
              {
                error: mappingError instanceof Error ? mappingError.message : String(mappingError),
                eodRequestId,
                organizationId,
                kycId: finalKycId,
              },
              "[EOD Webhook] Failed to update AML identity mapping (non-blocking)"
            );
          }
        }

        // If we have a kycId, fetch AML status
        if (finalKycId) {
          logger.info(
            {
              eodRequestId,
              codRequestId: onboarding.request_id,
              kycId: finalKycId,
              organizationId,
            },
            "[EOD Webhook] Fetching AML status after 3-second delay"
          );

          const kycStatusResponse = await this.apiClient.queryKYCStatus(finalKycId);
          const kycStatusData = Array.isArray(kycStatusResponse) ? kycStatusResponse[0] : kycStatusResponse;

          // Map RegTank status to our AML status
          let amlStatus: "Unresolved" | "Approved" | "Rejected" | "Pending" = "Pending";
          const regTankStatus = kycStatusData?.status?.toUpperCase() || "";
          if (regTankStatus === "APPROVED") {
            amlStatus = "Approved";
          } else if (regTankStatus === "REJECTED") {
            amlStatus = "Rejected";
          } else if (regTankStatus === "UNRESOLVED") {
            amlStatus = "Unresolved";
          }

          // Extract risk score and level
          const individualRiskScore = kycStatusData?.individualRiskScore;
          const amlRiskScore = individualRiskScore?.score !== null && individualRiskScore?.score !== undefined
            ? parseFloat(String(individualRiskScore.score))
            : null;
          const amlRiskLevel = individualRiskScore?.level || null;

          // Extract message status
          const amlMessageStatus = (kycStatusData?.messageStatus || "PENDING") as "DONE" | "PENDING" | "ERROR";

          // Get organization to update director_aml_status
          const org = portalType === "investor"
            ? await prisma.investorOrganization.findUnique({
              where: { id: organizationId },
              select: { id: true, director_kyc_status: true, director_aml_status: true },
            })
            : await prisma.issuerOrganization.findUnique({
              where: { id: organizationId },
              select: { id: true, director_kyc_status: true, director_aml_status: true },
            });

          if (org && org.director_kyc_status) {
            const directorKycStatus = org.director_kyc_status as any;
            const director = directorKycStatus.directors?.find(
              (d: any) => d.eodRequestId === eodRequestId
            );

            if (director) {
              // Get or create director_aml_status
              let directorAmlStatus = (org.director_aml_status as any) || { directors: [], lastSyncedAt: new Date().toISOString() };
              if (!directorAmlStatus.directors || !Array.isArray(directorAmlStatus.directors)) {
                directorAmlStatus.directors = [];
              }

              // Find or create AML status entry
              const amlIndex = directorAmlStatus.directors.findIndex(
                (d: any) => d.kycId === finalKycId
              );

              const amlEntry = {
                kycId: finalKycId,
                name: director.name,
                email: director.email,
                role: director.role,
                amlStatus,
                amlMessageStatus,
                amlRiskScore,
                amlRiskLevel,
                lastUpdated: new Date().toISOString(),
              };

              if (amlIndex === -1) {
                directorAmlStatus.directors.push(amlEntry);
              } else {
                directorAmlStatus.directors[amlIndex] = amlEntry;
              }

              directorAmlStatus.lastSyncedAt = new Date().toISOString();

              // Update organization
              if (portalType === "investor") {
                await prisma.investorOrganization.update({
                  where: { id: organizationId },
                  data: {
                    director_aml_status: directorAmlStatus as Prisma.InputJsonValue,
                  },
                });
              } else {
                await prisma.issuerOrganization.update({
                  where: { id: organizationId },
                  data: {
                    director_aml_status: directorAmlStatus as Prisma.InputJsonValue,
                  },
                });
              }

              logger.info(
                {
                  eodRequestId,
                  kycId: finalKycId,
                  organizationId,
                  amlStatus,
                  amlMessageStatus,
                },
                "[EOD Webhook] ✓ Updated director AML status after delayed fetch"
              );
            }
          }
        } else {
          logger.warn(
            {
              eodRequestId,
              codRequestId: onboarding.request_id,
              organizationId,
            },
            "[EOD Webhook] kycId not available after delay, will retry on COD approval"
          );
        }
      } catch (amlError) {
        logger.warn(
          {
            error: amlError instanceof Error ? amlError.message : String(amlError),
            eodRequestId,
            organizationId,
          },
          "[EOD Webhook] Failed to fetch AML status after delay (non-blocking, will retry on COD approval)"
        );
        // Don't throw - allow webhook to complete, will retry when COD is approved
      }
    }

    // Note: EOD represents individual directors/shareholders, not the company itself
    // Organization status is updated via COD webhook, not EOD webhook
  }
}

