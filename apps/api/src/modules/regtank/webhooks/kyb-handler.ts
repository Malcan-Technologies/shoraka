import { BaseWebhookHandler } from "./base-webhook-handler";
import { RegTankKYBWebhook } from "../types";
import { logger } from "../../../lib/logger";
import { RegTankRepository } from "../repository";
import { AmlIdentityRepository } from "../aml-identity-repository";
import { OrganizationRepository } from "../../organization/repository";
import { getRegTankAPIClient } from "../api-client";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import type { PortalType } from "../types";
import { syncApplicationGuarantorsFromRegTankAmlWebhook } from "../../admin/guarantor-aml-webhook-sync";
import { maybeAdvanceOrgAfterAmlScreeningCleared } from "./org-aml-milestone";
import {
  getCorporateShareholderCodId,
  syncCorporateShareholderStatusInOrganization,
} from "../helpers/corporate-shareholder-status-sync";
import {
  extractBusinessNameFromCorpShareholderRow,
  extractBusinessNumberFromCorpShareholderRow,
  getCorporateShareholderKybId,
  matchBusinessShareholderForKybWebhook,
} from "../helpers/business-shareholder-kyb-match";
import {
  isCancelledOnboardingRow,
  logCancelledOnboardingSkip,
  isAmlWebhookOnboardingTypeConsistent,
  logWebhookFamilyTypeMismatch,
} from "./onboarding-webhook-guards";

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
  private amlIdentityRepository: AmlIdentityRepository;
  private apiClient: ReturnType<typeof getRegTankAPIClient>;
  private provider: "ACURIS" | "DOWJONES";

  constructor(provider: "ACURIS" | "DOWJONES" = "ACURIS") {
    super();
    this.repository = new RegTankRepository();
    this.organizationRepository = new OrganizationRepository();
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
    const statusRaw = typeof status === "string" ? status : null;
    if (!statusRaw) {
      logger.warn(
        {
          kybRequestId: requestId,
          referenceId,
          onboardingId,
        },
        "[KYB Webhook] Missing status in webhook payload, skipping persistence safely"
      );
      return;
    }
    const statusUpper = statusRaw.toUpperCase();

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
            kybRequestId: requestId,
            referenceId,
            guarantorRows,
            provider: this.provider,
          },
          "[KYB Webhook] ✓ Updated application guarantor(s) from AML webhook (referenceId = client_guarantor_id)"
        );
        return;
      }

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
    } else if (!isAmlWebhookOnboardingTypeConsistent(onboarding)) {
      // Type-family check runs before persistence: a confirmed mismatch must not be
      // appended to the wrong-type record at all.
      logWebhookFamilyTypeMismatch({
        webhookFamily: "kyb",
        webhookRequestId: requestId,
        onboarding,
        expected: "CORPORATE onboarding rows must be organization_type COMPANY",
      });
      return;
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

      if (isCancelledOnboardingRow(onboarding)) {
        logCancelledOnboardingSkip({
          webhookFamily: "kyb",
          webhookRequestId: requestId,
          onboarding,
        });
        return;
      }

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

      // Note: `reg_tank_onboarding.status` represents onboarding lifecycle progress
      // (individual/COD events), not KYB screening results, so it is not overwritten here.
      // The raw KYB status is preserved above in webhook_payloads.

      // Handle KYB approval side effects — next org status depends on CTOS (SSM) already done
      const organizationId = onboarding.investor_organization_id || onboarding.issuer_organization_id;
      const portalType = onboarding.portal_type as PortalType;
      const isCorporateOnboarding = onboarding.onboarding_type === "CORPORATE";

      if (statusUpper === "APPROVED" && organizationId && isCorporateOnboarding) {
        if (!isMainCompanyCod) {
          logger.debug(
            {
              kybRequestId: requestId,
              onboardingRequestId: onboarding.request_id,
              organizationId,
            },
            "[KYB Webhook] KYB APPROVED for non-main COD — skipping org AML milestone"
          );
        } else {
          const orgForName =
            portalType === "investor"
              ? await this.organizationRepository.findInvestorOrganizationById(organizationId)
              : await this.organizationRepository.findIssuerOrganizationById(organizationId);
          await maybeAdvanceOrgAfterAmlScreeningCleared({
            organizationId,
            portalType,
            userId: onboarding.user_id,
            organizationName: orgForName?.name ?? null,
            trigger: "REGTANK_KYB_MAIN_COMPANY_APPROVED",
            extraMetadata: {
              kybRequestId: requestId,
              onboardingRequestId: onboarding.request_id,
              riskLevel,
              riskScore,
            },
          });
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

    // Nested corporate-shareholder KYB: RegTank often sends the *parent* COD as onboardingId.
    // Always try to match by kybId (and nested COD) so we do not skip Apex-style rows when
    // the webhook also matches the main-company onboarding record.
    if ((onboardingId && onboardingId.startsWith("COD")) || (!onboarding && requestId)) {
      logger.info(
        {
          onboardingId,
          kybRequestId: requestId,
          isMainCompanyCod: Boolean(isMainCompanyCod),
          onboardingFound: !!onboarding,
        },
        "[KYB Webhook] Checking business shareholder KYB match"
      );
      await this.handleBusinessShareholderKYB(payload, { warnIfMissing: !isMainCompanyCod });
    }
  }

  /**
   * Handle KYB webhook for nested corporate (business) shareholders.
   * Match by stored kybId first (CE or director_aml_status), then by the shareholder COD.
   * Never write the parent company COD/name onto the nested AML row.
   */
  private async handleBusinessShareholderKYB(
    payload: RegTankKYBWebhook,
    options: { warnIfMissing: boolean } = { warnIfMissing: true }
  ): Promise<void> {
    const { requestId: kybId, onboardingId, status, riskScore, riskLevel, messageStatus } = payload;
    const statusRaw = typeof status === "string" ? status : "";
    const statusUpper = statusRaw.toUpperCase();

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

    const [investorOrgs, issuerOrgs] = await Promise.all([
      prisma.investorOrganization.findMany({
        select: { id: true, corporate_entities: true, director_aml_status: true },
      }),
      prisma.issuerOrganization.findMany({
        select: { id: true, corporate_entities: true, director_aml_status: true },
      }),
    ]);

    const matchIds = { kybId, onboardingId };
    const matchingInvestorOrgs = investorOrgs.filter(
      (org) => matchBusinessShareholderForKybWebhook(org, matchIds) != null
    );
    const matchingIssuerOrgs = issuerOrgs.filter(
      (org) => matchBusinessShareholderForKybWebhook(org, matchIds) != null
    );

    const allOrgs = [
      ...matchingInvestorOrgs.map((org) => ({ ...org, portalType: "investor" as const })),
      ...matchingIssuerOrgs.map((org) => ({ ...org, portalType: "issuer" as const })),
    ];

    if (allOrgs.length === 0) {
      const logPayload = {
        kybId,
        onboardingId,
        note: "No organization found with matching business shareholder COD or kybId. This may be a main company KYB or the business shareholder data hasn't been stored yet.",
      };
      if (options.warnIfMissing) {
        logger.warn(logPayload, "[KYB Webhook] No organization found with matching business shareholder COD or kybId");
      } else {
        logger.debug(logPayload, "[KYB Webhook] No nested business shareholder match for this KYB (main-company path)");
      }
      return;
    }

    for (const org of allOrgs) {
      try {
        const match = matchBusinessShareholderForKybWebhook(org, matchIds);
        if (!match) continue;

        const shareholderCodRequestId = match.shareholderCodRequestId;
        const existingAml = match.amlEntry ?? {};
        let businessName =
          extractBusinessNameFromCorpShareholderRow(match.corporateShareholder ?? {}) ||
          (typeof existingAml.businessName === "string" ? existingAml.businessName : null) ||
          "Unknown";
        let sharePercentage: string | number | null =
          (match.corporateShareholder as { sharePercentage?: string | number } | null)?.sharePercentage ??
          (typeof existingAml.sharePercentage === "number" || typeof existingAml.sharePercentage === "string"
            ? (existingAml.sharePercentage as string | number)
            : null);
        let businessNumber =
          (match.corporateShareholder
            ? extractBusinessNumberFromCorpShareholderRow(match.corporateShareholder)
            : null) ||
          (typeof existingAml.businessNumber === "string" ? existingAml.businessNumber : null);

        if (shareholderCodRequestId) {
          try {
            const codDetails = await this.apiClient.getCorporateOnboardingDetails(shareholderCodRequestId);
            const formContent =
              (codDetails as { formContent?: { displayAreas?: Array<{ displayArea?: string; content?: unknown[] }> } })
                ?.formContent?.displayAreas?.find((area) => area.displayArea === "Basic Information Setting")
                ?.content || [];
            const nameFromCod = (formContent as Array<{ fieldName?: string; fieldValue?: string }>).find(
              (f) => f.fieldName === "Business Name"
            )?.fieldValue;
            const sharesFromCod = (formContent as Array<{ fieldName?: string; fieldValue?: string }>).find(
              (f) => f.fieldName === "% of Shares"
            )?.fieldValue;
            const brnFromCod = (formContent as Array<{ fieldName?: string; fieldValue?: string }>).find(
              (f) => f.fieldName === "Business Number"
            )?.fieldValue;
            if (nameFromCod) businessName = nameFromCod;
            if (sharesFromCod) sharePercentage = sharesFromCod;
            if (brnFromCod) businessNumber = brnFromCod;
          } catch (codFetchError) {
            logger.warn(
              {
                error: codFetchError instanceof Error ? codFetchError.message : String(codFetchError),
                kybId,
                shareholderCodRequestId,
              },
              "[KYB Webhook] Failed to fetch nested shareholder COD details (using stored name)"
            );
          }
        }

        let amlStatus: "Unresolved" | "Approved" | "Rejected" | "Pending" = "Pending";
        if (statusUpper === "RISK ASSESSED" || statusUpper === "APPROVED") {
          amlStatus = "Approved";
        } else if (statusUpper === "REJECTED") {
          amlStatus = "Rejected";
        } else if (statusUpper === "UNRESOLVED" || statusUpper === "NO_MATCH") {
          amlStatus = "Unresolved";
        }

        const directorAmlStatus = (org.director_aml_status as Record<string, unknown> | null) || {
          directors: [],
          businessShareholders: [],
          lastSyncedAt: new Date().toISOString(),
        };
        if (!Array.isArray(directorAmlStatus.directors)) {
          directorAmlStatus.directors = [];
        }
        if (!Array.isArray(directorAmlStatus.businessShareholders)) {
          directorAmlStatus.businessShareholders = [];
        }

        const businessShareholders = directorAmlStatus.businessShareholders as Record<string, unknown>[];
        const existingIndex = businessShareholders.findIndex(
          (bs) =>
            (kybId && bs.kybId === kybId) ||
            (shareholderCodRequestId && bs.codRequestId === shareholderCodRequestId)
        );

        const parsedShare =
          sharePercentage == null || sharePercentage === ""
            ? typeof existingAml.sharePercentage === "number"
              ? existingAml.sharePercentage
              : null
            : parseFloat(String(sharePercentage));

        const updatedShareholder = {
          ...existingAml,
          codRequestId: shareholderCodRequestId || existingAml.codRequestId || null,
          kybId,
          businessName,
          ...(businessNumber ? { businessNumber } : {}),
          sharePercentage: Number.isFinite(parsedShare as number) ? parsedShare : null,
          amlStatus,
          rawStatus: statusRaw,
          amlMessageStatus: messageStatus || "PENDING",
          amlRiskScore: riskScore ? parseFloat(String(riskScore)) : null,
          amlRiskLevel: riskLevel || null,
          lastUpdated: new Date().toISOString(),
        };

        if (existingIndex !== -1) {
          businessShareholders[existingIndex] = updatedShareholder;
        } else {
          businessShareholders.push(updatedShareholder);
        }

        directorAmlStatus.businessShareholders = businessShareholders;
        directorAmlStatus.lastSyncedAt = new Date().toISOString();

        const portalType = org.portalType;
        const organizationId = org.id;

        const updateData: {
          director_aml_status: Prisma.InputJsonValue;
          corporate_entities?: Prisma.InputJsonValue;
        } = {
          director_aml_status: directorAmlStatus as Prisma.InputJsonValue,
        };

        if (match.corporateShareholder && kybId) {
          const corporateEntities = {
            ...((org.corporate_entities as Record<string, unknown> | null) ?? {}),
          };
          const ceList = Array.isArray(corporateEntities.corporateShareholders)
            ? [...(corporateEntities.corporateShareholders as unknown[])]
            : [];
          const ceIndex = ceList.findIndex((row) => {
            if (row == null || typeof row !== "object" || Array.isArray(row)) return false;
            const rec = row as Record<string, unknown>;
            const rowCod = getCorporateShareholderCodId(rec);
            const rowKyb = getCorporateShareholderKybId(rec);
            return (
              (shareholderCodRequestId && rowCod === shareholderCodRequestId) ||
              (Boolean(kybId) && rowKyb === kybId)
            );
          });
          if (ceIndex >= 0 && ceList[ceIndex] && typeof ceList[ceIndex] === "object" && !Array.isArray(ceList[ceIndex])) {
            ceList[ceIndex] = { ...(ceList[ceIndex] as Record<string, unknown>), kybId };
            corporateEntities.corporateShareholders = ceList;
            updateData.corporate_entities = corporateEntities as Prisma.InputJsonValue;
          }
        }

        if (portalType === "investor") {
          await prisma.investorOrganization.update({
            where: { id: organizationId },
            data: updateData,
          });
        } else {
          await prisma.issuerOrganization.update({
            where: { id: organizationId },
            data: updateData,
          });
        }

        try {
          await syncCorporateShareholderStatusInOrganization({
            organizationId,
            portalType,
            incomingCodRequestId: shareholderCodRequestId,
            newStatus: statusRaw,
            source: "KYB",
            codDetailsForBrnFallback: null,
            kybPayloadForBrnFallback: payload,
            logWebhookRequestId: kybId,
          });
        } catch (corpEntitySyncError) {
          logger.warn(
            {
              error: corpEntitySyncError instanceof Error ? corpEntitySyncError.message : String(corpEntitySyncError),
              kybId,
              onboardingId,
              shareholderCodRequestId,
              organizationId,
            },
            "[KYB Webhook] Failed to sync corporate_entities corporateShareholder status (non-blocking)"
          );
        }

        try {
          await this.amlIdentityRepository.upsertMapping({
            organization_id: organizationId,
            organization_type: portalType,
            entity_type: "business_shareholder",
            business_name: businessName,
            cod_request_id: shareholderCodRequestId || null,
            kyb_id: kybId,
          });

          logger.info(
            {
              kybId,
              webhookOnboardingId: onboardingId,
              shareholderCodRequestId,
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
              shareholderCodRequestId,
              organizationId,
            },
            "[KYB Webhook] Failed to update AML identity mapping for business shareholder (non-blocking)"
          );
        }

        logger.info(
          {
            kybId,
            webhookOnboardingId: onboardingId,
            shareholderCodRequestId,
            organizationId,
            amlStatus,
          },
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

