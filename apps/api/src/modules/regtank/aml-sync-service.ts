import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import { AmlIdentityRepository } from "./aml-identity-repository";
import { getRegTankAPIClient } from "./api-client";
import { AMLFetcherService } from "./aml-fetcher";
import { OrganizationRepository } from "../organization/repository";

export interface DirectorAMLStatus {
  directors: Array<{
    kycId: string;
    name: string;
    email: string;
    role: string;
    amlStatus: "Unresolved" | "Approved" | "Rejected" | "Pending";
    amlMessageStatus: "DONE" | "PENDING" | "ERROR";
    amlRiskScore: number | null;
    amlRiskLevel: string | null;
    lastUpdated: string;
  }>;
  individualShareholders?: Array<{
    kycId: string;
    name: string;
    email: string;
    role: string;
    amlStatus: "Unresolved" | "Approved" | "Rejected" | "Pending";
    amlMessageStatus: "DONE" | "PENDING" | "ERROR";
    amlRiskScore: number | null;
    amlRiskLevel: string | null;
    lastUpdated: string;
  }>;
  businessShareholders?: Array<{
    codRequestId: string;
    kybId: string;
    businessName: string;
    sharePercentage?: number | null;
    amlStatus: "Unresolved" | "Approved" | "Rejected" | "Pending";
    amlMessageStatus: "DONE" | "PENDING" | "ERROR";
    amlRiskScore: number | null;
    amlRiskLevel: string | null;
    lastUpdated: string;
  }>;
  lastSyncedAt: string;
}

interface ExpectedEntity {
  entityType: "director" | "individual_shareholder" | "business_shareholder";
  name?: string;
  email?: string;
  businessName?: string;
  eodRequestId?: string;
  codRequestId?: string;
}

export class AMLSyncService {
  private amlIdentityRepository: AmlIdentityRepository;
  private apiClient: ReturnType<typeof getRegTankAPIClient>;
  private amlFetcherService: AMLFetcherService;
  private organizationRepository: OrganizationRepository;

  constructor() {
    this.amlIdentityRepository = new AmlIdentityRepository();
    this.apiClient = getRegTankAPIClient();
    this.amlFetcherService = new AMLFetcherService();
    this.organizationRepository = new OrganizationRepository();
  }

