import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import { getRegTankAPIClient } from "./api-client";
import type { PortalType } from "./types";

interface DirectorAMLStatus {
  kycId: string;
  eodRequestId?: string;
  name: string;
  email: string;
  role: string;
  amlStatus: "Unresolved" | "Approved" | "Rejected" | "Pending";
  amlMessageStatus: "DONE" | "PENDING" | "ERROR";
  amlRiskScore: number | null;
  amlRiskLevel: string | null;
  lastUpdated: string;
}

interface BusinessShareholderAMLStatus {
  codRequestId: string;
  kybId: string;
  businessName: string;
  amlStatus: "Unresolved" | "Approved" | "Rejected" | "Pending";
  amlMessageStatus: "DONE" | "PENDING" | "ERROR";
  amlRiskScore: number | null;
  amlRiskLevel: string | null;
  lastUpdated: string;
}

/**
 * Service for fetching AML statuses for corporate onboarding entities
 * Handles fetching and storing AML statuses for:
 * - Individual directors
 * - Individual shareholders
 * - Business shareholders
 */
export class AMLFetcherService {
  private apiClient: ReturnType<typeof getRegTankAPIClient>;

  constructor() {
    this.apiClient = getRegTankAPIClient();
  }

  /**
   * Helper function to normalize name+email for matching
   */
  private normalizeKey(name: string, email: string): string {
    return `${(name || "").toLowerCase().trim()}|${(email || "").toLowerCase().trim()}`;
  }

