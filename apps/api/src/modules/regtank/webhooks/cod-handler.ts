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
        
        // Helper function to normalize name+email for duplicate detection
        const normalizeKey = (name: string, email: string): string => {
          return `${(name || "").toLowerCase().trim()}|${(email || "").toLowerCase().trim()}`;
        };

        // Extract Banking Details (Operational Information)
        const extractBankingDetails = (codDetails: any) => {
          const operationalInfo = codDetails.formContent?.displayAreas?.find(
            (area: any) => area.displayArea === "Operational Information"
          );
          
          if (!operationalInfo) return null;
          
          const content = operationalInfo.content || [];
          return {
            bank: content.find((f: any) => f.fieldName === "Bank")?.fieldValue || null,
            accountNumber: content.find((f: any) => f.fieldName === "Bank account number")?.fieldValue || null,
            accountType: content.find((f: any) => f.fieldName === "Account type")?.fieldValue || null,
          };
        };

        // Extract Transaction Information
        const extractTransactionInfo = (codDetails: any) => {
          const transactionInfo = codDetails.formContent?.displayAreas?.find(
            (area: any) => area.displayArea === "Transaction Information"
          );
          
          if (!transactionInfo) return null;
          
          const content = transactionInfo.content || [];
          return {
            sourceOfFunds: content.find((f: any) => f.fieldName === "Source of funds")?.fieldValue || null,
            sourceOfFundsOther: content.find((f: any) => f.fieldName?.includes("Others"))?.fieldValue || null,
            netAssetValue: content.find((f: any) => f.fieldName === "Net asset value (RM)")?.fieldValue || null,
          };
        };

        // Extract Beneficiary Account Information
        const extractBeneficiaryInfo = (codDetails: any) => {
          const beneficiaryInfo = codDetails.formContent?.displayAreas?.find(
            (area: any) => area.displayArea === "Beneficiary Account Information"
          );
          
          if (!beneficiaryInfo) return null;
          
          const content = beneficiaryInfo.content || [];
          return {
            pepStatus: content.find((f: any) => f.fieldName?.includes("PEP"))?.fieldValue || null,
            belongsToGroups: content.find((f: any) => f.fieldName?.includes("belong to any"))?.fieldValue || null,
          };
        };

        // Extract Corporate Onboarding Data
        const extractCorporateOnboardingData = (codDetails: any) => {
          const basicInfoArea = codDetails.formContent?.displayAreas?.find(
            (area: any) => area.displayArea === "Basic Information Setting"
          );
          
          const basicContent = basicInfoArea?.content || [];
          
          // Extract basic info
          const basicInfo = {
            businessName: basicContent.find((f: any) => f.fieldName === "Business Name")?.fieldValue || null,
            entityType: basicContent.find((f: any) => f.fieldName === "Type of Entity")?.fieldValue || null,
            ssmRegistrationNumber: basicContent.find((f: any) => f.fieldName === "New SSM registration number")?.fieldValue || null,
            tin: basicContent.find((f: any) => f.fieldName === "TIN")?.fieldValue || null,
            industry: basicContent.find((f: any) => f.fieldName === "Industry")?.fieldValue || null,
            numberOfEmployees: basicContent.find((f: any) => f.fieldName === "Number of employees")?.fieldValue || null,
          };
          
          // Extract entity criteria
          const entityCriteria = {
            publicCompanyCriteria: basicContent.find((f: any) => f.fieldName === "Public Company Criteria: ")?.fieldValue || null,
            trustCompanyCriteria: basicContent.find((f: any) => f.fieldName === "Trust Company Criteria: ")?.fieldValue || null,
            privateLimitedCriteria: basicContent.find((f: any) => f.fieldName?.includes("Private Limited"))?.fieldValue || null,
            partnershipCriteria: basicContent.find((f: any) => f.fieldName?.includes("Partnership"))?.fieldValue || null,
            statutoryBodyCriteria: basicContent.find((f: any) => f.fieldName?.includes("Statutory Body"))?.fieldValue || null,
            pensionFundCriteria: basicContent.find((f: any) => f.fieldName?.includes("Pension Fund"))?.fieldValue || null,
          };
          
          // Extract addresses
          const addresses = {
            business: {
              line1: basicContent.find((f: any) => f.fieldName === "Address (line 1)")?.fieldValue || null,
              line2: basicContent.find((f: any) => f.fieldName === "Address (line 2)")?.fieldValue || null,
              city: basicContent.find((f: any) => f.fieldName === "City")?.fieldValue || null,
              postalCode: basicContent.find((f: any) => f.fieldName === "Postal code")?.fieldValue || null,
              state: basicContent.find((f: any) => f.fieldName === "State")?.fieldValue || null,
              country: basicContent.find((f: any) => f.fieldName === "Country")?.fieldValue || null,
            },
            registered: {
              line1: basicContent.find((f: any) => f.fieldName === "Address line 1 (Registered Address)")?.fieldValue || null,
              line2: basicContent.find((f: any) => f.fieldName === "Address line 2 (Registered Address)")?.fieldValue || null,
              city: basicContent.find((f: any) => f.fieldName === "City (Registered Address)")?.fieldValue || null,
              postalCode: basicContent.find((f: any) => f.fieldName === "Postal code (Registered Address)")?.fieldValue || null,
              state: basicContent.find((f: any) => f.fieldName === "State (Registered Address)")?.fieldValue || null,
              country: basicContent.find((f: any) => f.fieldName === "Country (Registered Address)")?.fieldValue || null,
            },
          };
          
          return {
            basicInfo,
            entityCriteria,
            addresses,
          };
        };

        // Extract Required Documents
        const extractRequiredDocuments = (codDetails: any) => {
          const documentsArea = codDetails.formContent?.displayAreas?.find(
            (area: any) => area.displayArea === "Required Documents"
          );
          
          if (!documentsArea) return null;
          
          const requiredDocuments = (documentsArea.content || []).map((doc: any) => ({
            fieldName: doc.fieldName || null,
            fileName: doc.fileName || null,
            fileType: doc.fileType || null,
            url: doc.fieldValue || null,
          }));
          
          return requiredDocuments;
        };

        // Extract full entity details for corporate_entities
        const extractCorporateEntities = (codDetails: any) => {
          const directors = (codDetails.corpIndvDirectors || []).map((director: any) => ({
            eodRequestId: director.corporateIndividualRequest?.requestId || null,
            personalInfo: {
              firstName: director.corporateUserRequestInfo?.firstName || null,
              lastName: director.corporateUserRequestInfo?.lastName || null,
              middleName: director.corporateUserRequestInfo?.middleName || null,
              fullName: director.corporateUserRequestInfo?.fullName || null,
              email: director.corporateUserRequestInfo?.email || null,
              formContent: director.corporateUserRequestInfo?.formContent || null,
            },
            documents: {
              documentType: director.corporateDocumentInfo?.documentType || null,
              countryCode: director.corporateDocumentInfo?.countryCode || null,
              ocrStatus: director.corporateDocumentInfo?.ocrStatus || null,
              frontDocumentUrl: director.corporateDocumentInfo?.frontDocumentUrl || null,
              backDocumentUrl: director.corporateDocumentInfo?.backDocumentUrl || null,
            },
            status: director.corporateIndividualRequest?.status || null,
            approveStatus: director.corporateIndividualRequest?.approveStatus || null,
            kycType: director.corporateIndividualRequest?.kycType || null,
            createdDate: director.corporateIndividualRequest?.createdDate || null,
            updatedDate: director.corporateIndividualRequest?.updatedDate || null,
          }));
          
          const shareholders = (codDetails.corpIndvShareholders || []).map((shareholder: any) => ({
            eodRequestId: shareholder.corporateIndividualRequest?.requestId || null,
            personalInfo: {
              firstName: shareholder.corporateUserRequestInfo?.firstName || null,
              lastName: shareholder.corporateUserRequestInfo?.lastName || null,
              middleName: shareholder.corporateUserRequestInfo?.middleName || null,
              fullName: shareholder.corporateUserRequestInfo?.fullName || null,
              email: shareholder.corporateUserRequestInfo?.email || null,
              formContent: shareholder.corporateUserRequestInfo?.formContent || null,
            },
            documents: {
              documentType: shareholder.corporateDocumentInfo?.documentType || null,
              countryCode: shareholder.corporateDocumentInfo?.countryCode || null,
              ocrStatus: shareholder.corporateDocumentInfo?.ocrStatus || null,
              frontDocumentUrl: shareholder.corporateDocumentInfo?.frontDocumentUrl || null,
              backDocumentUrl: shareholder.corporateDocumentInfo?.backDocumentUrl || null,
            },
            status: shareholder.corporateIndividualRequest?.status || null,
            approveStatus: shareholder.corporateIndividualRequest?.approveStatus || null,
            kycType: shareholder.corporateIndividualRequest?.kycType || null,
            createdDate: shareholder.corporateIndividualRequest?.createdDate || null,
            updatedDate: shareholder.corporateIndividualRequest?.updatedDate || null,
          }));
          
          const corporateShareholders = (codDetails.corpBizShareholders || []).map((corpShareholder: any) => ({
            // Extract corporate shareholder details if available
            ...corpShareholder,
          }));
          
          return {
            directors,
            shareholders,
            corporateShareholders,
          };
        };
        
        // Extract director information from COD details
        // Use a Map to deduplicate by normalized name+email and merge roles for people who are both directors and shareholders
        const directorsMap = new Map<string, {
          eodRequestId: string; // Keep director EOD ID as primary
          shareholderEodRequestId?: string; // Track shareholder EOD ID if different
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
            const name = `${firstName} ${lastName}`.trim() || userInfo?.fullName || "";
            
            const mapKey = normalizeKey(name, email);
            
            // Fetch EOD details to get latest KYC status and kycId
            let kycStatus = director.corporateIndividualRequest?.status || "PENDING";
            let kycId = director.kycRequestInfo?.kycId;
            
            if (eodRequestId) {
              try {
                const eodDetails = await this.apiClient.getEntityOnboardingDetails(eodRequestId);
                const eodStatus = eodDetails.corporateIndividualRequest?.status?.toUpperCase() || "";
                
                // Map EOD status to KYC status
                if (eodStatus === "LIVENESS_STARTED") {
                  kycStatus = "LIVENESS_STARTED";
                } else if (eodStatus === "WAIT_FOR_APPROVAL") {
                  kycStatus = "WAIT_FOR_APPROVAL";
                } else if (eodStatus === "APPROVED") {
                  kycStatus = "APPROVED";
                } else if (eodStatus === "REJECTED") {
                  kycStatus = "REJECTED";
                }
                
                // Get KYC ID from EOD details if available
                if (eodDetails.kycRequestInfo?.kycId) {
                  kycId = eodDetails.kycRequestInfo.kycId;
                }
              } catch (eodError) {
                logger.warn(
                  {
                    error: eodError instanceof Error ? eodError.message : String(eodError),
                    eodRequestId,
                    requestId,
                  },
                  "Failed to fetch EOD details for director (non-blocking)"
                );
              }
            }
            
            directorsMap.set(mapKey, {
              eodRequestId,
              name,
              email,
              role: designation || "Director",
              kycStatus,
              kycId,
              lastUpdated: new Date().toISOString(),
            });
          }
        }

        // Process individual shareholders
        // If they already exist as directors, merge the roles; otherwise add as new entry
        if (codDetails.corpIndvShareholders && Array.isArray(codDetails.corpIndvShareholders)) {
          for (const shareholder of codDetails.corpIndvShareholders) {
            const shareholderEodRequestId = shareholder.corporateIndividualRequest?.requestId || "";
            const userInfo = shareholder.corporateUserRequestInfo;
            const formContent = userInfo?.formContent?.content || [];
            
            const firstName = formContent.find((f: any) => f.fieldName === "First Name")?.fieldValue || "";
            const lastName = formContent.find((f: any) => f.fieldName === "Last Name")?.fieldValue || "";
            const email = formContent.find((f: any) => f.fieldName === "Email Address")?.fieldValue || userInfo?.email || "";
            const sharePercent = formContent.find((f: any) => f.fieldName === "% of Shares")?.fieldValue || "";
            const name = `${firstName} ${lastName}`.trim() || userInfo?.fullName || "";
            
            const mapKey = normalizeKey(name, email);
            const existingDirector = directorsMap.get(mapKey);
            const shareholderRole = `Shareholder${sharePercent ? ` (${sharePercent}%)` : ""}`;
            
            // Fetch EOD details to get latest KYC status and kycId
            let kycStatus = shareholder.corporateIndividualRequest?.status || "PENDING";
            let kycId = shareholder.kycRequestInfo?.kycId;
            
            if (shareholderEodRequestId) {
              try {
                const eodDetails = await this.apiClient.getEntityOnboardingDetails(shareholderEodRequestId);
                const eodStatus = eodDetails.corporateIndividualRequest?.status?.toUpperCase() || "";
                
                if (eodStatus === "LIVENESS_STARTED") {
                  kycStatus = "LIVENESS_STARTED";
                } else if (eodStatus === "WAIT_FOR_APPROVAL") {
                  kycStatus = "WAIT_FOR_APPROVAL";
                } else if (eodStatus === "APPROVED") {
                  kycStatus = "APPROVED";
                } else if (eodStatus === "REJECTED") {
                  kycStatus = "REJECTED";
                }
                
                if (eodDetails.kycRequestInfo?.kycId) {
                  kycId = eodDetails.kycRequestInfo.kycId;
                }
              } catch (eodError) {
                logger.warn(
                  {
                    error: eodError instanceof Error ? eodError.message : String(eodError),
                    eodRequestId: shareholderEodRequestId,
                    requestId,
                  },
                  "Failed to fetch EOD details for shareholder (non-blocking)"
                );
              }
            }
            
            if (existingDirector) {
              // Person is both director and shareholder - merge roles
              existingDirector.role = `${existingDirector.role}, ${shareholderRole}`;
              existingDirector.shareholderEodRequestId = shareholderEodRequestId;
              
              // Fetch both EOD details to check which one has kycId
              let directorKycId: string | undefined;
              let shareholderKycId: string | undefined;
              
              // Fetch director EOD details
              if (existingDirector.eodRequestId) {
                try {
                  const directorEodDetails = await this.apiClient.getEntityOnboardingDetails(existingDirector.eodRequestId);
                  directorKycId = directorEodDetails.kycRequestInfo?.kycId;
                } catch (eodError) {
                  logger.warn(
                    {
                      error: eodError instanceof Error ? eodError.message : String(eodError),
                      eodRequestId: existingDirector.eodRequestId,
                      requestId,
                    },
                    "Failed to fetch director EOD details for kycId check (non-blocking)"
                  );
                }
              }
              
              // Fetch shareholder EOD details
              if (shareholderEodRequestId) {
                try {
                  const shareholderEodDetails = await this.apiClient.getEntityOnboardingDetails(shareholderEodRequestId);
                  shareholderKycId = shareholderEodDetails.kycRequestInfo?.kycId;
                } catch (eodError) {
                  logger.warn(
                    {
                      error: eodError instanceof Error ? eodError.message : String(eodError),
                      eodRequestId: shareholderEodRequestId,
                      requestId,
                    },
                    "Failed to fetch shareholder EOD details for kycId check (non-blocking)"
                  );
                }
              }
              
              // Use kycId from whichever EOD record has it (prioritize director if both have it)
              if (directorKycId) {
                existingDirector.kycId = directorKycId;
              } else if (shareholderKycId) {
                existingDirector.kycId = shareholderKycId;
              } else {
                // Fallback to COD response if EOD details don't have it
                if (shareholder.kycRequestInfo?.kycId && !existingDirector.kycId) {
                  existingDirector.kycId = shareholder.kycRequestInfo.kycId;
                }
              }
              
              // Update KYC status if shareholder has a more recent or different status
              if (kycStatus !== existingDirector.kycStatus) {
                // Prioritize APPROVED > WAIT_FOR_APPROVAL > LIVENESS_STARTED > PENDING
                const statusPriority = {
                  APPROVED: 4,
                  WAIT_FOR_APPROVAL: 3,
                  LIVENESS_STARTED: 2,
                  PENDING: 1,
                  REJECTED: 0,
                };
                const currentPriority = statusPriority[existingDirector.kycStatus as keyof typeof statusPriority] || 0;
                const newPriority = statusPriority[kycStatus as keyof typeof statusPriority] || 0;
                if (newPriority > currentPriority) {
                  existingDirector.kycStatus = kycStatus;
                }
              }
              
              existingDirector.lastUpdated = new Date().toISOString();
            } else {
              // Person is only a shareholder - add as new entry
              directorsMap.set(mapKey, {
                eodRequestId: shareholderEodRequestId,
                name,
                email,
                role: shareholderRole,
                kycStatus,
                kycId,
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

        // Extract additional corporate onboarding data
        const bankingDetails = extractBankingDetails(codDetails);
        const transactionInfo = extractTransactionInfo(codDetails);
        const beneficiaryInfo = extractBeneficiaryInfo(codDetails);
        const corporateOnboardingData = extractCorporateOnboardingData(codDetails);
        const corporateRequiredDocuments = extractRequiredDocuments(codDetails);
        const corporateEntities = extractCorporateEntities(codDetails);

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
                bank_account_details: bankingDetails as Prisma.InputJsonValue,
                wealth_declaration: transactionInfo as Prisma.InputJsonValue,
                compliance_declaration: beneficiaryInfo as Prisma.InputJsonValue,
                corporate_onboarding_data: corporateOnboardingData as Prisma.InputJsonValue,
                corporate_required_documents: corporateRequiredDocuments as Prisma.InputJsonValue,
                corporate_entities: corporateEntities as Prisma.InputJsonValue,
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
                bank_account_details: bankingDetails as Prisma.InputJsonValue,
                wealth_declaration: transactionInfo as Prisma.InputJsonValue,
                compliance_declaration: beneficiaryInfo as Prisma.InputJsonValue,
                corporate_onboarding_data: corporateOnboardingData as Prisma.InputJsonValue,
                corporate_required_documents: corporateRequiredDocuments as Prisma.InputJsonValue,
                corporate_entities: corporateEntities as Prisma.InputJsonValue,
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

        // When COD is APPROVED, also refresh director KYC statuses to get updated kycId values
        // The kycId may not have been available at WAIT_FOR_APPROVAL stage
        try {
          if (codDetails && typeof codDetails === "object" && !Array.isArray(codDetails)) {
            const codDetailsObj = codDetails as Record<string, unknown>;
            
            // Helper function to normalize name+email for duplicate detection
            const normalizeKey = (name: string, email: string): string => {
              return `${(name || "").toLowerCase().trim()}|${(email || "").toLowerCase().trim()}`;
            };
            
            // Get existing director_kyc_status from organization
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
              const existingStatus = org.director_kyc_status as any;
              const directorsMap = new Map<string, any>();
              
              // Build map from existing directors
              if (existingStatus.directors && Array.isArray(existingStatus.directors)) {
                for (const dir of existingStatus.directors) {
                  const key = normalizeKey(dir.name, dir.email);
                  directorsMap.set(key, { ...dir });
                }
              }
              
              // Process COD details to update kycId values
              const corpIndvDirectors = codDetailsObj.corpIndvDirectors as any[];
              const corpIndvShareholders = codDetailsObj.corpIndvShareholders as any[];
              
              // Update directors that don't have kycId yet
              if (corpIndvDirectors && Array.isArray(corpIndvDirectors)) {
                for (const director of corpIndvDirectors) {
                  const eodRequestId = director.corporateIndividualRequest?.requestId;
                  const userInfo = director.corporateUserRequestInfo;
                  const formContent = userInfo?.formContent?.content || [];
                  const firstName = formContent.find((f: any) => f.fieldName === "First Name")?.fieldValue || "";
                  const lastName = formContent.find((f: any) => f.fieldName === "Last Name")?.fieldValue || "";
                  const email = formContent.find((f: any) => f.fieldName === "Email Address")?.fieldValue || userInfo?.email || "";
                  const name = `${firstName} ${lastName}`.trim() || userInfo?.fullName || "";
                  const key = normalizeKey(name, email);
                  
                  const existing = directorsMap.get(key);
                  if (existing && eodRequestId && !existing.kycId) {
                    // Fetch EOD details to get kycId
                    try {
                      const eodDetails = await this.apiClient.getEntityOnboardingDetails(eodRequestId);
                      if (eodDetails.kycRequestInfo?.kycId) {
                        existing.kycId = eodDetails.kycRequestInfo.kycId;
                        existing.lastUpdated = new Date().toISOString();
                        logger.debug(
                          { eodRequestId, codRequestId: requestId, kycId: existing.kycId, name },
                          "Updated kycId for director from EOD details after COD approval"
                        );
                      }
                    } catch (eodError) {
                      logger.warn(
                        {
                          error: eodError instanceof Error ? eodError.message : String(eodError),
                          eodRequestId,
                          codRequestId: requestId,
                        },
                        "Failed to fetch director EOD details for kycId update (non-blocking)"
                      );
                    }
                  }
                }
              }
              
              // Update shareholders (and check duplicates for kycId)
              if (corpIndvShareholders && Array.isArray(corpIndvShareholders)) {
                for (const shareholder of corpIndvShareholders) {
                  const shareholderEodRequestId = shareholder.corporateIndividualRequest?.requestId;
                  const userInfo = shareholder.corporateUserRequestInfo;
                  const formContent = userInfo?.formContent?.content || [];
                  const firstName = formContent.find((f: any) => f.fieldName === "First Name")?.fieldValue || "";
                  const lastName = formContent.find((f: any) => f.fieldName === "Last Name")?.fieldValue || "";
                  const email = formContent.find((f: any) => f.fieldName === "Email Address")?.fieldValue || userInfo?.email || "";
                  const name = `${firstName} ${lastName}`.trim() || userInfo?.fullName || "";
                  const key = normalizeKey(name, email);
                  
                  const existing = directorsMap.get(key);
                  if (existing) {
                    // Person is both director and shareholder - check both EOD records for kycId
                    if (!existing.kycId && existing.eodRequestId && shareholderEodRequestId) {
                      let directorKycId: string | undefined;
                      let shareholderKycId: string | undefined;
                      
                      // Check director EOD
                      if (existing.eodRequestId) {
                        try {
                          const directorEodDetails = await this.apiClient.getEntityOnboardingDetails(existing.eodRequestId);
                          directorKycId = directorEodDetails.kycRequestInfo?.kycId;
                        } catch (eodError) {
                          logger.warn(
                            {
                              error: eodError instanceof Error ? eodError.message : String(eodError),
                              eodRequestId: existing.eodRequestId,
                              codRequestId: requestId,
                            },
                            "Failed to fetch director EOD details for kycId check (non-blocking)"
                          );
                        }
                      }
                      
                      // Check shareholder EOD
                      if (shareholderEodRequestId) {
                        try {
                          const shareholderEodDetails = await this.apiClient.getEntityOnboardingDetails(shareholderEodRequestId);
                          shareholderKycId = shareholderEodDetails.kycRequestInfo?.kycId;
                        } catch (eodError) {
                          logger.warn(
                            {
                              error: eodError instanceof Error ? eodError.message : String(eodError),
                              eodRequestId: shareholderEodRequestId,
                              codRequestId: requestId,
                            },
                            "Failed to fetch shareholder EOD details for kycId check (non-blocking)"
                          );
                        }
                      }
                      
                      // Use kycId from whichever EOD record has it (prioritize director if both have it)
                      if (directorKycId) {
                        existing.kycId = directorKycId;
                        existing.lastUpdated = new Date().toISOString();
                        logger.debug(
                          { directorEodRequestId: existing.eodRequestId, shareholderEodRequestId, kycId: directorKycId, name },
                          "Updated kycId for duplicate director/shareholder from director EOD after COD approval"
                        );
                      } else if (shareholderKycId) {
                        existing.kycId = shareholderKycId;
                        existing.lastUpdated = new Date().toISOString();
                        logger.debug(
                          { directorEodRequestId: existing.eodRequestId, shareholderEodRequestId, kycId: shareholderKycId, name },
                          "Updated kycId for duplicate director/shareholder from shareholder EOD after COD approval"
                        );
                      }
                    }
                  } else if (shareholderEodRequestId) {
                    // Person is only shareholder - check for kycId if they exist in director_kyc_status
                    // Note: We only update existing entries, not add new ones here
                    // New shareholders are handled during WAIT_FOR_APPROVAL
                    // Check both eodRequestId and shareholderEodRequestId to handle all cases
                    for (const [, dir] of directorsMap.entries()) {
                      const matchesShareholderEod = dir.eodRequestId === shareholderEodRequestId || dir.shareholderEodRequestId === shareholderEodRequestId;
                      if (matchesShareholderEod && !dir.kycId) {
                        try {
                          const eodDetails = await this.apiClient.getEntityOnboardingDetails(shareholderEodRequestId);
                          if (eodDetails.kycRequestInfo?.kycId) {
                            dir.kycId = eodDetails.kycRequestInfo.kycId;
                            dir.lastUpdated = new Date().toISOString();
                            logger.debug(
                              { eodRequestId: shareholderEodRequestId, codRequestId: requestId, kycId: dir.kycId, name },
                              "Updated kycId for shareholder-only entry from EOD details after COD approval"
                            );
                          }
                        } catch (eodError) {
                          logger.warn(
                            {
                              error: eodError instanceof Error ? eodError.message : String(eodError),
                              eodRequestId: shareholderEodRequestId,
                              codRequestId: requestId,
                            },
                            "Failed to fetch shareholder EOD details for kycId update (non-blocking)"
                          );
                        }
                      }
                    }
                  }
                }
              }
              
              // Update organization with refreshed director_kyc_status
              const updatedDirectors = Array.from(directorsMap.values());
              const directorsWithKycId = updatedDirectors.filter((d) => d.kycId).length;
              
              if (directorsWithKycId > 0) {
                const updatedStatus = {
                  ...existingStatus,
                  directors: updatedDirectors,
                  lastSyncedAt: new Date().toISOString(),
                };
                
                if (portalType === "investor") {
                  await prisma.investorOrganization.update({
                    where: { id: organizationId },
                    data: { director_kyc_status: updatedStatus as Prisma.InputJsonValue },
                  });
                } else {
                  await prisma.issuerOrganization.update({
                    where: { id: organizationId },
                    data: { director_kyc_status: updatedStatus as Prisma.InputJsonValue },
                  });
                }
                
                logger.info(
                  {
                    organizationId,
                    codRequestId: requestId,
                    directorsUpdated: directorsWithKycId,
                    totalDirectors: updatedDirectors.length,
                  },
                  "Updated director_kyc_status with kycId values after COD approval"
                );
              } else {
                logger.debug(
                  { organizationId, codRequestId: requestId },
                  "No kycId values to update after COD approval"
                );
              }
            }
          }
        } catch (kycUpdateError) {
          logger.warn(
            {
              error: kycUpdateError instanceof Error ? kycUpdateError.message : String(kycUpdateError),
              codRequestId: requestId,
              organizationId,
            },
            "Failed to refresh director kycId values after COD approval (non-blocking)"
          );
          // Don't throw - allow status update to proceed even if kycId refresh fails
        }

        // After refreshing kycId values, fetch AML statuses for all directors with kycId
        // This is a fallback if EOD webhook didn't successfully fetch AML status
        try {
          logger.info(
            { requestId, organizationId, portalType },
            "[COD Webhook] Fetching AML statuses for all directors after COD approval (fallback)"
          );

          // Wait 3 seconds for RegTank to process all KYC checks
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // Get updated organization with refreshed director_kyc_status
          const org = portalType === "investor"
            ? await prisma.investorOrganization.findUnique({
                where: { id: organizationId },
                select: { director_kyc_status: true, director_aml_status: true },
              })
            : await prisma.issuerOrganization.findUnique({
                where: { id: organizationId },
                select: { director_kyc_status: true, director_aml_status: true },
              });

          if (org && org.director_kyc_status) {
            const directorKycStatus = org.director_kyc_status as any;
            const directorsAmlStatus: Array<{
              kycId: string;
              name: string;
              email: string;
              role: string;
              amlStatus: "Unresolved" | "Approved" | "Rejected" | "Pending";
              amlMessageStatus: "DONE" | "PENDING" | "ERROR";
              amlRiskScore: number | null;
              amlRiskLevel: string | null;
              lastUpdated: string;
            }> = [];

            // Fetch AML status for each director with a kycId
            for (const director of directorKycStatus.directors || []) {
              if (!director.kycId) {
                logger.debug(
                  { directorName: director.name, eodRequestId: director.eodRequestId },
                  "[COD Webhook] Skipping director without kycId for AML status fetch"
                );
                continue;
              }

              try {
                const kycStatusResponse = await this.apiClient.queryKYCStatus(director.kycId);
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

                directorsAmlStatus.push({
                  kycId: director.kycId,
                  name: director.name,
                  email: director.email,
                  role: director.role,
                  amlStatus,
                  amlMessageStatus,
                  amlRiskScore,
                  amlRiskLevel,
                  lastUpdated: new Date().toISOString(),
                });

                logger.debug(
                  {
                    kycId: director.kycId,
                    directorName: director.name,
                    amlStatus,
                    amlMessageStatus,
                  },
                  "[COD Webhook] Fetched AML status for director"
                );
              } catch (kycError) {
                logger.warn(
                  {
                    error: kycError instanceof Error ? kycError.message : String(kycError),
                    kycId: director.kycId,
                    directorName: director.name,
                  },
                  "[COD Webhook] Failed to fetch AML status for director (non-blocking)"
                );
                // Continue with other directors even if one fails
              }
            }

            // Update organization with AML statuses (merge with existing if any)
            if (directorsAmlStatus.length > 0) {
              let directorAmlStatus = (org.director_aml_status as any) || { directors: [], lastSyncedAt: new Date().toISOString() };
              if (!directorAmlStatus.directors || !Array.isArray(directorAmlStatus.directors)) {
                directorAmlStatus.directors = [];
              }

              // Merge new AML statuses with existing ones
              for (const newAmlStatus of directorsAmlStatus) {
                const existingIndex = directorAmlStatus.directors.findIndex(
                  (d: any) => d.kycId === newAmlStatus.kycId
                );

                if (existingIndex === -1) {
                  directorAmlStatus.directors.push(newAmlStatus);
                } else {
                  // Update existing entry with latest data
                  directorAmlStatus.directors[existingIndex] = newAmlStatus;
                }
              }

              directorAmlStatus.lastSyncedAt = new Date().toISOString();

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
                  requestId,
                  organizationId,
                  directorsUpdated: directorsAmlStatus.length,
                },
                "[COD Webhook] ✓ Updated director AML statuses after delayed fetch (fallback)"
              );
            }
          }
        } catch (amlFetchError) {
          logger.error(
            {
              error: amlFetchError instanceof Error ? amlFetchError.message : String(amlFetchError),
              requestId,
              organizationId,
            },
            "[COD Webhook] Failed to fetch AML statuses after delay (non-blocking)"
          );
          // Don't throw - allow webhook to complete
        }

        // Refresh document URLs in corporate_entities by fetching EOD details
        // Documents should be fully processed by the time COD is APPROVED
        try {
          logger.info(
            { requestId, organizationId, portalType },
            "[COD Webhook] Refreshing document URLs in corporate_entities after COD approval"
          );

          const org = portalType === "investor"
            ? await prisma.investorOrganization.findUnique({
                where: { id: organizationId },
                select: { corporate_entities: true },
              })
            : await prisma.issuerOrganization.findUnique({
                where: { id: organizationId },
                select: { corporate_entities: true },
              });

          if (org && org.corporate_entities) {
            const corporateEntities = org.corporate_entities as any;
            let updated = false;

            // Update directors' document URLs
            if (corporateEntities.directors && Array.isArray(corporateEntities.directors)) {
              for (const director of corporateEntities.directors) {
                if (director.eodRequestId && (!director.documents?.frontDocumentUrl || !director.documents?.backDocumentUrl)) {
                  try {
                    const eodDetails = await this.apiClient.getEntityOnboardingDetails(director.eodRequestId);
                    if (eodDetails.corporateDocumentInfo) {
                      director.documents = {
                        documentType: eodDetails.corporateDocumentInfo?.documentType || director.documents?.documentType || null,
                        countryCode: eodDetails.corporateDocumentInfo?.countryCode || director.documents?.countryCode || null,
                        ocrStatus: eodDetails.corporateDocumentInfo?.ocrStatus || director.documents?.ocrStatus || null,
                        frontDocumentUrl: eodDetails.corporateDocumentInfo?.frontDocumentUrl || director.documents?.frontDocumentUrl || null,
                        backDocumentUrl: eodDetails.corporateDocumentInfo?.backDocumentUrl || director.documents?.backDocumentUrl || null,
                      };
                      updated = true;
                      logger.debug(
                        {
                          eodRequestId: director.eodRequestId,
                          hasFrontUrl: !!director.documents.frontDocumentUrl,
                          hasBackUrl: !!director.documents.backDocumentUrl,
                        },
                        "[COD Webhook] Updated director document URLs from EOD details"
                      );
                    }
                  } catch (eodError) {
                    logger.warn(
                      {
                        error: eodError instanceof Error ? eodError.message : String(eodError),
                        eodRequestId: director.eodRequestId,
                      },
                      "[COD Webhook] Failed to fetch EOD details for director document URLs (non-blocking)"
                    );
                  }
                }
              }
            }

            // Update shareholders' document URLs
            if (corporateEntities.shareholders && Array.isArray(corporateEntities.shareholders)) {
              for (const shareholder of corporateEntities.shareholders) {
                if (shareholder.eodRequestId && (!shareholder.documents?.frontDocumentUrl || !shareholder.documents?.backDocumentUrl)) {
                  try {
                    const eodDetails = await this.apiClient.getEntityOnboardingDetails(shareholder.eodRequestId);
                    if (eodDetails.corporateDocumentInfo) {
                      shareholder.documents = {
                        documentType: eodDetails.corporateDocumentInfo?.documentType || shareholder.documents?.documentType || null,
                        countryCode: eodDetails.corporateDocumentInfo?.countryCode || shareholder.documents?.countryCode || null,
                        ocrStatus: eodDetails.corporateDocumentInfo?.ocrStatus || shareholder.documents?.ocrStatus || null,
                        frontDocumentUrl: eodDetails.corporateDocumentInfo?.frontDocumentUrl || shareholder.documents?.frontDocumentUrl || null,
                        backDocumentUrl: eodDetails.corporateDocumentInfo?.backDocumentUrl || shareholder.documents?.backDocumentUrl || null,
                      };
                      updated = true;
                      logger.debug(
                        {
                          eodRequestId: shareholder.eodRequestId,
                          hasFrontUrl: !!shareholder.documents.frontDocumentUrl,
                          hasBackUrl: !!shareholder.documents.backDocumentUrl,
                        },
                        "[COD Webhook] Updated shareholder document URLs from EOD details"
                      );
                    }
                  } catch (eodError) {
                    logger.warn(
                      {
                        error: eodError instanceof Error ? eodError.message : String(eodError),
                        eodRequestId: shareholder.eodRequestId,
                      },
                      "[COD Webhook] Failed to fetch EOD details for shareholder document URLs (non-blocking)"
                    );
                  }
                }
              }
            }

            // Update organization if any documents were refreshed
            if (updated) {
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
                { requestId, organizationId },
                "[COD Webhook] ✓ Refreshed document URLs in corporate_entities after COD approval"
              );
            } else {
              logger.debug(
                { requestId, organizationId },
                "[COD Webhook] No document URLs to refresh in corporate_entities (already present or no EOD requestIds)"
              );
            }
          }
        } catch (docRefreshError) {
          logger.error(
            {
              error: docRefreshError instanceof Error ? docRefreshError.message : String(docRefreshError),
              requestId,
              organizationId,
            },
            "[COD Webhook] Failed to refresh document URLs in corporate_entities (non-blocking)"
          );
          // Don't throw - allow webhook to complete even if document refresh fails
        }

        // Refresh corporate shareholders status from COD details
        // Status should be updated when COD is approved
        try {
          logger.info(
            { requestId, organizationId, portalType },
            "[COD Webhook] Refreshing corporate shareholders status after COD approval"
          );

          // Fetch latest COD details to get updated corporate shareholders status
          const codDetails = await this.apiClient.getCorporateOnboardingDetails(requestId);
          
          const org = portalType === "investor"
            ? await prisma.investorOrganization.findUnique({
                where: { id: organizationId },
                select: { corporate_entities: true },
              })
            : await prisma.issuerOrganization.findUnique({
                where: { id: organizationId },
                select: { corporate_entities: true },
              });

          if (org && org.corporate_entities && codDetails.corpBizShareholders) {
            const corporateEntities = org.corporate_entities as any;
            let updated = false;

            // Update corporate shareholders with latest status from COD details
            if (corporateEntities.corporateShareholders && Array.isArray(corporateEntities.corporateShareholders)) {
              const codCorpShareholders = codDetails.corpBizShareholders as any[];
              
              // Create a map of existing corporate shareholders by COD requestId or company name
              const existingMap = new Map<string, any>();
              for (const existing of corporateEntities.corporateShareholders) {
                const key = existing.corporateOnboardingRequest?.requestId || existing.requestId || existing.name || "";
                if (key) {
                  existingMap.set(key, existing);
                }
              }

              // Update existing corporate shareholders with latest status from COD details
              for (const codShareholder of codCorpShareholders) {
                const codRequestId = codShareholder.corporateOnboardingRequest?.requestId || codShareholder.requestId || "";
                const codName = codShareholder.name || codShareholder.businessName || "";
                const key = codRequestId || codName;
                
                if (key) {
                  const existing = existingMap.get(key);
                  if (existing) {
                    // Update status and other fields from COD details
                    const updatedShareholder = {
                      ...existing,
                      ...codShareholder,
                      // Preserve any fields we want to keep from existing
                      lastUpdated: new Date().toISOString(),
                    };
                    
                    // Replace in array
                    const index = corporateEntities.corporateShareholders.findIndex(
                      (s: any) => (s.corporateOnboardingRequest?.requestId || s.requestId || s.name || "") === key
                    );
                    if (index !== -1) {
                      corporateEntities.corporateShareholders[index] = updatedShareholder;
                      updated = true;
                      logger.debug(
                        {
                          codRequestId,
                          name: codName,
                          status: codShareholder.status || codShareholder.corporateOnboardingRequest?.status,
                        },
                        "[COD Webhook] Updated corporate shareholder status from COD details"
                      );
                    }
                  } else {
                    // New corporate shareholder - add it
                    corporateEntities.corporateShareholders.push({
                      ...codShareholder,
                      lastUpdated: new Date().toISOString(),
                    });
                    updated = true;
                    logger.debug(
                      {
                        codRequestId,
                        name: codName,
                      },
                      "[COD Webhook] Added new corporate shareholder from COD details"
                    );
                  }
                }
              }
            } else if (codDetails.corpBizShareholders && Array.isArray(codDetails.corpBizShareholders) && codDetails.corpBizShareholders.length > 0) {
              // No existing corporate shareholders, but COD has them - initialize the array
              corporateEntities.corporateShareholders = (codDetails.corpBizShareholders as any[]).map((corpShareholder: any) => ({
                ...corpShareholder,
                lastUpdated: new Date().toISOString(),
              }));
              updated = true;
              logger.debug(
                {
                  count: codDetails.corpBizShareholders.length,
                },
                "[COD Webhook] Initialized corporate shareholders array from COD details"
              );
            }

            // Update organization if corporate shareholders were refreshed
            if (updated) {
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
                { requestId, organizationId },
                "[COD Webhook] ✓ Refreshed corporate shareholders status after COD approval"
              );
            } else {
              logger.debug(
                { requestId, organizationId },
                "[COD Webhook] No corporate shareholders to refresh (already up to date or none present)"
              );
            }
          }
        } catch (corpShareholderRefreshError) {
          logger.error(
            {
              error: corpShareholderRefreshError instanceof Error ? corpShareholderRefreshError.message : String(corpShareholderRefreshError),
              requestId,
              organizationId,
            },
            "[COD Webhook] Failed to refresh corporate shareholders status (non-blocking)"
          );
          // Don't throw - allow webhook to complete even if corporate shareholder refresh fails
        }

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

