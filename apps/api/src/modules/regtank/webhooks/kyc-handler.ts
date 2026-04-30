import { BaseWebhookHandler } from "./base-webhook-handler";
import { RegTankKYCWebhook } from "../types";
import { logger } from "../../../lib/logger";
import { RegTankRepository } from "../repository";
import { AmlIdentityRepository } from "../aml-identity-repository";
import { Prisma } from "@prisma/client";
import { OrganizationRepository } from "../../organization/repository";
import { UserRole } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import type { PortalType } from "../types";
import { syncApplicationGuarantorsFromRegTankAmlWebhook } from "../../admin/guarantor-aml-webhook-sync";
import { maybeAdvanceOrgAfterAmlScreeningCleared } from "./org-aml-milestone";
import { linkCtosPartyToKyb } from "../../organization/ctos-party-kyb-link";
import { findCtosPartySupplementByOnboardingJsonMatch } from "../../organization/ctos-party-supplement-webhook-lookup";
import {
  getCtosPartySupplementPipelineStatus,
  mergeCtosPartySupplementDocument,
  parseCtosPartySupplement,
} from "@cashsouk/types";
import { mapRegTankKycScreeningStatusToAmlStatus } from "../helpers/regtank-kyc-screening-to-aml-status";

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
  private amlIdentityRepository: AmlIdentityRepository;
  private provider: "ACURIS" | "DOWJONES";

  constructor(provider: "ACURIS" | "DOWJONES" = "ACURIS") {
    super();
    this.repository = new RegTankRepository();
    this.organizationRepository = new OrganizationRepository();
    this.amlIdentityRepository = new AmlIdentityRepository();
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
    const statusRaw = typeof status === "string" ? status : null;
    if (!statusRaw) {
      logger.warn(
        {
          kycRequestId: requestId,
          referenceId,
          onboardingId,
        },
        "[KYC Webhook] Missing status in webhook payload, skipping persistence safely"
      );
      return;
    }
    const statusUpper = statusRaw.toUpperCase();

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

    // If onboardingId is an EOD requestId and we haven't found the onboarding record yet,
    // search for the parent COD onboarding record by looking through webhook payloads
    if (!onboarding && onboardingId && onboardingId.startsWith("EOD")) {
      logger.debug(
        { eodRequestId: onboardingId, kycRequestId: requestId },
        "[KYC Webhook] onboardingId is an EOD requestId, searching for parent COD onboarding record"
      );

      // Search through all corporate onboardings to find the one that contains this EOD
      const allCorporateOnboardings = await prisma.regTankOnboarding.findMany({
        where: {
          onboarding_type: "CORPORATE",
        },
      });

      for (const corporateOnboarding of allCorporateOnboardings) {
        // Check webhook payloads for COD webhook that contains this EOD requestId
        if (corporateOnboarding.webhook_payloads && Array.isArray(corporateOnboarding.webhook_payloads)) {
          for (const webhookPayload of corporateOnboarding.webhook_payloads) {
            if (webhookPayload && typeof webhookPayload === "object" && !Array.isArray(webhookPayload)) {
              const payloadObj = webhookPayload as Record<string, unknown>;
              // Check if this is a COD webhook (has corpIndvDirectors, corpIndvShareholders, or corpBizShareholders)
              // These are arrays of strings (EOD requestIds), not arrays of objects
              const corpIndvDirectors = payloadObj.corpIndvDirectors as string[] | undefined;
              const corpIndvShareholders = payloadObj.corpIndvShareholders as string[] | undefined;
              const corpBizShareholders = payloadObj.corpBizShareholders as string[] | undefined;

              if (
                (corpIndvDirectors && Array.isArray(corpIndvDirectors) && corpIndvDirectors.includes(onboardingId)) ||
                (corpIndvShareholders && Array.isArray(corpIndvShareholders) && corpIndvShareholders.includes(onboardingId)) ||
                (corpBizShareholders && Array.isArray(corpBizShareholders) && corpBizShareholders.includes(onboardingId))
              ) {
                onboarding = corporateOnboarding;
                foundBy = "eodParentCod";
                logger.info(
                  {
                    eodRequestId: onboardingId,
                    kycRequestId: requestId,
                    codRequestId: corporateOnboarding.request_id,
                    foundBy
                  },
                  "[KYC Webhook] ✓ Found parent COD onboarding record for EOD requestId"
                );
                break;
              }
            }
          }
          if (onboarding) break;
        }
      }

      if (!onboarding) {
        logger.debug(
          { eodRequestId: onboardingId, kycRequestId: requestId },
          "[KYC Webhook] No parent COD onboarding record found for EOD requestId"
        );
      }
    }

    if (!onboarding) {
      const guarantorRows = await syncApplicationGuarantorsFromRegTankAmlWebhook({
        requestId,
        referenceId,
        status: statusRaw,
        messageStatus,
        riskScore,
        riskLevel,
        possibleMatchCount,
        blacklistedMatchCount,
        timestamp: payload.timestamp,
      });
      if (guarantorRows > 0) {
        logger.info(
          {
            kycRequestId: requestId,
            referenceId,
            guarantorRows,
            provider: this.provider,
          },
          "[KYC Webhook] ✓ Updated application guarantor(s) from AML webhook (referenceId = client_guarantor_id)"
        );
        return;
      }

      const ctosHandled = await this.tryHandleCtosPartyKycFromWebhook(payload);
      if (ctosHandled) {
        return;
      }

      logger.warn(
        {
          requestId,
          onboardingId,
          referenceId,
        },
        "KYC webhook request not found in normal or CTOS party flow"
      );
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

    // Update AML identity mapping with kycId
    const amlOrganizationId = onboarding.investor_organization_id || onboarding.issuer_organization_id;
    const amlPortalType = onboarding.portal_type as PortalType;

    if (amlOrganizationId && onboardingId) {
      try {
        // requestId IS the kycId
        const kycId = requestId;

        // If onboardingId is an EOD requestId, find mapping by EOD
        if (onboardingId.startsWith("EOD")) {
          const mapping = await this.amlIdentityRepository.findByEodRequestId(onboardingId);

          if (mapping) {
            // Update mapping with kycId
            await this.amlIdentityRepository.upsertMapping({
              organization_id: amlOrganizationId,
              organization_type: amlPortalType,
              entity_type: mapping.entity_type as "director" | "individual_shareholder",
              name: mapping.name,
              email: mapping.email,
              cod_request_id: mapping.cod_request_id,
              eod_request_id: onboardingId,
              kyc_id: kycId,
            });

            // Find duplicates by name and email and copy kycId to them
            if (mapping.name && mapping.email) {
              await this.amlIdentityRepository.updateKycIdAndCopyToDuplicates(
                amlOrganizationId,
                kycId,
                mapping.name,
                mapping.email
              );
            }

            logger.info(
              {
                kycId,
                eodRequestId: onboardingId,
                codRequestId: onboarding.request_id,
                organizationId: amlOrganizationId,
                entityType: mapping.entity_type,
              },
              "[KYC Webhook] Updated AML identity mapping with kycId from EOD"
            );
          }
        } else if (onboardingId.startsWith("COD")) {
          // If onboardingId is COD, find all mappings for this COD and update them
          // This handles cases where kycId is provided at COD level
          const mappings = await this.amlIdentityRepository.findByCodRequestId(onboardingId);

          for (const mapping of mappings) {
            if (mapping.organization_id === amlOrganizationId) {
              await this.amlIdentityRepository.upsertMapping({
                organization_id: amlOrganizationId,
                organization_type: amlPortalType,
                entity_type: mapping.entity_type as "director" | "individual_shareholder",
                name: mapping.name,
                email: mapping.email,
                cod_request_id: onboardingId,
                eod_request_id: mapping.eod_request_id,
                kyc_id: kycId,
              });

              // Copy kycId to duplicates
              if (mapping.name && mapping.email) {
                await this.amlIdentityRepository.updateKycIdAndCopyToDuplicates(
                  amlOrganizationId,
                  kycId,
                  mapping.name,
                  mapping.email
                );
              }
            }
          }

          if (mappings.length > 0) {
            logger.info(
              {
                kycId,
                codRequestId: onboardingId,
                organizationId: amlOrganizationId,
                mappingsUpdated: mappings.length,
              },
              "[KYC Webhook] Updated AML identity mappings with kycId from COD"
            );
          }
        }
      } catch (mappingError) {
        logger.warn(
          {
            error: mappingError instanceof Error ? mappingError.message : String(mappingError),
            kycId: requestId,
            onboardingId,
            organizationId: amlOrganizationId,
          },
          "[KYC Webhook] Failed to update AML identity mapping (non-blocking)"
        );
      }
    }

    // Always persist raw status first
    await this.repository.updateStatus(onboarding.request_id, {
      status: statusRaw,
    });

    // Handle KYC approval side effects (unchanged behavior)
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
          "[KYC Webhook] Processing KYC approval - updating regtank_onboarding status and storing KYC payload (org step admin-driven)"
        );

        logger.info(
          {
            kycRequestId: requestId,
            onboardingRequestId: onboarding.request_id,
            previousRegTankStatus: onboarding.status,
            newRegTankStatus: statusRaw,
          },
          "[KYC Webhook] ✓ Stored raw KYC webhook status before approval side effects"
        );

        if (portalType === "investor" && onboarding.investor_organization_id) {
          const org = await this.organizationRepository.findInvestorOrganizationById(
            onboarding.investor_organization_id
          );
          if (org) {
            await prisma.investorOrganization.update({
              where: { id: onboarding.investor_organization_id },
              data: {
                kyc_response: payload as Prisma.InputJsonValue,
              },
            });

            try {
              await prisma.onboardingLog.create({
                data: {
                  user_id: onboarding.user_id,
                  role: UserRole.INVESTOR,
                  event_type: "ONBOARDING_STATUS_UPDATED",
                  portal: portalType as PortalType,
                  organization_name: org.name || undefined,
                  investor_organization_id: onboarding.investor_organization_id || undefined,
                  issuer_organization_id: undefined,
                  metadata: {
                    organizationId: onboarding.investor_organization_id,
                    kycRequestId: requestId,
                    onboardingRequestId: onboarding.request_id,
                    note: "KYC_APPROVED webhook stored kyc_response; onboarding_status and aml_approved unchanged",
                    trigger: "KYC_APPROVED",
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
                "Failed to create onboarding log (non-blocking)"
              );
            }

            logger.info(
              {
                kycRequestId: requestId,
                onboardingRequestId: onboarding.request_id,
                organizationId: onboarding.investor_organization_id,
              },
              "[KYC Webhook] Stored kyc_response; org onboarding step unchanged unless personal AML milestone applies"
            );

            if (onboarding.onboarding_type === "PERSONAL" && onboarding.investor_organization_id) {
              await maybeAdvanceOrgAfterAmlScreeningCleared({
                organizationId: onboarding.investor_organization_id,
                portalType: "investor",
                userId: onboarding.user_id,
                organizationName: org.name,
                trigger: "REGTANK_KYC_PERSONAL_AML_CLEARED",
                extraMetadata: {
                  kycRequestId: requestId,
                  onboardingRequestId: onboarding.request_id,
                },
              });
            }
          }
        } else if (portalType === "issuer" && onboarding.issuer_organization_id) {
          const org = await this.organizationRepository.findIssuerOrganizationById(
            onboarding.issuer_organization_id
          );
          if (org) {
            await prisma.issuerOrganization.update({
              where: { id: onboarding.issuer_organization_id },
              data: {
                kyc_response: payload as Prisma.InputJsonValue,
              },
            });

            try {
              await prisma.onboardingLog.create({
                data: {
                  user_id: onboarding.user_id,
                  role: UserRole.ISSUER,
                  event_type: "ONBOARDING_STATUS_UPDATED",
                  portal: portalType as PortalType,
                  organization_name: org.name || undefined,
                  investor_organization_id: undefined,
                  issuer_organization_id: onboarding.issuer_organization_id || undefined,
                  metadata: {
                    organizationId: onboarding.issuer_organization_id,
                    kycRequestId: requestId,
                    onboardingRequestId: onboarding.request_id,
                    note: "KYC_APPROVED webhook stored kyc_response; onboarding_status and aml_approved unchanged",
                    trigger: "KYC_APPROVED",
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
                "Failed to create onboarding log (non-blocking)"
              );
            }

            logger.info(
              {
                kycRequestId: requestId,
                onboardingRequestId: onboarding.request_id,
                organizationId: onboarding.issuer_organization_id,
              },
              "[KYC Webhook] Stored kyc_response; org onboarding step unchanged unless personal AML milestone applies"
            );

            if (onboarding.onboarding_type === "PERSONAL" && onboarding.issuer_organization_id) {
              await maybeAdvanceOrgAfterAmlScreeningCleared({
                organizationId: onboarding.issuer_organization_id,
                portalType: "issuer",
                userId: onboarding.user_id,
                organizationName: org.name,
                trigger: "REGTANK_KYC_PERSONAL_AML_CLEARED",
                extraMetadata: {
                  kycRequestId: requestId,
                  onboardingRequestId: onboarding.request_id,
                },
              });
            }
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

    // Handle director AML status update for corporate onboarding
    // If onboardingId starts with "EOD", this is a director's individual KYC
    // The onboarding record should already be the parent COD record if we found it above
    if (onboardingId && onboardingId.startsWith("EOD") && organizationId) {
      try {
        const eodRequestId = onboardingId;
        const portalType = onboarding.portal_type as PortalType;
        const isCorporateOnboarding = onboarding.onboarding_type === "CORPORATE";

        if (!isCorporateOnboarding) {
          logger.debug(
            { eodRequestId, kycRequestId: requestId },
            "[KYC Webhook] Not a corporate onboarding, skipping director AML status update"
          );
          return;
        }

        logger.info(
          {
            eodRequestId,
            kycRequestId: requestId,
            codRequestId: onboarding.request_id,
            organizationId,
            portalType,
            status: statusUpper,
            messageStatus,
          },
          "[KYC Webhook] Processing director AML status update for corporate onboarding"
        );

        // Get organization with director_kyc_status to find matching director
        const org = portalType === "investor"
          ? await prisma.investorOrganization.findUnique({
              where: { id: organizationId },
              select: {
                id: true,
                director_kyc_status: true,
                director_aml_status: true,
              },
            })
          : await prisma.issuerOrganization.findUnique({
              where: { id: organizationId },
              select: {
                id: true,
                director_kyc_status: true,
                director_aml_status: true,
              },
            });

        if (!org) {
          logger.warn(
            { eodRequestId, kycRequestId: requestId, organizationId, portalType },
            "[KYC Webhook] Organization not found, skipping director AML status update"
          );
          return;
        }

        // Get director_kyc_status to find the director by kycId
        const directorKycStatus = org.director_kyc_status as any;
        if (!directorKycStatus || !directorKycStatus.directors || !Array.isArray(directorKycStatus.directors)) {
          logger.warn(
            { eodRequestId, kycRequestId: requestId, organizationId },
            "[KYC Webhook] director_kyc_status not found or invalid, skipping director AML status update"
          );
          return;
        }

        // Find the director by eodRequestId first (more reliable), then by kycId
        let directorIndex = directorKycStatus.directors.findIndex(
          (d: any) => d.eodRequestId === eodRequestId
        );

        if (directorIndex === -1) {
          // Fallback: try to find by kycId
          directorIndex = directorKycStatus.directors.findIndex(
            (d: any) => d.kycId === requestId
          );
        }

        if (directorIndex === -1) {
          logger.warn(
            { eodRequestId, kycRequestId: requestId, organizationId },
            "[KYC Webhook] Director not found in director_kyc_status by eodRequestId or kycId, skipping AML status update"
          );
          return;
        }

        const director = directorKycStatus.directors[directorIndex];

        // Update kycId in director_kyc_status if it's missing or different
        if (!director.kycId || director.kycId !== requestId) {
          director.kycId = requestId;
          // Update director_kyc_status with the new kycId
          if (portalType === "investor") {
            await prisma.investorOrganization.update({
              where: { id: organizationId },
              data: {
                director_kyc_status: directorKycStatus as Prisma.InputJsonValue,
              },
            });
          } else {
            await prisma.issuerOrganization.update({
              where: { id: organizationId },
              data: {
                director_kyc_status: directorKycStatus as Prisma.InputJsonValue,
              },
            });
          }
          logger.debug(
            { eodRequestId, kycRequestId: requestId, organizationId, directorName: director.name },
            "[KYC Webhook] Updated kycId in director_kyc_status"
          );
        }

        const amlStatus = mapRegTankKycScreeningStatusToAmlStatus(statusRaw);

        // Extract risk score and level from payload
        // Note: riskScore and riskLevel come from the webhook payload
        const amlRiskScore = riskScore ? parseFloat(String(riskScore)) : null;
        const amlRiskLevel = riskLevel || null;

        // Get or create director_aml_status
        let directorAmlStatus = (org.director_aml_status as any) || { directors: [], lastSyncedAt: new Date().toISOString() };
        if (!directorAmlStatus.directors || !Array.isArray(directorAmlStatus.directors)) {
          directorAmlStatus.directors = [];
        }

        // Find or create AML status entry for this director (match by kycId or eodRequestId)
        let amlIndex = directorAmlStatus.directors.findIndex(
          (d: any) => d.kycId === requestId || d.eodRequestId === eodRequestId
        );

        const amlEntry = {
          kycId: requestId,
          eodRequestId: eodRequestId,
          name: director.name,
          email: director.email,
          role: director.role,
          amlStatus,
          amlMessageStatus: messageStatus || "PENDING",
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

        // Update organization with new director_aml_status
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
            kycRequestId: requestId,
            organizationId,
            directorName: director.name,
            amlStatus,
            amlMessageStatus: messageStatus,
            amlRiskScore,
            amlRiskLevel,
          },
          "[KYC Webhook] ✓ Updated director AML status in organization"
        );
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            kycRequestId: requestId,
            onboardingId,
            organizationId,
          },
          "[KYC Webhook] Failed to update director AML status (non-blocking)"
        );
        // Don't throw - allow webhook to complete even if director AML update fails
      }
    }
  }

  private kycProviderLabel(): "ACURIS" | "DOW_JONES" {
    return this.provider === "DOWJONES" ? "DOW_JONES" : "ACURIS";
  }

  /**
   * Issuer CTOS party individual onboarding: no reg_tank_onboarding row; match supplement by onboarding_json.requestId or referenceId.
   * When webhook `referenceId` uses `buildSafeReferenceId(orgId, partyKey)`, lookup is scoped to that org so another org cannot match the same ids.
   */
  private async tryHandleCtosPartyKycFromWebhook(payload: RegTankKYCWebhook): Promise<boolean> {
    const {
      requestId,
      referenceId,
      onboardingId,
      status,
      riskLevel,
      riskScore,
      messageStatus,
      possibleMatchCount,
      blacklistedMatchCount,
    } = payload;

    const supplement = await findCtosPartySupplementByOnboardingJsonMatch(onboardingId, referenceId);
    if (!supplement) {
      return false;
    }

    const prevRoot = supplement.onboarding_json;
    const prev = parseCtosPartySupplement(prevRoot);

    const rawStatus = typeof status === "string" ? status : "";
    if (!rawStatus) {
      logger.warn(
        {
          requestId,
          onboardingId,
          referenceId,
          partyKey: supplement.party_key,
        },
        "CTOS party KYC webhook missing status, skipping supplement persistence safely"
      );
      return true;
    }
    const now = new Date().toISOString();

    const latestRequestId = prev.requestId.trim();
    const webhookOnboardingId = typeof onboardingId === "string" ? onboardingId.trim() : "";
    if (latestRequestId && webhookOnboardingId && latestRequestId !== webhookOnboardingId) {
      logger.info(
        {
          latestRequestId,
          webhookOnboardingId,
          requestId,
          partyKey: supplement.party_key,
          issuerOrganizationId: supplement.issuer_organization_id,
          investorOrganizationId: supplement.investor_organization_id,
        },
        "Ignored stale CTOS party KYC webhook for non-latest onboarding requestId"
      );
      return true;
    }

    const ext = payload as Record<string, unknown>;
    const firstStringField = (keys: string[]): string => {
      for (const k of keys) {
        const v = ext[k];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      return "";
    };
    const explicitAml = firstStringField([
      "amlStatus",
      "screeningResult",
      "screeningStatus",
      "amlResult",
      "screening_status",
      "aml_screening_status",
    ]);
    const msg = typeof messageStatus === "string" ? messageStatus.trim() : "";
    const st = typeof status === "string" ? status : "";
    const screeningStatusRaw = (st || explicitAml || msg).trim();

    const screeningPatch: Record<string, unknown> = {
      provider: this.kycProviderLabel(),
      requestId,
      status: screeningStatusRaw,
      riskLevel: riskLevel != null ? String(riskLevel) : null,
      riskScore: riskScore ?? null,
      updatedAt: now,
    };
    if (messageStatus !== undefined && messageStatus !== null && `${messageStatus}`.length > 0) {
      screeningPatch.messageStatus = messageStatus;
    }
    if (typeof referenceId === "string" && referenceId.trim()) {
      screeningPatch.referenceId = referenceId.trim();
    }
    if (typeof possibleMatchCount === "number") {
      screeningPatch.possibleMatchCount = possibleMatchCount;
    }
    if (typeof blacklistedMatchCount === "number") {
      screeningPatch.blacklistedMatchCount = blacklistedMatchCount;
    }

    const mergedBase = mergeCtosPartySupplementDocument(prevRoot, {
      screening: screeningPatch,
    });

    await prisma.ctosPartySupplement.update({
      where: { id: supplement.id },
      data: { onboarding_json: mergedBase as Prisma.InputJsonValue },
    });

    if (supplement.issuer_organization_id) {
      try {
        const { runIssuerDirectorShareholderNotificationResolutionFromDb } = await import(
          "../../notification/director-shareholder-notifications"
        );
        await runIssuerDirectorShareholderNotificationResolutionFromDb(supplement.issuer_organization_id);
      } catch {
        /* non-blocking */
      }
    }

    logger.info(
      {
        requestId,
        onboardingId,
        referenceId,
        provider: this.kycProviderLabel(),
        status,
        amlRawStatus: screeningPatch.status,
        partyKey: supplement.party_key,
        issuerOrganizationId: supplement.issuer_organization_id,
        investorOrganizationId: supplement.investor_organization_id,
      },
      "CTOS party KYC/AML webhook handled"
    );

    const updatedRec = mergedBase as Record<string, unknown>;
    const approved = getCtosPartySupplementPipelineStatus(updatedRec).toUpperCase() === "APPROVED";
    if (approved && this.provider === "ACURIS" && supplement.issuer_organization_id) {
      try {
        await linkCtosPartyToKyb({
          organizationId: supplement.issuer_organization_id,
          partyKey: supplement.party_key,
          onboardingJson: updatedRec,
        });
      } catch (e) {
        logger.error(
          {
            error: e instanceof Error ? e.message : String(e),
            organizationId: supplement.issuer_organization_id,
            partyKey: supplement.party_key,
          },
          "CTOS KYB auto-link failed (non-blocking)"
        );
      }
    }

    return true;
  }
}