  /**
   * Fetch AML statuses for individual directors
   * Flow: GET COD → extract corpIndvDirectors → GET EOD → extract kycRequestInfo → GET KYC status
   */
  async fetchIndividualDirectorAMLStatuses(
    codRequestId: string,
    organizationId: string,
    portalType: PortalType
  ): Promise<DirectorAMLStatus[]> {
    logger.info(
      { codRequestId, organizationId, portalType },
      "[AML Fetcher] Fetching individual director AML statuses"
    );

    const amlStatuses: DirectorAMLStatus[] = [];

    try {
      // Step 1: Get COD details
      const codDetails = await this.apiClient.getCorporateOnboardingDetails(codRequestId);
      
      if (!codDetails?.corpIndvDirectors || !Array.isArray(codDetails.corpIndvDirectors)) {
        logger.debug(
          { codRequestId },
          "[AML Fetcher] No individual directors found in COD details"
        );
        return amlStatuses;
      }

      // Step 2: Get organization to update director_kyc_status and director_aml_status
      const org = portalType === "investor"
        ? await prisma.investorOrganization.findUnique({
            where: { id: organizationId },
            select: { director_kyc_status: true, director_aml_status: true },
          })
        : await prisma.issuerOrganization.findUnique({
            where: { id: organizationId },
            select: { director_kyc_status: true, director_aml_status: true },
          });

      if (!org) {
        logger.warn(
          { organizationId, portalType },
          "[AML Fetcher] Organization not found"
        );
        return amlStatuses;
      }

      const directorKycStatus = (org.director_kyc_status as any) || { directors: [] };
      if (!directorKycStatus.directors || !Array.isArray(directorKycStatus.directors)) {
        directorKycStatus.directors = [];
      }

      // Step 3: Process each director
      for (const director of codDetails.corpIndvDirectors) {
        const eodRequestId = director.corporateIndividualRequest?.requestId || "";
        if (!eodRequestId) {
          logger.debug(
            { codRequestId },
            "[AML Fetcher] Director missing EOD requestId, skipping"
          );
          continue;
        }

        const userInfo = director.corporateUserRequestInfo;
        const formContent = userInfo?.formContent?.content || [];
        const firstName = formContent.find((f: any) => f.fieldName === "First Name")?.fieldValue || "";
        const lastName = formContent.find((f: any) => f.fieldName === "Last Name")?.fieldValue || "";
        const designation = formContent.find((f: any) => f.fieldName === "Designation")?.fieldValue || "";
        const email = formContent.find((f: any) => f.fieldName === "Email Address")?.fieldValue || userInfo?.email || "";
        const name = `${firstName} ${lastName}`.trim() || userInfo?.fullName || "";

        try {
          // Step 4: Get EOD details to extract kycRequestInfo
          const eodDetails = await this.apiClient.getEntityOnboardingDetails(eodRequestId);
          
          // Extract kycRequestInfo from EOD details
          const kycRequestInfo = eodDetails.kycRequestInfo || null;
          const kycId = kycRequestInfo?.kycId || director.kycRequestInfo?.kycId || null;

          if (!kycId) {
            logger.debug(
              { eodRequestId, name, codRequestId },
              "[AML Fetcher] Director missing kycId, skipping AML fetch"
            );
            continue;
          }

          // Step 5: Update director_kyc_status with kycRequestInfo
          const mapKey = this.normalizeKey(name, email);
          const existingDirectorIndex = directorKycStatus.directors.findIndex(
            (d: any) => d.eodRequestId === eodRequestId || this.normalizeKey(d.name, d.email) === mapKey
          );

          if (existingDirectorIndex !== -1) {
            // Update existing director with kycRequestInfo
            directorKycStatus.directors[existingDirectorIndex] = {
              ...directorKycStatus.directors[existingDirectorIndex],
              kycId,
              kycRequestInfo: kycRequestInfo || undefined,
              lastUpdated: new Date().toISOString(),
            };
          } else {
            // Add new director entry
            directorKycStatus.directors.push({
              eodRequestId,
              name,
              email,
              role: designation || "Director",
              kycStatus: director.corporateIndividualRequest?.status || "PENDING",
              kycId,
              kycRequestInfo: kycRequestInfo || undefined,
              lastUpdated: new Date().toISOString(),
            });
          }

          // Step 6: Fetch AML status from KYC API
          const kycStatusResponse = await this.apiClient.queryKYCStatus(kycId);
          const kycStatusData = Array.isArray(kycStatusResponse) ? kycStatusResponse[0] : kycStatusResponse;

          // Map RegTank status to AML status
          let amlStatus: "Unresolved" | "Approved" | "Rejected" | "Pending" = "Pending";
          const regTankStatus = kycStatusData?.status?.toUpperCase() || "";
          if (regTankStatus === "APPROVED") {
            amlStatus = "Approved";
          } else if (regTankStatus === "REJECTED") {
            amlStatus = "Rejected";
          } else if (regTankStatus === "UNRESOLVED") {
            amlStatus = "Unresolved";
          }

          const amlMessageStatus = (kycStatusData?.messageStatus || "PENDING") as "DONE" | "PENDING" | "ERROR";
          const amlRiskScore = kycStatusData?.riskScore ? parseFloat(String(kycStatusData.riskScore)) : null;
          const amlRiskLevel = kycStatusData?.riskLevel || null;

          amlStatuses.push({
            kycId,
            eodRequestId,
            name,
            email,
            role: designation || "Director",
            amlStatus,
            amlMessageStatus,
            amlRiskScore,
            amlRiskLevel,
            lastUpdated: new Date().toISOString(),
          });

          logger.debug(
            { eodRequestId, kycId, name, amlStatus },
            "[AML Fetcher] ✓ Fetched director AML status"
          );
        } catch (error) {
          logger.warn(
            {
              error: error instanceof Error ? error.message : String(error),
              eodRequestId,
              name,
              codRequestId,
            },
            "[AML Fetcher] Failed to fetch director AML status (non-blocking)"
          );
        }
      }

      // Step 7: Update organization with director_kyc_status
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

      logger.info(
        { codRequestId, count: amlStatuses.length },
        "[AML Fetcher] ✓ Completed fetching individual director AML statuses"
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          codRequestId,
          organizationId,
        },
        "[AML Fetcher] Failed to fetch individual director AML statuses"
      );
    }