  /**
   * Sync AML status for an organization
   * Handles both existing entities with IDs and missing entities
   */
  async syncOrganizationAMLStatus(
    organizationId: string,
    organizationType: "investor" | "issuer"
  ): Promise<DirectorAMLStatus> {
    logger.info(
      { organizationId, organizationType },
      "[AML Sync] Starting AML status sync"
    );

    // 1. Get organization and COD request ID
    const org = await this.getOrganization(organizationId, organizationType);
    const codRequestId = await this.getCODRequestId(org);

    if (!codRequestId) {
      throw new Error("Organization does not have COD request ID");
    }

    // 2. Fetch parent COD to get expected directors/shareholders/business shareholders
    let parentCOD: any;
    try {
      parentCOD = await this.apiClient.getCorporateOnboardingDetails(codRequestId);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          codRequestId,
          organizationId,
        },
        "[AML Sync] Failed to fetch parent COD"
      );
      throw error;
    }

    const expectedEntities = this.extractExpectedEntities(parentCOD, codRequestId);

    // 3. Fetch existing mappings from database
    const existingMappings = await this.amlIdentityRepository.findByOrganization(organizationId);

    // 4. Compare expected vs existing - identify missing entities
    const missingEntities = this.identifyMissingEntities(expectedEntities, existingMappings);

    logger.info(
      {
        organizationId,
        codRequestId,
        expectedCount: expectedEntities.length,
        existingCount: existingMappings.length,
        missingCount: missingEntities.length,
      },
      "[AML Sync] Identified missing entities"
    );

    // 5. For entities with KYC/KYB IDs, query directly
    const directStatuses = await this.queryDirectStatuses(existingMappings);

    // 6. For entities without IDs OR completely missing entities, use fallback flow
    const fallbackStatuses = await this.fetchMissingStatuses(
      codRequestId,
      organizationId,
      organizationType
    );

    // 7. Merge statuses and handle duplicates
    const mergedStatuses = this.mergeDuplicates(directStatuses, fallbackStatuses);

    // 8. Update BOTH aml_identity_mapping AND director_aml_status JSON
    await this.updateDatabase(organizationId, organizationType, mergedStatuses);

    logger.info(
      {
        organizationId,
        codRequestId,
        totalStatuses: mergedStatuses.length,
        directorsCount: mergedStatuses.filter(s => s.entityType === "director").length,
        shareholdersCount: mergedStatuses.filter(s => s.entityType === "individual_shareholder").length,
        businessShareholdersCount: mergedStatuses.filter(s => s.entityType === "business_shareholder").length,
      },
      "[AML Sync] Completed AML status sync"
    );

    return this.formatDirectorAMLStatus(mergedStatuses);
  }

  private async getOrganization(organizationId: string, organizationType: "investor" | "issuer") {
    if (organizationType === "investor") {
      return await this.organizationRepository.findInvestorOrganizationById(organizationId);
    } else {
      return await this.organizationRepository.findIssuerOrganizationById(organizationId);
    }
  }

  private async getCODRequestId(org: any): Promise<string | null> {
    if (!org) return null;

    // Find COD onboarding record for this organization
    const onboarding = await prisma.regTankOnboarding.findFirst({
      where: {
        OR: [
          { investor_organization_id: org.id },
          { issuer_organization_id: org.id },
        ],
        onboarding_type: "CORPORATE",
      },
      orderBy: { created_at: "desc" },
    });

    return onboarding?.request_id || null;
  }

  private extractExpectedEntities(parentCOD: any, codRequestId: string): ExpectedEntity[] {
    const entities: ExpectedEntity[] = [];

    // Extract directors
    if (parentCOD.corpIndvDirectors && Array.isArray(parentCOD.corpIndvDirectors)) {
      for (const director of parentCOD.corpIndvDirectors) {
        const eodRequestId = director.corporateIndividualRequest?.requestId;
        const userInfo = director.corporateUserRequestInfo;
        const formContent = userInfo?.formContent?.content || [];
        const firstName = formContent.find((f: any) => f.fieldName === "First Name")?.fieldValue || "";
        const lastName = formContent.find((f: any) => f.fieldName === "Last Name")?.fieldValue || "";
        const email = formContent.find((f: any) => f.fieldName === "Email Address")?.fieldValue || userInfo?.email || null;
        const name = `${firstName} ${lastName}`.trim() || userInfo?.fullName || null;

        entities.push({
          entityType: "director",
          name: name || undefined,
          email: email || undefined,
          eodRequestId: eodRequestId || undefined,
          codRequestId,
        });
      }
    }

    // Extract individual shareholders
    if (parentCOD.corpIndvShareholders && Array.isArray(parentCOD.corpIndvShareholders)) {
      for (const shareholder of parentCOD.corpIndvShareholders) {
        const eodRequestId = shareholder.corporateIndividualRequest?.requestId;
        const userInfo = shareholder.corporateUserRequestInfo;
        const formContent = userInfo?.formContent?.content || [];
        const firstName = formContent.find((f: any) => f.fieldName === "First Name")?.fieldValue || "";
        const lastName = formContent.find((f: any) => f.fieldName === "Last Name")?.fieldValue || "";
        const email = formContent.find((f: any) => f.fieldName === "Email Address")?.fieldValue || userInfo?.email || null;
        const name = `${firstName} ${lastName}`.trim() || userInfo?.fullName || null;

        entities.push({
          entityType: "individual_shareholder",
          name: name || undefined,
          email: email || undefined,
          eodRequestId: eodRequestId || undefined,
          codRequestId,
        });
      }
    }

    // Extract business shareholders
    if (parentCOD.corpBizShareholders && Array.isArray(parentCOD.corpBizShareholders)) {
      for (const bizShareholder of parentCOD.corpBizShareholders) {
        const codRequestId = bizShareholder.requestId || bizShareholder.corporateOnboardingRequest?.requestId;
        const businessName = bizShareholder.businessName || bizShareholder.companyName || null;

        entities.push({
          entityType: "business_shareholder",
          businessName: businessName || undefined,
          codRequestId: codRequestId || undefined,
        });
      }
    }

    return entities;
  }

  private identifyMissingEntities(
    expectedEntities: ExpectedEntity[],
    existingMappings: any[]
  ): ExpectedEntity[] {
    const missing: ExpectedEntity[] = [];

    for (const expected of expectedEntities) {
      const exists = existingMappings.find(m => {
        if (expected.entityType === "business_shareholder") {
          return m.business_name === expected.businessName;
        } else {
          return m.name === expected.name && m.email === expected.email;
        }
      });

      if (!exists) {
        missing.push(expected);
      }
    }

    return missing;
  }

  private async queryDirectStatuses(mappings: any[]): Promise<any[]> {
    const statuses: any[] = [];

    // Query KYC statuses
    const kycMappings = mappings.filter(m => m.kyc_id);
    for (const mapping of kycMappings) {
      try {
        const kycResponse = await this.apiClient.queryKYCStatus(mapping.kyc_id);
        const kycStatusData = Array.isArray(kycResponse) ? kycResponse[0] : kycResponse;

        const amlStatus = this.mapKYCStatusToAML(kycStatusData?.status);
        const amlMessageStatus = (kycStatusData?.messageStatus || "PENDING") as "DONE" | "PENDING" | "ERROR";
        const amlRiskScore = kycStatusData?.individualRiskScore?.score 
          ? parseFloat(String(kycStatusData.individualRiskScore.score)) 
          : null;
        const amlRiskLevel = kycStatusData?.individualRiskScore?.level || null;

        statuses.push({
          entityType: mapping.entity_type,
          kycId: mapping.kyc_id,
          name: mapping.name,
          email: mapping.email,
          role: mapping.entity_type === "director" ? "Director" : "Shareholder",
          amlStatus,
          amlMessageStatus,
          amlRiskScore,
          amlRiskLevel,
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            kycId: mapping.kyc_id,
          },
          "[AML Sync] Failed to query KYC status (non-blocking)"
        );
      }
    }

    // Query KYB statuses
    const kybMappings = mappings.filter(m => m.kyb_id);
    for (const mapping of kybMappings) {
      try {
        const kybResponse = await this.apiClient.queryKYBStatus(mapping.kyb_id);
        const kybStatusData = Array.isArray(kybResponse) ? kybResponse[0] : kybResponse;

        const amlStatus = this.mapKYBStatusToAML(kybStatusData?.status);
        const amlMessageStatus = (kybStatusData?.messageStatus || "PENDING") as "DONE" | "PENDING" | "ERROR";
        const amlRiskScore = kybStatusData?.corporateRiskScore?.score 
          ? parseFloat(String(kybStatusData.corporateRiskScore.score)) 
          : null;
        const amlRiskLevel = kybStatusData?.corporateRiskScore?.level || null;

        statuses.push({
          entityType: mapping.entity_type,
          kybId: mapping.kyb_id,
          codRequestId: mapping.cod_request_id,
          businessName: mapping.business_name,
          sharePercentage: null, // Will be extracted from corporate_entities if needed
          amlStatus,
          amlMessageStatus,
          amlRiskScore,
          amlRiskLevel,
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            kybId: mapping.kyb_id,
          },
          "[AML Sync] Failed to query KYB status (non-blocking)"
        );
      }
    }

    return statuses;
  }

  private async fetchMissingStatuses(
    codRequestId: string,
    organizationId: string,
    organizationType: "investor" | "issuer"
  ): Promise<any[]> {
    const statuses: any[] = [];

    // Use existing aml-fetcher logic for COD → EOD → KYC/KYB flow
    try {
      // For Directors: COD → EOD → KYC
      const directorStatuses = await this.amlFetcherService.fetchIndividualDirectorAMLStatuses(
        codRequestId,
        organizationId,
        organizationType
      );

      // For Individual Shareholders: COD → EOD → KYC
      const shareholderStatuses = await this.amlFetcherService.fetchIndividualShareholderAMLStatuses(
        codRequestId,
        organizationId,
        organizationType
      );

      // For Business Shareholders: COD → Business COD → KYB
      const businessStatuses = await this.amlFetcherService.fetchBusinessShareholderAMLStatuses(
        codRequestId,
        organizationId,
        organizationType
      );

      // As we fetch, extract and store the IDs in mapping table
      // Directors and shareholders have entityType inferred from context
      for (const status of directorStatuses) {
        try {
          await this.amlIdentityRepository.upsertMapping({
            organization_id: organizationId,
            organization_type: organizationType,
            entity_type: "director",
            name: status.name,
            email: status.email,
            cod_request_id: codRequestId,
            eod_request_id: status.eodRequestId,
            kyc_id: status.kycId,
            last_synced_at: new Date(),
          });
        } catch (mappingError) {
          logger.warn(
            {
              error: mappingError instanceof Error ? mappingError.message : String(mappingError),
              organizationId,
              entityType: "director",
            },
            "[AML Sync] Failed to store director mapping (non-blocking)"
          );
        }

        statuses.push({ 
          ...status, 
          entityType: "director",
          codRequestId,
        });
      }

      for (const status of shareholderStatuses) {
        try {
          await this.amlIdentityRepository.upsertMapping({
            organization_id: organizationId,
            organization_type: organizationType,
            entity_type: "individual_shareholder",
            name: status.name,
            email: status.email,
            cod_request_id: codRequestId,
            eod_request_id: status.eodRequestId,
            kyc_id: status.kycId,
            last_synced_at: new Date(),
          });
        } catch (mappingError) {
          logger.warn(
            {
              error: mappingError instanceof Error ? mappingError.message : String(mappingError),
              organizationId,
              entityType: "individual_shareholder",
            },
            "[AML Sync] Failed to store shareholder mapping (non-blocking)"
          );
        }

        statuses.push({ 
          ...status, 
          entityType: "individual_shareholder",
          codRequestId,
        });
      }

      for (const status of businessStatuses) {
        try {
          await this.amlIdentityRepository.upsertMapping({
            organization_id: organizationId,
            organization_type: organizationType,
            entity_type: "business_shareholder",
            business_name: status.businessName,
            cod_request_id: status.codRequestId,
            kyb_id: status.kybId,
            last_synced_at: new Date(),
          });
        } catch (mappingError) {
          logger.warn(
            {
              error: mappingError instanceof Error ? mappingError.message : String(mappingError),
              organizationId,
              entityType: "business_shareholder",
            },
            "[AML Sync] Failed to store business shareholder mapping (non-blocking)"
          );
        }

        statuses.push({ 
          ...status, 
          entityType: "business_shareholder",
        });
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          codRequestId,
          organizationId,
        },
        "[AML Sync] Failed to fetch missing statuses"
      );
      // Don't throw - return what we have
    }

    return statuses;
  }

  private mergeDuplicates(directStatuses: any[], fallbackStatuses: any[]): any[] {
    const allStatuses = [...directStatuses, ...fallbackStatuses];

    // Group by name + email for individuals, businessName for business shareholders
    const grouped = new Map<string, any[]>();

    for (const status of allStatuses) {
      const key = status.entityType === "business_shareholder"
        ? `business:${status.businessName}`
        : `individual:${status.name}:${status.email}`;

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(status);
    }

    // For individuals appearing as both director and shareholder:
    // - Use the same kycId for both
    // - Include both roles in the response
    const merged: any[] = [];
    for (const [, statuses] of grouped.entries()) {
      if (statuses.length === 1) {
        merged.push(statuses[0]);
      } else {
        // Multiple roles for same person - merge with same kycId
        const kycId = statuses.find(s => s.kycId)?.kycId;
        for (const status of statuses) {
          merged.push({ ...status, kycId });
        }
      }
    }

    return merged;
  }

  private async updateDatabase(
    organizationId: string,
    organizationType: "investor" | "issuer",
    mergedStatuses: any[]
  ) {
    // Update director_aml_status JSON with latest AML statuses
    const directorAmlStatus = {
      directors: mergedStatuses.filter(s => s.entityType === "director").map(s => ({
        kycId: s.kycId,
        name: s.name,
        email: s.email,
        role: s.role || "Director",
        amlStatus: s.amlStatus,
        amlMessageStatus: s.amlMessageStatus,
        amlRiskScore: s.amlRiskScore,
        amlRiskLevel: s.amlRiskLevel,
        lastUpdated: s.lastUpdated,
      })),
      individualShareholders: mergedStatuses.filter(s => s.entityType === "individual_shareholder").map(s => ({
        kycId: s.kycId,
        name: s.name,
        email: s.email,
        role: s.role || "Shareholder",
        amlStatus: s.amlStatus,
        amlMessageStatus: s.amlMessageStatus,
        amlRiskScore: s.amlRiskScore,
        amlRiskLevel: s.amlRiskLevel,
        lastUpdated: s.lastUpdated,
      })),
      businessShareholders: mergedStatuses.filter(s => s.entityType === "business_shareholder").map(s => ({
        codRequestId: s.codRequestId,
        kybId: s.kybId,
        businessName: s.businessName,
        sharePercentage: s.sharePercentage,
        amlStatus: s.amlStatus,
        amlMessageStatus: s.amlMessageStatus,
        amlRiskScore: s.amlRiskScore,
        amlRiskLevel: s.amlRiskLevel,
        lastUpdated: s.lastUpdated,
      })),
      lastSyncedAt: new Date().toISOString(),
    };

    if (organizationType === "investor") {
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
  }

  private formatDirectorAMLStatus(mergedStatuses: any[]): DirectorAMLStatus {
    return {
      directors: mergedStatuses.filter(s => s.entityType === "director").map(s => ({
        kycId: s.kycId,
        name: s.name,
        email: s.email,
        role: s.role || "Director",
        amlStatus: s.amlStatus,
        amlMessageStatus: s.amlMessageStatus,
        amlRiskScore: s.amlRiskScore,
        amlRiskLevel: s.amlRiskLevel,
        lastUpdated: s.lastUpdated,
      })),
      individualShareholders: mergedStatuses.filter(s => s.entityType === "individual_shareholder").map(s => ({
        kycId: s.kycId,
        name: s.name,
        email: s.email,
        role: s.role || "Shareholder",
        amlStatus: s.amlStatus,
        amlMessageStatus: s.amlMessageStatus,
        amlRiskScore: s.amlRiskScore,
        amlRiskLevel: s.amlRiskLevel,
        lastUpdated: s.lastUpdated,
      })),
      businessShareholders: mergedStatuses.filter(s => s.entityType === "business_shareholder").map(s => ({
        codRequestId: s.codRequestId,
        kybId: s.kybId,
        businessName: s.businessName,
        sharePercentage: s.sharePercentage,
        amlStatus: s.amlStatus,
        amlMessageStatus: s.amlMessageStatus,
        amlRiskScore: s.amlRiskScore,
        amlRiskLevel: s.amlRiskLevel,
        lastUpdated: s.lastUpdated,
      })),
      lastSyncedAt: new Date().toISOString(),
    };
  }

  private mapKYCStatusToAML(status: string | undefined): "Unresolved" | "Approved" | "Rejected" | "Pending" {
    if (!status) return "Pending";
    const statusUpper = status.toUpperCase();
    if (statusUpper === "APPROVED" || statusUpper === "RISK ASSESSED") return "Approved";
    if (statusUpper === "REJECTED") return "Rejected";
    if (statusUpper === "UNRESOLVED" || statusUpper === "NO_MATCH") return "Unresolved";
    return "Pending";
  }

  private mapKYBStatusToAML(status: string | undefined): "Unresolved" | "Approved" | "Rejected" | "Pending" {
    if (!status) return "Pending";
    const statusUpper = status.toUpperCase();
    if (statusUpper === "APPROVED" || statusUpper === "RISK ASSESSED") return "Approved";
    if (statusUpper === "REJECTED") return "Rejected";
    if (statusUpper === "UNRESOLVED" || statusUpper === "NO_MATCH") return "Unresolved";
    return "Pending";
  }
}
