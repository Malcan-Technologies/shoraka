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
  sharePercentage?: number | null;
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
   * Helper function to retry querying KYB status with exponential backoff
   * RegTank may need time to process KYB requests, especially for business shareholders
   * When first entering AML stage, status is often "No Match" or "Unresolved"
   */
  private async queryKYBStatusWithRetry(
    kybId: string,
    maxRetries: number = 3,
    initialDelayMs: number = 3000
  ): Promise<any> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff: 3s, 6s, 12s
          const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
          logger.debug(
            { kybId, attempt: attempt + 1, maxRetries: maxRetries + 1, delayMs },
            "[AML Fetcher] Retrying KYB status query after delay"
          );
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        const response = await this.apiClient.queryKYBStatus(kybId);
        
        // Check if response has valid status (not empty or undefined)
        if (response && (response.status || response.messageStatus)) {
          logger.debug(
            { kybId, attempt: attempt + 1, status: response.status, messageStatus: response.messageStatus },
            "[AML Fetcher] Successfully queried KYB status"
          );
          return response;
        }
        
        // If response exists but status is not ready, log and retry
        if (attempt < maxRetries) {
          logger.debug(
            { kybId, attempt: attempt + 1, response },
            "[AML Fetcher] KYB status not ready yet, will retry"
          );
          lastError = new Error("KYB status not ready");
          continue;
        }
        
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(
          { kybId, attempt: attempt + 1, error: lastError.message },
          "[AML Fetcher] Error querying KYB status, will retry"
        );
        
        if (attempt === maxRetries) {
          throw lastError;
        }
      }
    }
    
    throw lastError || new Error("Failed to query KYB status after retries");
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

      // Step 2: Get organization to read corporate_entities and update director_aml_status
      const org = portalType === "investor"
        ? await prisma.investorOrganization.findUnique({
            where: { id: organizationId },
            select: { corporate_entities: true, director_aml_status: true },
          })
        : await prisma.issuerOrganization.findUnique({
            where: { id: organizationId },
            select: { corporate_entities: true, director_aml_status: true },
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

      // Get existing director_aml_status to update businessShareholders array
      let directorAmlStatus = (org.director_aml_status as any) || { directors: [], businessShareholders: [], lastSyncedAt: new Date().toISOString() };
      if (!directorAmlStatus.businessShareholders || !Array.isArray(directorAmlStatus.businessShareholders)) {
        directorAmlStatus.businessShareholders = [];
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

          // Step 7: Always fetch fresh AML status from KYB API with retry logic
          // RegTank may need time to process KYB requests, especially when first entering AML stage
          const kybStatusResponse = await this.queryKYBStatusWithRetry(extractedKybId);
          
          let amlStatus: "Unresolved" | "Approved" | "Rejected" | "Pending" = "Pending";
          const kybStatus = kybStatusResponse.status?.toUpperCase() || "";
          if (kybStatus === "APPROVED") {
            amlStatus = "Approved";
          } else if (kybStatus === "REJECTED") {
            amlStatus = "Rejected";
          } else if (kybStatus === "UNRESOLVED" || kybStatus === "NO_MATCH") {
            // "No Match" means screening is complete but no match found - treat similar to "Unresolved"
            // Both require admin review/action
            amlStatus = "Unresolved";
          }

          const amlMessageStatus = (kybStatusResponse.messageStatus || "PENDING") as "DONE" | "PENDING" | "ERROR";
          
          // Extract risk score and level from corporateRiskScore object if available
          let amlRiskScore: number | null = null;
          let amlRiskLevel: string | null = null;
          
          if (kybStatusResponse.corporateRiskScore) {
            amlRiskScore = kybStatusResponse.corporateRiskScore.score 
              ? parseFloat(String(kybStatusResponse.corporateRiskScore.score)) 
              : null;
            amlRiskLevel = kybStatusResponse.corporateRiskScore.level || null;
          } else {
            // Fallback to direct fields if corporateRiskScore object doesn't exist
            amlRiskScore = kybStatusResponse.riskScore ? parseFloat(String(kybStatusResponse.riskScore)) : null;
            amlRiskLevel = kybStatusResponse.riskLevel || null;
          }

          // Extract share percentage from corporate_entities for reference
          const sharePercentage = (shareholder as any).sharePercentage || 
            (shareholder as any).share_percentage || 
            (shareholder as any).formContent?.displayAreas?.[0]?.content?.find((f: any) => f.fieldName === "% of Shares")?.fieldValue || null;

          // Step 8: Create business shareholder AML status object
          const businessShareholderAmlStatus: BusinessShareholderAMLStatus = {
            codRequestId: shareholderCodRequestId,
            kybId: extractedKybId,
            businessName: (shareholder as any).businessName || (shareholder as any).name || "Unknown",
            sharePercentage: sharePercentage ? parseFloat(String(sharePercentage)) : null,
            amlStatus,
            amlMessageStatus,
            amlRiskScore,
            amlRiskLevel,
            lastUpdated: new Date().toISOString(),
          };

          // Step 9: Update or add to director_aml_status.businessShareholders[]
          const existingBusinessIndex = directorAmlStatus.businessShareholders.findIndex(
            (b: any) => (b.codRequestId === shareholderCodRequestId) || (b.kybId === extractedKybId)
          );

          if (existingBusinessIndex !== -1) {
            // Update existing entry
            directorAmlStatus.businessShareholders[existingBusinessIndex] = businessShareholderAmlStatus;
          } else {
            // Add new entry
            directorAmlStatus.businessShareholders.push(businessShareholderAmlStatus);
          }

          // Still keep kybId and kybRequestDto in corporate_entities for reference (but not kybAmlStatus)
          (shareholder as any).kybId = extractedKybId;
          if (kybRequestDto) {
            (shareholder as any).kybRequestDto = kybRequestDto;
          }

          amlStatuses.push(businessShareholderAmlStatus);

          logger.debug(
            { shareholderCodRequestId, kybId: extractedKybId, amlStatus, hadExistingStatus: existingBusinessIndex !== -1 },
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

      // Step 10: Update organization with both corporate_entities (for kybId/kybRequestDto) and director_aml_status (for AML status)
      if (amlStatuses.length > 0) {
        // Update director_aml_status with business shareholders
        directorAmlStatus.lastSyncedAt = new Date().toISOString();

        const updateData: {
          corporate_entities?: Prisma.InputJsonValue;
          director_aml_status?: Prisma.InputJsonValue;
        } = {};

        // Only update corporate_entities if we added/updated kybId or kybRequestDto
        const hasKybUpdates = corporateEntities.corporateShareholders.some((s: any) => 
          (s as any).kybId || (s as any).kybRequestDto
        );
        if (hasKybUpdates) {
          updateData.corporate_entities = corporateEntities as Prisma.InputJsonValue;
        }

        // Always update director_aml_status with business shareholders
        updateData.director_aml_status = directorAmlStatus as Prisma.InputJsonValue;

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

        logger.info(
          { codRequestId, count: amlStatuses.length },
          "[AML Fetcher] ✓ Updated business shareholders AML statuses in director_aml_status"
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
      let existingDirectorAmlStatus = (org.director_aml_status as any) || { 
        directors: [], 
        businessShareholders: [],
        lastSyncedAt: new Date().toISOString() 
      };
      if (!existingDirectorAmlStatus.directors || !Array.isArray(existingDirectorAmlStatus.directors)) {
        existingDirectorAmlStatus.directors = [];
      }
      if (!existingDirectorAmlStatus.businessShareholders || !Array.isArray(existingDirectorAmlStatus.businessShareholders)) {
        existingDirectorAmlStatus.businessShareholders = [];
      }

      // Merge business shareholders AML statuses (already updated in fetchBusinessShareholderAMLStatuses)
      // But we need to merge any new ones that were fetched
      for (const newBusinessAmlStatus of businessAmlStatuses) {
        const existingBusinessIndex = existingDirectorAmlStatus.businessShareholders.findIndex(
          (b: any) => (b.codRequestId === newBusinessAmlStatus.codRequestId) || (b.kybId === newBusinessAmlStatus.kybId)
        );

        if (existingBusinessIndex !== -1) {
          // Update existing entry
          existingDirectorAmlStatus.businessShareholders[existingBusinessIndex] = newBusinessAmlStatus;
        } else {
          // Add new entry
          existingDirectorAmlStatus.businessShareholders.push(newBusinessAmlStatus);
        }
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

      // Update organization with merged director_aml_status (includes both individuals and business shareholders)
      if (allIndividualAmlStatuses.length > 0 || businessAmlStatuses.length > 0) {
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
            totalBusinessShareholders: existingDirectorAmlStatus.businessShareholders.length,
          },
          "[AML Fetcher] ✓ Completed fetching and merging all AML statuses (individuals and business shareholders)"
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