    return amlStatuses;
  }

  /**
   * Fetch AML statuses for individual shareholders
   * Flow: GET COD → extract corpIndvShareholders → GET EOD → extract kycRequestInfo → GET KYC status
   */
  async fetchIndividualShareholderAMLStatuses(
    codRequestId: string,
    organizationId: string,
    portalType: PortalType
  ): Promise<DirectorAMLStatus[]> {
    logger.info(
      { codRequestId, organizationId, portalType },
      "[AML Fetcher] Fetching individual shareholder AML statuses"
    );

    const amlStatuses: DirectorAMLStatus[] = [];

    try {
      // Step 1: Get COD details
      const codDetails = await this.apiClient.getCorporateOnboardingDetails(codRequestId);
      
      if (!codDetails?.corpIndvShareholders || !Array.isArray(codDetails.corpIndvShareholders)) {
        logger.debug(
          { codRequestId },
          "[AML Fetcher] No individual shareholders found in COD details"
        );
        return amlStatuses;
      }

      // Step 2: Get organization to update director_kyc_status and director_aml_status
      const org = portalType === "investor"
        ? await prisma.investorOrganization.findUnique({
            where: { id: organizationId },
            select: { director_kyc_status: true, director_aml_status: true },
          })
        : await prisma.issuerOrganization.findUnique({
            where: { id: organizationId },
            select: { director_kyc_status: true, director_aml_status: true },
          });

      if (!org) {
        logger.warn(
          { organizationId, portalType },
          "[AML Fetcher] Organization not found"
        );
        return amlStatuses;
      }

      const directorKycStatus = (org.director_kyc_status as any) || { directors: [] };
      if (!directorKycStatus.directors || !Array.isArray(directorKycStatus.directors)) {
        directorKycStatus.directors = [];
      }

      // Step 3: Process each shareholder
      for (const shareholder of codDetails.corpIndvShareholders) {
        const eodRequestId = shareholder.corporateIndividualRequest?.requestId || "";
        if (!eodRequestId) {
          logger.debug(
            { codRequestId },
            "[AML Fetcher] Shareholder missing EOD requestId, skipping"
          );
          continue;
        }

        const userInfo = shareholder.corporateUserRequestInfo;
        const formContent = userInfo?.formContent?.content || [];
        const firstName = formContent.find((f: any) => f.fieldName === "First Name")?.fieldValue || "";
        const lastName = formContent.find((f: any) => f.fieldName === "Last Name")?.fieldValue || "";
        const sharePercent = formContent.find((f: any) => f.fieldName === "% of Shares")?.fieldValue || "";
        const email = formContent.find((f: any) => f.fieldName === "Email Address")?.fieldValue || userInfo?.email || "";
        const name = `${firstName} ${lastName}`.trim() || userInfo?.fullName || "";
        const role = `Shareholder${sharePercent ? ` (${sharePercent}%)` : ""}`;

        try {
          // Step 4: Get EOD details to extract kycRequestInfo
          const eodDetails = await this.apiClient.getEntityOnboardingDetails(eodRequestId);
          
          // Extract kycRequestInfo from EOD details
          const kycRequestInfo = eodDetails.kycRequestInfo || null;
          const kycId = kycRequestInfo?.kycId || shareholder.kycRequestInfo?.kycId || null;

          if (!kycId) {
            logger.debug(
              { eodRequestId, name, codRequestId },
              "[AML Fetcher] Shareholder missing kycId, skipping AML fetch"
            );
            continue;
          }

          // Step 5: Update director_kyc_status with kycRequestInfo
          // Check if person is already a director (merge roles)
          const mapKey = this.normalizeKey(name, email);
          const existingDirectorIndex = directorKycStatus.directors.findIndex(
            (d: any) => d.eodRequestId === eodRequestId || this.normalizeKey(d.name, d.email) === mapKey
          );

          if (existingDirectorIndex !== -1) {
            // Person is both director and shareholder - merge roles
            const existing = directorKycStatus.directors[existingDirectorIndex];
            directorKycStatus.directors[existingDirectorIndex] = {
              ...existing,
              role: `${existing.role}, ${role}`,
              shareholderEodRequestId: eodRequestId,
              kycId: existing.kycId || kycId,
              kycRequestInfo: existing.kycRequestInfo || kycRequestInfo || undefined,
              lastUpdated: new Date().toISOString(),
            };
          } else {
            // Add new shareholder entry
            directorKycStatus.directors.push({
              eodRequestId,
              name,
              email,
              role,
              kycStatus: shareholder.corporateIndividualRequest?.status || "PENDING",
              kycId,
              kycRequestInfo: kycRequestInfo || undefined,
              lastUpdated: new Date().toISOString(),
            });
          }

          // Step 6: Fetch AML status from KYC API
          const kycStatusResponse = await this.apiClient.queryKYCStatus(kycId);
          const kycStatusData = Array.isArray(kycStatusResponse) ? kycStatusResponse[0] : kycStatusResponse;

          // Map RegTank status to AML status
          let amlStatus: "Unresolved" | "Approved" | "Rejected" | "Pending" = "Pending";
          const regTankStatus = kycStatusData?.status?.toUpperCase() || "";
          if (regTankStatus === "APPROVED") {
            amlStatus = "Approved";
          } else if (regTankStatus === "REJECTED") {
            amlStatus = "Rejected";
          } else if (regTankStatus === "UNRESOLVED") {
            amlStatus = "Unresolved";
          }

          const amlMessageStatus = (kycStatusData?.messageStatus || "PENDING") as "DONE" | "PENDING" | "ERROR";
          const amlRiskScore = kycStatusData?.riskScore ? parseFloat(String(kycStatusData.riskScore)) : null;
          const amlRiskLevel = kycStatusData?.riskLevel || null;

          amlStatuses.push({
            kycId,
            eodRequestId,
            name,
            email,
            role,
            amlStatus,
            amlMessageStatus,
            amlRiskScore,
            amlRiskLevel,
            lastUpdated: new Date().toISOString(),
          });

          logger.debug(
            { eodRequestId, kycId, name, amlStatus },
            "[AML Fetcher] ✓ Fetched shareholder AML status"
          );
        } catch (error) {
          logger.warn(
            {
              error: error instanceof Error ? error.message : String(error),
              eodRequestId,
              name,
              codRequestId,
            },
            "[AML Fetcher] Failed to fetch shareholder AML status (non-blocking)"
          );
        }
      }

      // Step 7: Update organization with director_kyc_status
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

      logger.info(
        { codRequestId, count: amlStatuses.length },
        "[AML Fetcher] ✓ Completed fetching individual shareholder AML statuses"
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          codRequestId,
          organizationId,
        },
        "[AML Fetcher] Failed to fetch individual shareholder AML statuses"
      );
    }

    return amlStatuses;
  }

  /**
   * Fetch AML statuses for business shareholders
   * Flow: GET COD → extract corpBizShareholders → GET each COD → extract kybRequestDto → GET KYB status
   */
  async fetchBusinessShareholderAMLStatuses(
    codRequestId: string,
    organizationId: string,
    portalType: PortalType
  ): Promise<BusinessShareholderAMLStatus[]> {
    logger.info(
      { codRequestId, organizationId, portalType },
      "[AML Fetcher] Fetching business shareholder AML statuses"
    );

    const amlStatuses: BusinessShareholderAMLStatus[] = [];

    try {
      // Step 1: Get COD details for main company
      const codDetails = await this.apiClient.getCorporateOnboardingDetails(codRequestId);
      
      if (!codDetails?.corpBizShareholders || !Array.isArray(codDetails.corpBizShareholders)) {
        logger.debug(
          { codRequestId },
          "[AML Fetcher] No business shareholders found in COD details"
        );
        return amlStatuses;
      }

      // Step 2: Get organization to update corporate_entities
      const org = portalType === "investor"
        ? await prisma.investorOrganization.findUnique({
            where: { id: organizationId },
            select: { corporate_entities: true },
          })
        : await prisma.issuerOrganization.findUnique({
            where: { id: organizationId },
            select: { corporate_entities: true },
          });

      if (!org || !org.corporate_entities) {
        logger.warn(
          { organizationId, portalType },
          "[AML Fetcher] Organization or corporate_entities not found"
        );
        return amlStatuses;
      }

      const corporateEntities = org.corporate_entities as any;
      if (!corporateEntities.corporateShareholders || !Array.isArray(corporateEntities.corporateShareholders)) {
        logger.debug(
          { organizationId },
          "[AML Fetcher] No corporate shareholders in corporate_entities"
        );
        return amlStatuses;
      }

      // Step 3: Process each business shareholder
      for (const codShareholder of codDetails.corpBizShareholders) {
        const shareholderCodRequestId = codShareholder.corporateOnboardingRequest?.requestId || codShareholder.requestId || null;
        if (!shareholderCodRequestId) {
          logger.debug(
            { codRequestId },
            "[AML Fetcher] Business shareholder missing COD requestId, skipping"
          );
          continue;
        }

        // Find matching shareholder in corporate_entities
        const shareholderIndex = corporateEntities.corporateShareholders.findIndex(
          (s: any) => (s.corporateOnboardingRequest?.requestId || s.requestId) === shareholderCodRequestId
        );

        if (shareholderIndex === -1) {
          logger.debug(
            { shareholderCodRequestId, codRequestId },
            "[AML Fetcher] Business shareholder not found in corporate_entities"
          );
          continue;
        }

        const shareholder = corporateEntities.corporateShareholders[shareholderIndex];

        // Use existing kybId if available, otherwise extract from COD
        let extractedKybId: string | null = (shareholder as any).kybId || null;
        let kybRequestDto: any = (shareholder as any).kybRequestDto || null;

        try {
          // If we don't have kybId, get COD details and extract it
          if (!extractedKybId) {
            // Step 4: Get COD details for this business shareholder
            const shareholderCodDetails = await this.apiClient.getCorporateOnboardingDetails(shareholderCodRequestId);
            
            // Step 5: Extract kybId from kybRequestDto
            if (shareholderCodDetails && typeof shareholderCodDetails === "object" && !Array.isArray(shareholderCodDetails)) {
              const codDetailsObj = shareholderCodDetails as Record<string, unknown>;
              
              // Try kybRequestDto first
              if (codDetailsObj.kybRequestDto && typeof codDetailsObj.kybRequestDto === "object" && !Array.isArray(codDetailsObj.kybRequestDto)) {
                kybRequestDto = codDetailsObj.kybRequestDto;
                const kybDto = kybRequestDto as Record<string, unknown>;
                if (kybDto.kybId && typeof kybDto.kybId === "string") {
                  extractedKybId = kybDto.kybId;
                }
              }
              
              // Fallback: try direct kybId field
              if (!extractedKybId && codDetailsObj.kybId && typeof codDetailsObj.kybId === "string") {
                extractedKybId = codDetailsObj.kybId;
              }
            }

            if (!extractedKybId) {
              logger.warn(
                { shareholderCodRequestId, codRequestId },
                "[AML Fetcher] KYB ID not found in business shareholder COD details or existing data"
              );
              continue;
            }

            // Step 6: Store kybId and kybRequestDto in corporate_entities
            (shareholder as any).kybId = extractedKybId;
            if (kybRequestDto) {
              (shareholder as any).kybRequestDto = kybRequestDto;
            }
          }

          // Step 7: Always fetch fresh AML status from KYB API
          const kybStatusResponse = await this.apiClient.queryKYBStatus(extractedKybId);
          
          let amlStatus: "Unresolved" | "Approved" | "Rejected" | "Pending" = "Pending";
          const kybStatus = kybStatusResponse.status?.toUpperCase() || "";
          if (kybStatus === "APPROVED") {
            amlStatus = "Approved";
          } else if (kybStatus === "REJECTED") {
            amlStatus = "Rejected";
          } else if (kybStatus === "UNRESOLVED") {
            amlStatus = "Unresolved";
          }

          const amlMessageStatus = (kybStatusResponse.messageStatus || "PENDING") as "DONE" | "PENDING" | "ERROR";
          const amlRiskScore = kybStatusResponse.riskScore ? parseFloat(String(kybStatusResponse.riskScore)) : null;
          const amlRiskLevel = kybStatusResponse.riskLevel || null;

          // Step 8: Update shareholder with fresh AML status (always update, even if status exists)
          const hadExistingStatus = !!(shareholder as any).kybAmlStatus;
          (shareholder as any).kybAmlStatus = {
            status: amlStatus,
            messageStatus: amlMessageStatus,
            riskScore: amlRiskScore,
            riskLevel: amlRiskLevel,
            lastUpdated: new Date().toISOString(),
          };

          amlStatuses.push({
            codRequestId: shareholderCodRequestId,
            kybId: extractedKybId,
            businessName: (shareholder as any).businessName || (shareholder as any).name || "Unknown",
            amlStatus,
            amlMessageStatus,
            amlRiskScore,
            amlRiskLevel,
            lastUpdated: new Date().toISOString(),
          });

          logger.debug(
            { shareholderCodRequestId, kybId: extractedKybId, amlStatus, hadExistingStatus },
            "[AML Fetcher] ✓ Fetched/refreshed business shareholder KYB AML status"
          );
        } catch (error) {
          logger.warn(
            {
              error: error instanceof Error ? error.message : String(error),
              shareholderCodRequestId,
              codRequestId,
            },
            "[AML Fetcher] Failed to fetch business shareholder KYB AML status (non-blocking)"
          );
        }
      }

      // Step 9: Update organization with corporate_entities
      // We always push to amlStatuses after processing, so this will be > 0 if we processed any shareholders
      if (amlStatuses.length > 0) {
        if (portalType === "investor") {
          await prisma.investorOrganization.update({
            where: { id: organizationId },
            data: {
              corporate_entities: corporateEntities as Prisma.InputJsonValue,
            },
          });
        } else {
          await prisma.issuerOrganization.update({
            where: { id: organizationId },
            data: {
              corporate_entities: corporateEntities as Prisma.InputJsonValue,
            },
          });
        }

        logger.info(
          { codRequestId, count: amlStatuses.length },
          "[AML Fetcher] ✓ Updated business shareholders with KYB AML statuses"
        );
      }

      logger.info(
        { codRequestId, count: amlStatuses.length },
        "[AML Fetcher] ✓ Completed fetching business shareholder AML statuses"
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          codRequestId,
          organizationId,
        },
        "[AML Fetcher] Failed to fetch business shareholder AML statuses"
      );
    }

    return amlStatuses;
  }

  /**
   * Orchestrate fetching all AML statuses (directors, shareholders, business shareholders)
   * and merge with existing director_aml_status
   */
  async fetchAllAMLStatuses(
    codRequestId: string,
    organizationId: string,
    portalType: PortalType
  ): Promise<void> {
    logger.info(
      { codRequestId, organizationId, portalType },
      "[AML Fetcher] Starting to fetch all AML statuses"
    );

    try {
      // Fetch all AML statuses in parallel
      const [directorAmlStatuses, shareholderAmlStatuses, businessAmlStatuses] = await Promise.all([
        this.fetchIndividualDirectorAMLStatuses(codRequestId, organizationId, portalType),
        this.fetchIndividualShareholderAMLStatuses(codRequestId, organizationId, portalType),
        this.fetchBusinessShareholderAMLStatuses(codRequestId, organizationId, portalType),
      ]);

      // Merge director and shareholder AML statuses (they go into the same director_aml_status array)
      const allIndividualAmlStatuses = [...directorAmlStatuses, ...shareholderAmlStatuses];

      // Get existing director_aml_status to merge with
      const org = portalType === "investor"
        ? await prisma.investorOrganization.findUnique({
            where: { id: organizationId },
            select: { director_aml_status: true },
          })
        : await prisma.issuerOrganization.findUnique({
            where: { id: organizationId },
            select: { director_aml_status: true },
          });

      if (!org) {
        logger.warn(
          { organizationId, portalType },
          "[AML Fetcher] Organization not found for merging AML statuses"
        );
        return;
      }

      // Merge new AML statuses with existing ones
      let existingDirectorAmlStatus = (org.director_aml_status as any) || { directors: [], lastSyncedAt: new Date().toISOString() };
      if (!existingDirectorAmlStatus.directors || !Array.isArray(existingDirectorAmlStatus.directors)) {
        existingDirectorAmlStatus.directors = [];
      }

      // Create a map of existing AML statuses by kycId and eodRequestId
      const existingAmlMap = new Map<string, any>();
      for (const existing of existingDirectorAmlStatus.directors) {
        const key = existing.kycId || existing.eodRequestId || `${existing.name}|${existing.email}`;
        existingAmlMap.set(key, existing);
      }

      // Merge new AML statuses
      for (const newAmlStatus of allIndividualAmlStatuses) {
        const existingIndex = existingDirectorAmlStatus.directors.findIndex(
          (d: any) => (d.kycId && d.kycId === newAmlStatus.kycId) || 
                      (d.eodRequestId && d.eodRequestId === newAmlStatus.eodRequestId) ||
                      (d.name === newAmlStatus.name && d.email === newAmlStatus.email)
        );

        if (existingIndex !== -1) {
          // Update existing entry
          existingDirectorAmlStatus.directors[existingIndex] = newAmlStatus;
        } else {
          // Add new entry
          existingDirectorAmlStatus.directors.push(newAmlStatus);
        }
      }

      // Update lastSyncedAt
      existingDirectorAmlStatus.lastSyncedAt = new Date().toISOString();

      // Update organization with merged director_aml_status
      if (allIndividualAmlStatuses.length > 0) {
        if (portalType === "investor") {
          await prisma.investorOrganization.update({
            where: { id: organizationId },
            data: {
              director_aml_status: existingDirectorAmlStatus as Prisma.InputJsonValue,
            },
          });
        } else {
          await prisma.issuerOrganization.update({
            where: { id: organizationId },
            data: {
              director_aml_status: existingDirectorAmlStatus as Prisma.InputJsonValue,
            },
          });
        }

        logger.info(
          {
            codRequestId,
            organizationId,
            directorCount: directorAmlStatuses.length,
            shareholderCount: shareholderAmlStatuses.length,
            businessCount: businessAmlStatuses.length,
          },
          "[AML Fetcher] ✓ Completed fetching and merging all AML statuses"
        );
      } else {
        logger.info(
          { codRequestId, organizationId },
          "[AML Fetcher] No new AML statuses to merge"
        );
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          codRequestId,
          organizationId,
          portalType,
        },
        "[AML Fetcher] Failed to fetch all AML statuses"
      );
      throw error;
    }
  }
}
