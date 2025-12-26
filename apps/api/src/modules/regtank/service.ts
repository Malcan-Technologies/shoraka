import { Request } from "express";
import { RegTankRepository } from "./repository";
import { getRegTankAPIClient } from "./api-client";
import {
  RegTankIndividualOnboardingRequest,
  RegTankCorporateOnboardingRequest,
  RegTankWebhookPayload,
  PortalType,
} from "./types";
import { OnboardingStatus, OrganizationType, UserRole } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { extractRequestMetadata } from "../../lib/http/request-utils";
import { OrganizationRepository } from "../organization/repository";

export class RegTankService {
  private repository: RegTankRepository;
  private apiClient = getRegTankAPIClient();
  private organizationRepository: OrganizationRepository;

  constructor() {
    this.repository = new RegTankRepository();
    this.organizationRepository = new OrganizationRepository();
  }

  /**
   * Start personal (individual) onboarding for an organization
   */
  async startPersonalOnboarding(
    req: Request,
    userId: string,
    organizationId: string,
    portalType: PortalType
  ): Promise<{
    verifyLink: string;
    requestId: string;
    expiresIn: number;
    organizationType: string;
  }> {
    logger.info(
      {
        userId,
        organizationId,
        portalType,
      },
      "Starting RegTank personal onboarding"
    );

    // Block individual onboarding from issuer portal
    if (portalType === "issuer") {
      throw new AppError(
        400,
        "INVALID_PORTAL_TYPE",
        "Individual onboarding is not supported for the Issuer portal. Please use corporate onboarding instead."
      );
    }

    // Get user data
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
    });

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    // Validate user has first name and last name
    if (!user.first_name || !user.last_name) {
      throw new AppError(
        400,
        "NAMES_REQUIRED",
        "First name and last name are required before starting onboarding"
      );
    }

    // Get organization
    const organization =
      portalType === "investor"
        ? await this.organizationRepository.findInvestorOrganizationById(
            organizationId
          )
        : await this.organizationRepository.findIssuerOrganizationById(
            organizationId
          );

    if (!organization) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
    }

    // Verify user owns the organization
    if (organization.owner_user_id !== userId) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "Only the organization owner can start onboarding"
      );
    }

    // Check if organization is already completed
    if (organization.onboarding_status === OnboardingStatus.COMPLETED) {
      throw new AppError(
        400,
        "ALREADY_COMPLETED",
        "Onboarding is already completed"
      );
    }

    // Check if we should resume existing onboarding for this organization
    // Resume if:
    // - Organization status is NOT PENDING_APPROVAL or COMPLETED
    // - RegTank onboarding status is NOT LIVENESS_PASSED, PENDING_APPROVAL, or APPROVED
    const existingOnboarding = await this.repository.findByOrganizationId(
      organizationId,
      portalType
    );

    const shouldResume =
      organization.onboarding_status !== OnboardingStatus.PENDING_APPROVAL &&
      existingOnboarding &&
      !["LIVENESS_PASSED", "PENDING_APPROVAL", "APPROVED"].includes(existingOnboarding.status) &&
      existingOnboarding.verify_link !== null;

    if (shouldResume && existingOnboarding.verify_link) {
      logger.info(
        {
          userId,
          organizationId,
          requestId: existingOnboarding.request_id,
          orgStatus: organization.onboarding_status,
          rtStatus: existingOnboarding.status,
        },
        "Resuming existing onboarding for organization (not advanced enough)"
      );
        return {
          verifyLink: existingOnboarding.verify_link,
          requestId: existingOnboarding.request_id,
          expiresIn: existingOnboarding.verify_link_expires_at
            ? Math.floor(
                (existingOnboarding.verify_link_expires_at.getTime() -
                  Date.now()) /
                  1000
              )
            : 86400,
        organizationType: existingOnboarding.organization_type,
        };
    }

    // Prepare RegTank onboarding request
    const referenceId = organizationId; // Use organization ID as reference
    // Set portal-specific redirectUrl
    const redirectUrl =
      portalType === "investor"
        ? "https://investor.cashsouk.com/regtank-callback"
        : "https://issuer.cashsouk.com/regtank-callback";
    
    // Determine webhook endpoint based on REGTANK_WEBHOOK_MODE
    // If REGTANK_WEBHOOK_MODE=dev, use /v1/webhooks/regtank/dev
    // Otherwise, use /v1/webhooks/regtank (production)
    const webhookMode = process.env.REGTANK_WEBHOOK_MODE || "prod";
    const webhookEndpoint = webhookMode === "dev" ? "/v1/webhooks/regtank/dev" : "/v1/webhooks/regtank";
    
    const webhookUrl = process.env.API_URL 
      ? `${process.env.API_URL}${webhookEndpoint}`
      : process.env.FRONTEND_URL 
      ? `${process.env.FRONTEND_URL}${webhookEndpoint}`
      : `https://api.cashsouk.com${webhookEndpoint}`;

    logger.info(
      {
        webhookMode,
        webhookEndpoint,
        webhookUrl,
      },
      "RegTank webhook URL configured"
    );

    // Set onboarding settings (redirect URL)
    // According to RegTank docs, redirectUrl must be set via settings endpoint, not in request
    // Settings are per formId, so we need to set them once per formId
    // Note: formId is required - use investor personal form ID (investor portal only)
    const formId = parseInt(process.env.REGTANK_INVESTOR_PERSONAL_FORM_ID || "1036131", 10);
    
    // Check if redirectUrl is localhost - RegTank can't redirect to localhost!
    if (redirectUrl.includes("localhost") || redirectUrl.includes("127.0.0.1")) {
      logger.error(
        {
          redirectUrl,
          message: "Localhost URLs are not accessible from RegTank servers. Use a public URL or ngrok for development.",
        },
        "Cannot use localhost for RegTank redirect URL"
      );
      throw new Error(
        "Localhost URLs are not accessible from RegTank. Please use a public URL (e.g., ngrok) for development."
      );
    }

    // Check if webhookUrl is localhost
    if (webhookUrl.includes("localhost") || webhookUrl.includes("127.0.0.1")) {
      logger.error(
        {
          webhookUrl,
          message: "Localhost URLs are not accessible from RegTank servers. Use a public URL or ngrok for development.",
        },
        "Cannot use localhost for RegTank webhook URL"
      );
      throw new Error(
        "Localhost URLs are not accessible from RegTank. Please use a public URL (e.g., ngrok) for development."
      );
    }

    // Set webhook preferences (global configuration, called once per environment)
    // This should ideally be done during initial setup, but we'll call it here to ensure it's set
    try {
      await this.apiClient.setWebhookPreferences({
        webhookUrl,
        webhookEnabled: true,
      });
      logger.info(
        { webhookUrl },
        "RegTank webhook preferences configured successfully"
      );
    } catch (error) {
      // Log but don't block - webhook preferences might already be set
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          webhookUrl,
          message: "Failed to set RegTank webhook preferences, but continuing with onboarding request",
        },
        "Failed to set RegTank webhook preferences (non-blocking)"
      );
    }

    // Set onboarding settings (redirect URL) - called once per formId
    // Use portal-specific redirectUrl and required settings
    try {
      await this.apiClient.setOnboardingSettings({
        formId,
        livenessConfidence: 90,
        approveMode: true,
        kycApprovalTarget: "ACURIS",
        enabledRegistrationEmail: false,
        redirectUrl,
      });
      logger.info(
        { formId, redirectUrl },
        "RegTank onboarding settings configured successfully"
      );
    } catch (error) {
      // Extract detailed error information
      let errorMessage = "Failed to configure RegTank settings";
      if (error instanceof AppError) {
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }

      // Check if error is "SettingInfo does not exist" - this is OK, settings might already be set
      const isSettingsNotFound = 
        error instanceof AppError && 
        error.code === "REGTANK_API_ERROR" &&
        (errorMessage.includes("SettingInfo does not exist") || 
         errorMessage.includes("ERROR_DATA_NOT_FOUND"));
      
      if (isSettingsNotFound) {
        logger.warn(
          {
            formId,
            redirectUrl,
            message: "RegTank settings not found, but continuing with onboarding request",
          },
          "RegTank settings do not exist yet, continuing with onboarding request"
        );
      } else {
        // Other errors - log but don't block
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            formId,
            redirectUrl,
            message: "Failed to set RegTank settings, but continuing with onboarding request",
          },
          "Failed to set RegTank onboarding settings (non-blocking)"
        );
      }
      // Don't throw - continue with onboarding request
    }

    const onboardingRequest: RegTankIndividualOnboardingRequest = {
      email: user.email,
      surname: user.last_name.trim(), // Parse: last_name → surname
      forename: user.first_name.trim(), // Parse: first_name → forename
      referenceId,
      countryOfResidence: "MY", // TODO: Get from user profile or organization
      nationality: "MY", // TODO: Get from user profile
      placeOfBirth: "MY", // TODO: Get from user profile
      idIssuingCountry: "MY", // TODO: Get from user profile
      gender: "UNSPECIFIED", // TODO: Get from user profile
      governmentIdNumber: "", // Will be provided by user in RegTank portal
      idType: "IDENTITY",
      language: "EN",
      bypassIdUpload: false, // Boolean: If true, skip directly to liveness check
      skipFormPage: false, // Boolean: If true, skip to form page (default behavior)
      formId, // Include formId to link request to configured settings
      // Note: webhookUrl is configured globally via /alert/preferences endpoint
      // Note: redirectUrl is configured via /v3/onboarding/indv/setting endpoint
    };

    logger.info(
      {
        userId,
        organizationId,
        portalType,
        email: user.email,
        referenceId,
        redirectUrl,
        webhookUrl,
        formId,
      },
      "Creating RegTank individual onboarding request"
    );

    // Call RegTank API
    let regTankResponse;
    try {
      regTankResponse = await this.apiClient.createIndividualOnboarding(
        onboardingRequest
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          organizationId,
          userId,
          email: user.email,
        },
        "Failed to create RegTank individual onboarding"
      );
      // Re-throw AppError as-is, wrap others
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        500,
        "REGTANK_ONBOARDING_FAILED",
        `Failed to start RegTank onboarding: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Calculate expiration time (24 hours default)
    const expiresIn = regTankResponse.expiredIn || 86400;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // For personal accounts, organization is already IN_PROGRESS when user clicks "Yes"
    // Set reg_tank_onboarding status to IN_PROGRESS to match organization status
    // For company accounts, start with PENDING
    const initialStatus = organization.type === OrganizationType.PERSONAL 
      ? "IN_PROGRESS" 
      : "PENDING";

    // Store onboarding record
    await this.repository.createOnboarding({
      userId,
      organizationId,
      organizationType: organization.type,
      portalType,
      requestId: regTankResponse.requestId,
      referenceId,
      onboardingType: "INDIVIDUAL",
      verifyLink: regTankResponse.verifyLink,
      verifyLinkExpiresAt: expiresAt,
      status: initialStatus,
      regtankResponse: regTankResponse,
    });

    // Log onboarding started event
    const { ipAddress, userAgent, deviceInfo, deviceType } =
      extractRequestMetadata(req);
    const role = portalType === "investor" ? UserRole.INVESTOR : UserRole.ISSUER;

    await prisma.onboardingLog.create({
      data: {
        user_id: userId,
        role,
        event_type: "ONBOARDING_STARTED",
        portal: portalType,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_info: deviceInfo,
        device_type: deviceType,
        metadata: {
          organizationId,
          requestId: regTankResponse.requestId,
          onboardingType: "INDIVIDUAL",
        },
      },
    });

    logger.info(
      {
        requestId: regTankResponse.requestId,
        organizationId,
        verifyLink: regTankResponse.verifyLink,
      },
      "RegTank onboarding started successfully"
    );

    return {
      verifyLink: regTankResponse.verifyLink,
      requestId: regTankResponse.requestId,
      expiresIn,
      organizationType: organization.type,
    };
  }

  /**
   * Start corporate onboarding for an organization
   */
  async startCorporateOnboarding(
    req: Request,
    userId: string,
    organizationId: string,
    portalType: PortalType,
    companyName: string,
    formId?: number
  ): Promise<{
    verifyLink: string;
    requestId: string;
    expiresIn: number;
    organizationType: string;
  }> {
    // Get formName from environment variables based on portal type
    const formName =
      portalType === "investor"
        ? process.env.REGTANK_INVESTOR_CORPORATE_FORM_NAME || "Business End User Onboarding Example Form1"
        : process.env.REGTANK_ISSUER_CORPORATE_FORM_NAME || "Business End User Onboarding Example Form1";

    logger.info(
      {
        userId,
        organizationId,
        portalType,
        formName,
        companyName,
      },
      "Starting RegTank corporate onboarding"
    );

    // Get user data
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
    });

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    // Get organization
    const organization =
      portalType === "investor"
        ? await this.organizationRepository.findInvestorOrganizationById(
            organizationId
          )
        : await this.organizationRepository.findIssuerOrganizationById(
            organizationId
          );

    if (!organization) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
    }

    // Verify user owns the organization
    if (organization.owner_user_id !== userId) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "Only the organization owner can start onboarding"
      );
    }

    // Check if organization is already completed
    if (organization.onboarding_status === OnboardingStatus.COMPLETED) {
      throw new AppError(
        400,
        "ALREADY_COMPLETED",
        "Onboarding is already completed"
      );
    }

    // Verify organization is COMPANY type
    if (organization.type !== OrganizationType.COMPANY) {
      throw new AppError(
        400,
        "INVALID_ORGANIZATION_TYPE",
        "Corporate onboarding can only be started for COMPANY organizations"
      );
    }

    // Check if there's already an active onboarding
    const existingOnboarding = await this.repository.findByOrganizationId(
      organizationId,
      portalType
    );
    if (
      existingOnboarding &&
      ["PENDING", "IN_PROGRESS"].includes(existingOnboarding.status)
    ) {
      if (existingOnboarding.verify_link) {
        return {
          verifyLink: existingOnboarding.verify_link,
          requestId: existingOnboarding.request_id,
          expiresIn: existingOnboarding.verify_link_expires_at
            ? Math.floor(
                (existingOnboarding.verify_link_expires_at.getTime() -
                  Date.now()) /
                  1000
              )
            : 86400,
          organizationType: organization.type,
        };
      }
    }

    // Prepare RegTank corporate onboarding request
    const referenceId = organizationId; // Use organization ID as reference
    
    // Set portal-specific redirectUrl (temporarily unused - commented out setOnboardingSettings)
    // const redirectUrl =
    //   portalType === "investor"
    //     ? "https://investor.cashsouk.com/regtank-callback"
    //     : "https://issuer.cashsouk.com/regtank-callback";

    // Get formId from parameter, or use portal-specific default
    // Determine formId based on portal type if not provided in request
    let formIdToUse = formId;
    if (!formIdToUse) {
      if (portalType === "investor") {
        formIdToUse = parseInt(process.env.REGTANK_INVESTOR_CORPORATE_FORM_ID || "1015520", 10);
      } else {
        formIdToUse = parseInt(process.env.REGTANK_ISSUER_CORPORATE_FORM_ID || "1015520", 10);
      }
    }

    // Set onboarding settings (redirect URL) - called once per formId
    // Use portal-specific redirectUrl and required settings
    // TEMPORARILY COMMENTED OUT FOR TESTING
    /*
    try {
      await this.apiClient.setOnboardingSettings({
        formId: formIdToUse,
        livenessConfidence: 90,
        approveMode: true,
        kycApprovalTarget: "ACURIS",
        enabledRegistrationEmail: false,
        redirectUrl,
      });
      logger.info(
        { formId: formIdToUse, redirectUrl, portalType },
        "RegTank onboarding settings configured successfully for corporate onboarding"
      );
    } catch (error) {
      // Extract detailed error information
      let errorMessage = "Failed to configure RegTank settings";
      if (error instanceof AppError) {
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }

      // Check if error is "SettingInfo does not exist" - this is OK, settings might already be set
      const isSettingsNotFound = 
        error instanceof AppError && 
        error.code === "REGTANK_API_ERROR" &&
        (errorMessage.includes("SettingInfo does not exist") || 
         errorMessage.includes("ERROR_DATA_NOT_FOUND"));
      
      if (isSettingsNotFound) {
        logger.warn(
          {
            formId: formIdToUse,
            redirectUrl,
            portalType,
            message: "RegTank settings not found, but continuing with onboarding request",
          },
          "RegTank settings do not exist yet, continuing with corporate onboarding request"
        );
      } else {
        // Other errors - log but don't block
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            formId: formIdToUse,
            redirectUrl,
            portalType,
            message: "Failed to set RegTank settings, but continuing with onboarding request",
          },
          "Failed to set RegTank onboarding settings (non-blocking)"
        );
      }
      // Don't throw - continue with onboarding request
    }
    */

    const onboardingRequest: RegTankCorporateOnboardingRequest = {
      email: user.email,
      companyName: companyName,
      formName: formName,
      referenceId,
    };

    logger.info(
      {
        userId,
        organizationId,
        portalType,
        email: user.email,
        referenceId,
        companyName: onboardingRequest.companyName,
      },
      "Creating RegTank corporate onboarding request"
    );

    // Call RegTank API
    let regTankResponse;
    try {
      regTankResponse = await this.apiClient.createCorporateOnboarding(
        onboardingRequest
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          organizationId,
          userId,
          email: user.email,
        },
        "Failed to create RegTank corporate onboarding"
      );
      // Re-throw AppError as-is, wrap others
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        500,
        "REGTANK_ONBOARDING_FAILED",
        `Failed to start RegTank corporate onboarding: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Calculate expiration time (24 hours default)
    const expiresIn = regTankResponse.expiredIn || 86400;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Corporate onboarding starts with PENDING status
    const initialStatus = "PENDING";

    // Store onboarding record
    await this.repository.createOnboarding({
      userId,
      organizationId,
      organizationType: organization.type,
      portalType,
      requestId: regTankResponse.requestId,
      referenceId,
      onboardingType: "CORPORATE",
      verifyLink: regTankResponse.verifyLink,
      verifyLinkExpiresAt: expiresAt,
      status: initialStatus,
      regtankResponse: regTankResponse,
    });

    // Log onboarding started event
    const { ipAddress, userAgent, deviceInfo, deviceType } =
      extractRequestMetadata(req);
    const role = portalType === "investor" ? UserRole.INVESTOR : UserRole.ISSUER;

    await prisma.onboardingLog.create({
      data: {
        user_id: userId,
        role,
        event_type: "ONBOARDING_STARTED",
        portal: portalType,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_info: deviceInfo,
        device_type: deviceType,
        metadata: {
          organizationId,
          requestId: regTankResponse.requestId,
          onboardingType: "CORPORATE",
        },
      },
    });

    logger.info(
      {
        requestId: regTankResponse.requestId,
        organizationId,
        verifyLink: regTankResponse.verifyLink,
      },
      "RegTank corporate onboarding started successfully"
    );

    return {
      verifyLink: regTankResponse.verifyLink,
      requestId: regTankResponse.requestId,
      expiresIn,
      organizationType: organization.type,
    };
  }

  /**
   * Handle webhook update from RegTank
   */
  async handleWebhookUpdate(
    payload: RegTankWebhookPayload
  ): Promise<void> {
    const { requestId, status, substatus } = payload;

    logger.info(
      {
        requestId,
        status,
        substatus,
      },
      "Processing RegTank webhook"
    );

    // Find onboarding record
    const onboarding = await this.repository.findByRequestId(requestId);

    if (!onboarding) {
      logger.warn(
        { requestId },
        "Webhook received for unknown requestId"
      );
      throw new AppError(
        404,
        "ONBOARDING_NOT_FOUND",
        `Onboarding not found for requestId: ${requestId}`
      );
    }

    // Append webhook payload to history
    await this.repository.appendWebhookPayload(requestId, payload);

    // Update status
    const statusUpper = status.toUpperCase();
    
    // Status transition logic:
    // IN_PROGRESS → FORM_FILLING → LIVENESS_PASSED → PENDING_APPROVAL → APPROVED/REJECTED
    
    // Map RegTank status to our internal status
    let internalStatus = statusUpper;
    
    // Map form filling statuses (before liveness test)
    if (statusUpper === "PROCESSING" || statusUpper === "ID_UPLOADED" || statusUpper === "LIVENESS_STARTED") {
      internalStatus = "FORM_FILLING";
    } else if (statusUpper === "LIVENESS_PASSED") {
      internalStatus = "LIVENESS_PASSED";
    } else if (statusUpper === "WAIT_FOR_APPROVAL") {
      internalStatus = "PENDING_APPROVAL";
    } else if (statusUpper === "APPROVED" || statusUpper === "REJECTED") {
      internalStatus = statusUpper;
    }
    
    // Detect when liveness test is completed (for organization status updates)
    const isLivenessCompleted = 
      statusUpper === "LIVENESS_PASSED" || 
      statusUpper === "WAIT_FOR_APPROVAL";

    const updateData: {
      status: string;
      substatus?: string;
      completedAt?: Date;
    } = {
      status: internalStatus,
    };

    if (substatus) {
      updateData.substatus = substatus;
    }

    // Set completed_at if status is APPROVED or REJECTED
    if (status === "APPROVED" || status === "REJECTED") {
      updateData.completedAt = new Date();
    }

    await this.repository.updateStatus(requestId, updateData);

    // Update organization status based on RegTank status
    const organizationId = onboarding.investor_organization_id || onboarding.issuer_organization_id;

    // Update organization to PENDING_APPROVAL when liveness test completes
    if (isLivenessCompleted && organizationId) {
      const portalType = onboarding.portal_type as PortalType;
      
      try {
        if (portalType === "investor") {
          const orgExists = await this.organizationRepository.findInvestorOrganizationById(organizationId);
          if (orgExists) {
            await this.organizationRepository.updateInvestorOrganizationOnboarding(
              organizationId,
              OnboardingStatus.PENDING_APPROVAL
            );
            logger.info(
              { organizationId, portalType, requestId, status: statusUpper },
              "Liveness test completed, updated investor organization status to PENDING_APPROVAL"
            );
          } else {
            logger.warn(
              { organizationId, requestId },
              "Investor organization not found, skipping PENDING_APPROVAL update"
            );
          }
        } else {
          const orgExists = await this.organizationRepository.findIssuerOrganizationById(organizationId);
          if (orgExists) {
            await this.organizationRepository.updateIssuerOrganizationOnboarding(
              organizationId,
              OnboardingStatus.PENDING_APPROVAL
            );
            logger.info(
              { organizationId, portalType, requestId, status: statusUpper },
              "Liveness test completed, updated issuer organization status to PENDING_APPROVAL"
            );
          } else {
            logger.warn(
              { organizationId, requestId },
              "Issuer organization not found, skipping PENDING_APPROVAL update"
            );
          }
        }
      } catch (orgError) {
        logger.error(
          {
            error: orgError instanceof Error ? orgError.message : String(orgError),
            organizationId,
            portalType,
            requestId,
            status: statusUpper,
          },
          "Failed to update organization status to PENDING_APPROVAL"
        );
      }
    }

    // If approved, update organization status to COMPLETED
    if (status === "APPROVED" && organizationId) {
      const portalType = onboarding.portal_type as PortalType;

      // Update organization onboarding status
      // Check if organization exists first to prevent errors
      try {
        if (portalType === "investor") {
          const orgExists = await this.organizationRepository.findInvestorOrganizationById(organizationId);
          if (orgExists) {
            await this.organizationRepository.updateInvestorOrganizationOnboarding(
              organizationId,
              OnboardingStatus.COMPLETED
            );
            logger.info({ organizationId, portalType }, "Updated investor organization status to COMPLETED");
          } else {
            logger.warn(
              { organizationId, requestId },
              "Investor organization not found, skipping organization update"
            );
          }
        } else {
          const orgExists = await this.organizationRepository.findIssuerOrganizationById(organizationId);
          if (orgExists) {
            await this.organizationRepository.updateIssuerOrganizationOnboarding(
              organizationId,
              OnboardingStatus.COMPLETED
            );
            logger.info({ organizationId, portalType }, "Updated issuer organization status to COMPLETED");
          } else {
            logger.warn(
              { organizationId, requestId },
              "Issuer organization not found, skipping organization update"
            );
          }
        }
      } catch (orgError) {
        logger.error(
          {
            error: orgError instanceof Error ? orgError.message : String(orgError),
            organizationId,
            portalType,
            requestId,
          },
          "Failed to update organization status, continuing with user update"
        );
      }

      // Update user's account array
      const user = await prisma.user.findUnique({
        where: { user_id: onboarding.user_id },
      });

      if (user) {
        const accountArrayField =
          portalType === "investor" ? "investor_account" : "issuer_account";
        const currentArray =
          portalType === "investor"
            ? user.investor_account
            : user.issuer_account;

        // Find the first 'temp' and replace it with the organization ID
        const tempIndex = currentArray.indexOf("temp");
        if (tempIndex !== -1) {
          const updatedArray = [...currentArray];
          updatedArray[tempIndex] = organizationId;

          await prisma.user.update({
            where: { user_id: onboarding.user_id },
            data: {
              [accountArrayField]: { set: updatedArray },
            },
          });
        }
      }

      // Log onboarding completed
      const role =
        portalType === "investor" ? UserRole.INVESTOR : UserRole.ISSUER;

      await prisma.onboardingLog.create({
        data: {
          user_id: onboarding.user_id,
          role,
          event_type: "ONBOARDING_COMPLETED",
          portal: portalType,
          metadata: {
            organizationId,
            requestId,
            status: "APPROVED",
          },
        },
      });

      logger.info(
        {
          requestId,
          organizationId,
          portalType,
        },
        "Organization onboarding completed via RegTank webhook"
      );
    }

    logger.info(
      {
        requestId,
        status,
      },
      "RegTank webhook processed successfully"
    );
  }

  /**
   * Get onboarding status for an organization
   */
  async getOnboardingStatus(
    userId: string,
    organizationId: string,
    portalType: PortalType
  ): Promise<{
    status: string;
    substatus?: string;
    requestId?: string;
    verifyLink?: string;
    createdAt: Date;
    updatedAt: Date;
  }> {
    // Verify organization access
    const organization =
      portalType === "investor"
        ? await this.organizationRepository.findInvestorOrganizationById(
            organizationId
          )
        : await this.organizationRepository.findIssuerOrganizationById(
            organizationId
          );

    if (!organization) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
    }

    // Check access
    const isMember = organization.members.some(
      (m: { user_id: string }) => m.user_id === userId
    );
    const isOwner = organization.owner_user_id === userId;

    if (!isMember && !isOwner) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have access to this organization"
      );
    }

    // Find onboarding record
    const onboarding = await this.repository.findByOrganizationId(organizationId, portalType);

    if (!onboarding) {
      return {
        status: "NOT_STARTED",
        createdAt: organization.created_at,
        updatedAt: organization.updated_at,
      };
    }

    return {
      status: onboarding.status,
      substatus: onboarding.substatus || undefined,
      requestId: onboarding.request_id,
      verifyLink: onboarding.verify_link || undefined,
      createdAt: onboarding.created_at,
      updatedAt: onboarding.updated_at,
    };
  }

  /**
   * Manually sync onboarding status from RegTank API
   * Useful when webhooks are delayed or not configured
   */
  async syncOnboardingStatus(
    userId: string,
    organizationId: string,
    portalType: PortalType
  ): Promise<{
    status: string;
    substatus?: string;
    requestId: string;
    synced: boolean;
  }> {
    // Verify organization access
    const organization =
      portalType === "investor"
        ? await this.organizationRepository.findInvestorOrganizationById(
            organizationId
          )
        : await this.organizationRepository.findIssuerOrganizationById(
            organizationId
          );

    if (!organization) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
    }

    // Check access
    const isMember = organization.members.some(
      (m: { user_id: string }) => m.user_id === userId
    );
    const isOwner = organization.owner_user_id === userId;

    if (!isMember && !isOwner) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have access to this organization"
      );
    }

    // Find onboarding record
    const onboarding = await this.repository.findByOrganizationId(organizationId, portalType);

    if (!onboarding || !onboarding.request_id) {
      throw new AppError(
        404,
        "ONBOARDING_NOT_FOUND",
        "No RegTank onboarding found for this organization"
      );
    }

    // Fetch latest status from RegTank API
    logger.info(
      {
        requestId: onboarding.request_id,
        organizationId,
      },
      "Syncing onboarding status from RegTank API"
    );

    try {
      const details = await this.apiClient.getOnboardingDetails(onboarding.request_id);

      // Update our database with latest status
      const updateData: {
        status: string;
        substatus?: string;
        completedAt?: Date;
      } = {
        status: details.status.toUpperCase(),
      };

      if (details.substatus) {
        updateData.substatus = details.substatus;
      }

      // Set completed_at if status is APPROVED or REJECTED
      if (details.status === "APPROVED" || details.status === "REJECTED") {
        updateData.completedAt = new Date();
      }

      await this.repository.updateStatus(onboarding.request_id, updateData);

      // If approved, update organization status (same logic as webhook handler)
      if (details.status === "APPROVED") {
        if (portalType === "investor") {
          await prisma.investorOrganization.update({
            where: { id: organizationId },
            data: {
              onboarding_status: OnboardingStatus.COMPLETED,
              onboarded_at: new Date(),
            },
          });
        } else {
          await prisma.issuerOrganization.update({
            where: { id: organizationId },
            data: {
              onboarding_status: OnboardingStatus.COMPLETED,
              onboarded_at: new Date(),
            },
          });
        }

        logger.info(
          {
            requestId: onboarding.request_id,
            organizationId,
            portalType,
          },
          "Organization onboarding status updated to COMPLETED via manual sync"
        );
      }

      logger.info(
        {
          requestId: onboarding.request_id,
          status: details.status,
          organizationId,
        },
        "Onboarding status synced successfully from RegTank"
      );

      return {
        status: details.status,
        substatus: details.substatus,
        requestId: onboarding.request_id,
        synced: true,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          requestId: onboarding.request_id,
          organizationId,
        },
        "Failed to sync onboarding status from RegTank"
      );

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        500,
        "SYNC_FAILED",
        `Failed to sync status from RegTank: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Retry onboarding (restart failed/expired onboarding)
   */
  async retryOnboarding(
    _req: Request,
    userId: string,
    organizationId: string,
    portalType: PortalType
  ): Promise<{
    verifyLink: string;
    requestId: string;
    expiresIn: number;
    organizationType: string;
  }> {
    // Find existing onboarding
    const existingOnboarding = await this.repository.findByOrganizationId(
      organizationId,
      portalType
    );

    if (!existingOnboarding) {
      throw new AppError(
        404,
        "ONBOARDING_NOT_FOUND",
        "No onboarding found to retry. Please start a new onboarding instead."
      );
    }

    // Verify access
    const organization =
      portalType === "investor"
        ? await this.organizationRepository.findInvestorOrganizationById(
            organizationId
          )
        : await this.organizationRepository.findIssuerOrganizationById(
            organizationId
          );

    if (!organization || organization.owner_user_id !== userId) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "Only the organization owner can retry onboarding"
      );
    }

    // Call RegTank restart API
    const regTankResponse = await this.apiClient.restartOnboarding(
      existingOnboarding.request_id
    );

    // Update onboarding record with new verifyLink
    const expiresIn = regTankResponse.expiredIn || 86400;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // For personal accounts, set to IN_PROGRESS to match organization status
    // For company accounts, set to PENDING
    const retryStatus = organization.type === OrganizationType.PERSONAL 
      ? "IN_PROGRESS" 
      : "PENDING";

    await this.repository.updateStatus(existingOnboarding.request_id, {
      status: retryStatus,
      verifyLink: regTankResponse.verifyLink,
      verifyLinkExpiresAt: expiresAt,
    });

    logger.info(
      {
        requestId: existingOnboarding.request_id,
        organizationId,
        newVerifyLink: regTankResponse.verifyLink,
      },
      "RegTank onboarding restarted"
    );

    return {
      verifyLink: regTankResponse.verifyLink,
      requestId: existingOnboarding.request_id,
      expiresIn,
      organizationType: organization.type,
    };
  }

  /**
   * Set webhook preferences (global configuration)
   * Wrapper method for admin endpoints
   */
  async setWebhookPreferences(preferences: {
    webhookUrl: string;
    webhookEnabled: boolean;
  }): Promise<void> {
    return this.apiClient.setWebhookPreferences(preferences);
  }

  /**
   * Set onboarding settings (per formId)
   */
  async setOnboardingSettings(settings: {
    formId: number;
    livenessConfidence: number;
    approveMode: boolean;
    redirectUrl?: string;
    kycApprovalTarget?: string;
    enabledRegistrationEmail?: boolean;
  }): Promise<void> {
    return this.apiClient.setOnboardingSettings(settings);
  }

  /**
   * Get onboarding settings (per formId)
   * Wrapper method for admin endpoints
   */
  async getOnboardingSettings(formId: number): Promise<any> {
    return this.apiClient.getOnboardingSettings(formId);
  }
}

