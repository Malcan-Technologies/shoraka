import { Request } from "express";
import { RegTankRepository } from "./repository";
import { getRegTankAPIClient } from "./api-client";
import {
  RegTankIndividualOnboardingRequest,
  RegTankCorporateOnboardingRequest,
  RegTankWebhookPayload,
  PortalType,
} from "./types";
import { OnboardingStatus, OrganizationType, UserRole, Prisma } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { extractRequestMetadata } from "../../lib/http/request-utils";
import { OrganizationRepository } from "../organization/repository";
import { AuthRepository } from "../auth/repository";
import { getRegTankConfig } from "../../config/regtank";

export class RegTankService {
  private repository: RegTankRepository;
  private apiClient = getRegTankAPIClient();
  private organizationRepository: OrganizationRepository;
  private authRepository: AuthRepository;

  constructor() {
    this.repository = new RegTankRepository();
    this.organizationRepository = new OrganizationRepository();
    this.authRepository = new AuthRepository();
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
        ? await this.organizationRepository.findInvestorOrganizationById(organizationId)
        : await this.organizationRepository.findIssuerOrganizationById(organizationId);

    if (!organization) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
    }

    // Verify user owns the organization
    if (organization.owner_user_id !== userId) {
      throw new AppError(403, "FORBIDDEN", "Only the organization owner can start onboarding");
    }

    // Check if organization is already completed
    if (organization.onboarding_status === OnboardingStatus.COMPLETED) {
      throw new AppError(400, "ALREADY_COMPLETED", "Onboarding is already completed");
    }

    // For personal accounts, ensure organization status is IN_PROGRESS when starting/resuming onboarding
    // This allows users to resume onboarding if it was restarted by admin
    const previousOrgStatus = organization.onboarding_status;
    
    if (organization.type === OrganizationType.PERSONAL) {
      if (
        previousOrgStatus === OnboardingStatus.PENDING ||
        previousOrgStatus === OnboardingStatus.IN_PROGRESS
      ) {
        await this.organizationRepository.updateInvestorOrganizationOnboarding(
          organizationId,
          OnboardingStatus.IN_PROGRESS
        );
        logger.info(
          { organizationId, previousStatus: previousOrgStatus },
          "Updated personal organization status to IN_PROGRESS for onboarding"
        );
      }
    }

    // Check if we should resume existing onboarding for this organization
    // Resume if:
    // - Organization status is NOT PENDING_APPROVAL or COMPLETED
    // - RegTank onboarding status is NOT LIVENESS_PASSED, PENDING_APPROVAL, or APPROVED
    // - verify_link exists and is valid
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

      // For personal accounts, ensure organization status is IN_PROGRESS when resuming
      if (organization.type === OrganizationType.PERSONAL) {
        if (
          organization.onboarding_status === OnboardingStatus.PENDING ||
          organization.onboarding_status === OnboardingStatus.IN_PROGRESS
        ) {
          await this.organizationRepository.updateInvestorOrganizationOnboarding(
            organizationId,
            OnboardingStatus.IN_PROGRESS
          );
          logger.info(
            { organizationId, previousStatus: organization.onboarding_status },
            "Updated personal organization status to IN_PROGRESS when resuming onboarding"
          );
        }
      }

      // Log ONBOARDING_RESUMED when resuming existing onboarding (only once, here)
      const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);
      const role = portalType === "investor" ? UserRole.INVESTOR : UserRole.ISSUER;

      await prisma.onboardingLog.create({
        data: {
          user_id: userId,
          role,
          event_type: "ONBOARDING_RESUMED",
          portal: portalType,
          ip_address: ipAddress,
          user_agent: userAgent,
          device_info: deviceInfo,
          device_type: deviceType,
          metadata: {
            organizationId,
            requestId: existingOnboarding.request_id,
            onboardingType: "INDIVIDUAL",
            previousOrgStatus: organization.onboarding_status,
            previousRegTankStatus: existingOnboarding.status,
          },
        },
      });

      // Ensure onboarding settings are configured before resuming
      const formId = parseInt(process.env.REGTANK_INVESTOR_PERSONAL_FORM_ID || "1036131", 10);
      const config = getRegTankConfig();
      const redirectUrl = config.redirectUrlInvestor;

      try {
        await this.apiClient.setOnboardingSettings({
          formId,
          livenessConfidence: 70,
          approveMode: true,
          kycApprovalTarget: "ACURIS",
          enabledRegistrationEmail: false,
          redirectUrl,
        });
        logger.info(
          { formId, redirectUrl },
          "RegTank onboarding settings configured successfully (resume)"
        );
      } catch (error) {
        // Log but don't block - settings might already be configured
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            formId,
            redirectUrl,
            message: "Failed to set RegTank settings during resume, but continuing",
          },
          "Failed to set RegTank onboarding settings during resume (non-blocking)"
        );
      }

      return {
        verifyLink: existingOnboarding.verify_link,
        requestId: existingOnboarding.request_id,
        expiresIn: existingOnboarding.verify_link_expires_at
          ? Math.floor((existingOnboarding.verify_link_expires_at.getTime() - Date.now()) / 1000)
          : 86400,
        organizationType: existingOnboarding.organization_type,
      };
    }

    // Prepare RegTank onboarding request
    const referenceId = organizationId; // Use organization ID as reference

    // Determine webhook endpoint based on REGTANK_WEBHOOK_MODE
    // If REGTANK_WEBHOOK_MODE=dev, use /v1/webhooks/regtank/dev
    // Otherwise, use /v1/webhooks/regtank (production)
    const webhookMode = process.env.REGTANK_WEBHOOK_MODE || "prod";
    const webhookEndpoint =
      webhookMode === "dev" ? "/v1/webhooks/regtank/dev" : "/v1/webhooks/regtank";

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

    // Set onboarding settings (no redirect URL - users navigate back manually)
    // Settings are per formId, so we need to set them once per formId
    // Note: formId is required - use investor personal form ID (investor portal only)
    const formId = parseInt(process.env.REGTANK_INVESTOR_PERSONAL_FORM_ID || "1036131", 10);

    // Check if webhookUrl is localhost
    if (webhookUrl.includes("localhost") || webhookUrl.includes("127.0.0.1")) {
      logger.error(
        {
          webhookUrl,
          message:
            "Localhost URLs are not accessible from RegTank servers. Use a public URL or ngrok for development.",
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
      logger.info({ webhookUrl }, "RegTank webhook preferences configured successfully");
    } catch (error) {
      // Log but don't block - webhook preferences might already be set
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          webhookUrl,
          message:
            "Failed to set RegTank webhook preferences, but continuing with onboarding request",
        },
        "Failed to set RegTank webhook preferences (non-blocking)"
      );
    }

    // Set onboarding settings with redirect URL - called once per formId
    // Redirect URL points to dashboard so users are redirected back after completing onboarding
    const config = getRegTankConfig();
    const redirectUrl = config.redirectUrlInvestor;

    try {
      await this.apiClient.setOnboardingSettings({
        formId,
        livenessConfidence: 70,
        approveMode: true,
        kycApprovalTarget: "ACURIS",
        enabledRegistrationEmail: false,
        redirectUrl,
      });
      logger.info({ formId, redirectUrl }, "RegTank onboarding settings configured successfully");
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
        webhookUrl,
        formId,
      },
      "Creating RegTank individual onboarding request"
    );

    // Call RegTank API
    let regTankResponse;
    try {
      regTankResponse = await this.apiClient.createIndividualOnboarding(onboardingRequest);
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
    const initialStatus =
      organization.type === OrganizationType.PERSONAL ? "IN_PROGRESS" : "PENDING";

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
      regtankResponse: regTankResponse as Prisma.InputJsonValue,
    });

    // Log onboarding event - always ONBOARDING_STARTED when creating a new onboarding
    // Note: ONBOARDING_RESUMED is only logged in the shouldResume block above when actually resuming
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);
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
          previousOrgStatus: previousOrgStatus,
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
        ? process.env.REGTANK_INVESTOR_CORPORATE_FORM_NAME ||
          "Cashsauk Business Onboarding Form"
        : process.env.REGTANK_ISSUER_CORPORATE_FORM_NAME ||
          "Cashsauk Business Onboarding Form";

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
        ? await this.organizationRepository.findInvestorOrganizationById(organizationId)
        : await this.organizationRepository.findIssuerOrganizationById(organizationId);

    if (!organization) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
    }

    // Verify user owns the organization
    if (organization.owner_user_id !== userId) {
      throw new AppError(403, "FORBIDDEN", "Only the organization owner can start onboarding");
    }

    // Check if organization is already completed
    if (organization.onboarding_status === OnboardingStatus.COMPLETED) {
      throw new AppError(400, "ALREADY_COMPLETED", "Onboarding is already completed");
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
    if (existingOnboarding && ["PENDING", "IN_PROGRESS"].includes(existingOnboarding.status)) {
      if (existingOnboarding.verify_link) {
        // Ensure onboarding settings are configured before resuming
        const config = getRegTankConfig();
        const redirectUrl =
          portalType === "investor" ? config.redirectUrlInvestor : config.redirectUrlIssuer;

        // Get formId based on portal type
        let formIdToUse = formId;
        if (!formIdToUse) {
          if (portalType === "investor") {
            formIdToUse = parseInt(process.env.REGTANK_INVESTOR_CORPORATE_FORM_ID || "1015520", 10);
          } else {
            formIdToUse = parseInt(process.env.REGTANK_ISSUER_CORPORATE_FORM_ID || "1015520", 10);
          }
        }

        try {
          await this.apiClient.setOnboardingSettings({
            formId: formIdToUse,
            livenessConfidence: 70,
            approveMode: true,
            kycApprovalTarget: "ACURIS",
            enabledRegistrationEmail: false,
            redirectUrl,
          });
          logger.info(
            { formId: formIdToUse, redirectUrl, portalType },
            "RegTank onboarding settings configured successfully (corporate resume)"
          );
        } catch (error) {
          // Log but don't block - settings might already be configured
          logger.warn(
            {
              error: error instanceof Error ? error.message : String(error),
              formId: formIdToUse,
              redirectUrl,
              portalType,
              message: "Failed to set RegTank settings during corporate resume, but continuing",
            },
            "Failed to set RegTank onboarding settings during corporate resume (non-blocking)"
          );
        }

        return {
          verifyLink: existingOnboarding.verify_link,
          requestId: existingOnboarding.request_id,
          expiresIn: existingOnboarding.verify_link_expires_at
            ? Math.floor((existingOnboarding.verify_link_expires_at.getTime() - Date.now()) / 1000)
            : 86400,
          organizationType: organization.type,
        };
      }
    }

    // Prepare RegTank corporate onboarding request
    const referenceId = organizationId; // Use organization ID as reference

    // Get portal-specific redirectUrl from config
    const config = getRegTankConfig();
    const redirectUrl =
      portalType === "investor" ? config.redirectUrlInvestor : config.redirectUrlIssuer;

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

    // Set onboarding settings with redirect URL - called once per formId
    // Redirect URL points to dashboard so users are redirected back after completing onboarding
    try {
      await this.apiClient.setOnboardingSettings({
        formId: formIdToUse,
        livenessConfidence: 70,
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
      regTankResponse = await this.apiClient.createCorporateOnboarding(onboardingRequest);
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
      regtankResponse: regTankResponse as Prisma.InputJsonValue,
    });

    // Log onboarding started event
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);
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
   * Extract data from RegTank API response and update organization
   */
  /**
   * Normalize value - convert empty strings, "null" strings, and undefined to actual null
   */
  private normalizeValue(value: unknown): string | null {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      value === "null" ||
      String(value).trim() === ""
    ) {
      return null;
    }
    return typeof value === "string" ? value : String(value);
  }

  /**
   * Parse date safely, handling various formats and null values
   */
  private parseDate(value: unknown): Date | null {
    if (!value || value === "null" || value === "") {
      return null;
    }
    try {
      // Narrow the type for Date constructor
      const dateValue =
        typeof value === "string" || typeof value === "number" ? value : String(value);
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        logger.warn({ value }, "Invalid date format, returning null");
        return null;
      }
      return date;
    } catch (error) {
      logger.warn(
        { value, error: error instanceof Error ? error.message : String(error) },
        "Failed to parse date, returning null"
      );
      return null;
    }
  }

  /**
   * Determine if an investor qualifies as a sophisticated investor based on RegTank form data.
   *
   * Criteria (any one = true):
   * - COMPANY type: Always qualifies as sophisticated investor
   * - PERSONAL type (any one qualifies):
   *   1. Net Assets >= RM 3,000,000 (from compliance_declaration)
   *   2. Annual Income >= RM 300,000 (from compliance_declaration)
   *   3. Investment Portfolio >= RM 1,000,000 (from compliance_declaration)
   *   4. Professional Qualification = "Yes" (from compliance_declaration)
   *   5. Experience Categories = "Yes" (from compliance_declaration)
   *
   * @returns { isSophisticated: boolean; reason: string | null }
   */
  private determineSophisticatedInvestorStatus(
    complianceDeclaration: unknown,
    organizationType: OrganizationType
  ): { isSophisticated: boolean; reason: string | null } {
    // For COMPANY type, always return true
    if (organizationType === "COMPANY") {
      logger.info("COMPANY type organization, automatically qualifies as sophisticated investor");
      return { isSophisticated: true, reason: "Company organization" };
    }

    const reasons: string[] = [];

    // Check compliance declaration for all qualifying criteria
    if (complianceDeclaration && typeof complianceDeclaration === "object") {
      const complianceData = complianceDeclaration as {
        content?: Array<{ fieldName: string; alias?: string; fieldValue: boolean | string | null }>;
      };
      if (Array.isArray(complianceData.content)) {
        for (const field of complianceData.content) {
          const fieldName = field.fieldName?.toLowerCase() || "";
          const alias = field.alias?.toLowerCase() || "";
          const fieldValue = field.fieldValue;
          const isYes = fieldValue === true || String(fieldValue).toLowerCase() === "yes";

          // Check Net Assets (net personal assets exceeding RM3,000,000)
          if (fieldName.includes("net assets") || alias.includes("net assets")) {
            if (isYes) {
              logger.info(
                { fieldName: field.fieldName },
                "Sophisticated investor: Net Assets = Yes"
              );
              reasons.push("Net personal assets exceeding RM3,000,000");
            }
          }

          // Check Annual Income (annual income exceeding RM300,000)
          if (fieldName.includes("annual income") || alias.includes("annual income")) {
            if (isYes) {
              logger.info(
                { fieldName: field.fieldName },
                "Sophisticated investor: Annual Income = Yes"
              );
              reasons.push("Annual income exceeding RM300,000");
            }
          }

          // Check Investment Portfolio (investment portfolio exceeding RM1,000,000)
          if (
            fieldName.includes("net personal investment portfolio") ||
            fieldName.includes("net joint investment portfolio") ||
            fieldName.includes("rm1,000,000")
          ) {
            if (isYes) {
              logger.info(
                { fieldName: field.fieldName },
                "Sophisticated investor: Investment Portfolio > RM1,000,000 = Yes"
              );
              reasons.push("Investment portfolio exceeding RM1,000,000");
            }
          }

          // Check Professional Qualification
          if (
            fieldName.includes("professional qualification") ||
            alias.includes("professional qualification")
          ) {
            if (isYes) {
              logger.info(
                { fieldName: field.fieldName },
                "Sophisticated investor: Professional Qualification = Yes"
              );
              reasons.push("Professional qualification");
            }
          }

          // Check Experience Categories
          if (
            fieldName.includes("experience categories") ||
            alias.includes("experience categories")
          ) {
            if (isYes) {
              logger.info(
                { fieldName: field.fieldName },
                "Sophisticated investor: Experience Categories = Yes"
              );
              reasons.push("Capital market experience");
            }
          }
        }
      }
    }

    const isSophisticated = reasons.length > 0;
    const reason = reasons.length > 0 ? reasons.join("; ") : null;

    logger.info(
      { isSophisticated, reason, reasonCount: reasons.length },
      "Sophisticated investor status determined"
    );

    return { isSophisticated, reason };
  }

  private async extractAndUpdateOrganizationData(
    organizationId: string,
    portalType: PortalType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    regtankDetails: Record<string, any>,
    requestId?: string
  ): Promise<void> {
    try {
      const userProfile = regtankDetails.userProfile || {};
      // formContent is nested inside userProfile, not at root level
      const formContent = userProfile.formContent || {};
      const displayAreas = formContent.displayAreas || [];

      // Extract basic user information from userProfile only (not ocrResults)
      const firstName = this.normalizeValue(userProfile.firstName);
      const lastName = this.normalizeValue(userProfile.lastName);
      const middleName = this.normalizeValue(userProfile.middleName);
      const nationality = this.normalizeValue(userProfile.nationality);
      const country = this.normalizeValue(userProfile.country);
      const idIssuingCountry = this.normalizeValue(userProfile.idIssuingCountry);
      const gender = this.normalizeValue(userProfile.gender);
      const address = this.normalizeValue(userProfile.address);
      const dateOfBirth = this.parseDate(userProfile.dateOfBirth);
      let documentType = this.normalizeValue(userProfile.documentType);
      // Use documentNum from userProfile (not ocrResults)
      let documentNumber = this.normalizeValue(
        userProfile.documentNum || userProfile.governmentIdNumber
      );
      const phoneNumber = this.normalizeValue(userProfile.phoneNumber);
      // kycId is at root level, not in userProfile
      // Try multiple possible locations/field names for kycId
      // Also check nested locations (userProfile, documentInfo, etc.)
      let kycId = this.normalizeValue(regtankDetails.kycId);

      // Fetch onboarding record once to use for both kycId and OCR extraction
      let onboardingWithWebhooks = null;
      if (requestId) {
        onboardingWithWebhooks = await this.repository.findByRequestId(requestId);
      }

      // If kycId is not found in regtankDetails, try to get it from webhook payloads (KYC webhook requestId)
      if (
        !kycId &&
        onboardingWithWebhooks?.webhook_payloads &&
        Array.isArray(onboardingWithWebhooks.webhook_payloads)
      ) {
        for (const payload of onboardingWithWebhooks.webhook_payloads) {
          if (payload && typeof payload === "object" && !Array.isArray(payload)) {
            const payloadObj = payload as Record<string, unknown>;
            // KYC webhooks have requestId that is the kycId (starts with "KYC")
            if (
              payloadObj.requestId &&
              typeof payloadObj.requestId === "string" &&
              payloadObj.requestId.startsWith("KYC")
            ) {
              kycId = payloadObj.requestId;
              logger.info(
                {
                  organizationId,
                  requestId,
                  kycId,
                  webhookType: payloadObj.webhookType || "unknown",
                },
                "Extracted kycId from KYC webhook requestId in extractAndUpdateOrganizationData"
              );
              break;
            }
            // Also check if kycId field exists directly in payload
            if (payloadObj.kycId && typeof payloadObj.kycId === "string") {
              kycId = payloadObj.kycId;
              logger.info(
                {
                  organizationId,
                  requestId,
                  kycId,
                  webhookType: payloadObj.webhookType || "unknown",
                },
                "Extracted kycId from webhook payload in extractAndUpdateOrganizationData"
              );
              break;
            }
          }
        }
      }

      // Extract OCR data (idNumber and idType) from Individual Onboarding webhook payloads
      // OCR results are more accurate than userProfile values, so we prioritize them
      if (
        onboardingWithWebhooks?.webhook_payloads &&
        Array.isArray(onboardingWithWebhooks.webhook_payloads)
      ) {
        for (const payload of onboardingWithWebhooks.webhook_payloads) {
          if (payload && typeof payload === "object" && !Array.isArray(payload)) {
            const payloadObj = payload as Record<string, unknown>;
            // Individual Onboarding webhooks have ocrResults field
            if (payloadObj.ocrResults && typeof payloadObj.ocrResults === "object") {
              const ocrResults = payloadObj.ocrResults as Record<string, unknown>;
              // Extract idNumber (document_number) from OCR results
              if (ocrResults.idNumber && typeof ocrResults.idNumber === "string") {
                documentNumber = this.normalizeValue(ocrResults.idNumber);
                logger.info(
                  {
                    organizationId,
                    requestId,
                    documentNumber,
                    source: "ocrResults.idNumber",
                  },
                  "Extracted document_number from OCR results in Individual Onboarding webhook"
                );
              }
              // Extract idType (document_type) from OCR results
              if (ocrResults.idType && typeof ocrResults.idType === "string") {
                documentType = this.normalizeValue(ocrResults.idType);
                logger.info(
                  {
                    organizationId,
                    requestId,
                    documentType,
                    source: "ocrResults.idType",
                  },
                  "Extracted document_type from OCR results in Individual Onboarding webhook"
                );
              }
              // Once we find OCR results, we can break (OCR results are typically in the latest Individual Onboarding webhook)
              break;
            }
          }
        }
      }

      // Extract display areas - store entire displayArea object as JSON
      let bankAccountDetails = null;
      let wealthDeclaration = null;
      let complianceDeclaration = null;

      logger.debug(
        {
          organizationId,
          hasFormContent: !!formContent,
          displayAreasCount: displayAreas.length,
          displayAreaNames: displayAreas.map((a: { displayArea?: string }) => a.displayArea),
          userProfileKeys: Object.keys(userProfile),
        },
        "Extracting display areas from RegTank response"
      );

      for (const area of displayAreas) {
        const areaName = area?.displayArea;
        if (areaName === "Bank Account Details") {
          // Store the entire displayArea object (includes displayArea name and content array)
          bankAccountDetails = area || null;
          logger.debug(
            { organizationId, found: "Bank Account Details" },
            "Found Bank Account Details display area"
          );
        } else if (areaName === "Wealth Declaration") {
          // Store the entire displayArea object
          wealthDeclaration = area || null;
          logger.debug(
            { organizationId, found: "Wealth Declaration" },
            "Found Wealth Declaration display area"
          );
        } else if (areaName === "Compliance Declarations") {
          // Store the entire displayArea object
          complianceDeclaration = area || null;
          logger.debug(
            { organizationId, found: "Compliance Declarations" },
            "Found Compliance Declarations display area"
          );
        }
      }

      // Extract document info and liveness check info - ensure they're proper objects or null
      const documentInfo =
        regtankDetails.documentInfo && typeof regtankDetails.documentInfo === "object"
          ? regtankDetails.documentInfo
          : null;
      const livenessCheckInfo =
        regtankDetails.livenessCheckInfo && typeof regtankDetails.livenessCheckInfo === "object"
          ? regtankDetails.livenessCheckInfo
          : null;

      // Log extracted values for debugging
      logger.debug(
        {
          organizationId,
          extracted: {
            firstName,
            lastName,
            middleName,
            nationality,
            country,
            idIssuingCountry,
            gender,
            address,
            dateOfBirth: dateOfBirth ? dateOfBirth.toISOString() : null,
            documentType,
            documentNumber,
            phoneNumber,
            kycId,
            hasBankAccountDetails: !!bankAccountDetails,
            hasWealthDeclaration: !!wealthDeclaration,
            hasComplianceDeclaration: !!complianceDeclaration,
            hasDocumentInfo: !!documentInfo,
            hasLivenessCheckInfo: !!livenessCheckInfo,
          },
        },
        "Extracted values before database update"
      );

      // Update organization based on portal type
      const updateData = {
        first_name: firstName,
        last_name: lastName,
        middle_name: middleName,
        nationality,
        country,
        id_issuing_country: idIssuingCountry,
        gender,
        address,
        date_of_birth: dateOfBirth,
        document_type: documentType,
        document_number: documentNumber,
        phone_number: phoneNumber,
        kyc_id: kycId,
        bank_account_details: bankAccountDetails,
        wealth_declaration: wealthDeclaration,
        compliance_declaration: complianceDeclaration,
        document_info: documentInfo,
        liveness_check_info: livenessCheckInfo,
      };

      logger.info(
        {
          organizationId,
          portalType,
          updateDataKeys: Object.keys(updateData),
          updateDataValues: {
            firstName: updateData.first_name,
            lastName: updateData.last_name,
            kycId: updateData.kyc_id,
            hasBankAccount: !!updateData.bank_account_details,
            hasWealth: !!updateData.wealth_declaration,
            hasCompliance: !!updateData.compliance_declaration,
            hasDocumentInfo: !!updateData.document_info,
            hasLivenessInfo: !!updateData.liveness_check_info,
          },
        },
        "Updating organization with extracted RegTank data"
      );

      if (portalType === "investor") {
        // Verify organization exists and get type before updating
        const org = await prisma.investorOrganization.findUnique({
          where: { id: organizationId },
          select: {
            id: true,
            type: true,
            owner_user_id: true,
            is_sophisticated_investor: true,
            sophisticated_investor_reason: true,
          },
        });

        if (!org) {
          throw new Error(`Investor organization ${organizationId} not found`);
        }

        // Determine sophisticated investor status for investor organizations
        const sophisticatedResult = this.determineSophisticatedInvestorStatus(
          complianceDeclaration,
          org.type
        );

        logger.info(
          {
            organizationId,
            organizationType: org.type,
            isSophisticatedInvestor: sophisticatedResult.isSophisticated,
            sophisticatedInvestorReason: sophisticatedResult.reason,
          },
          "Determined sophisticated investor status"
        );

        const updated = await prisma.investorOrganization.update({
          where: { id: organizationId },
          data: {
            ...updateData,
            is_sophisticated_investor: sophisticatedResult.isSophisticated,
            sophisticated_investor_reason: sophisticatedResult.reason,
          },
        });

        // Log sophisticated status determination if status was set
        if (sophisticatedResult.isSophisticated) {
          await prisma.onboardingLog.create({
            data: {
              user_id: org.owner_user_id,
              role: UserRole.INVESTOR,
              event_type: "SOPHISTICATED_STATUS_UPDATED",
              portal: "investor",
              metadata: {
                organizationId,
                previousStatus: org.is_sophisticated_investor,
                previousReason: org.sophisticated_investor_reason,
                newStatus: sophisticatedResult.isSophisticated,
                newReason: sophisticatedResult.reason,
                updatedBy: "system",
                action: "auto_granted",
                source: "regtank_onboarding",
              },
            },
          });

          logger.info(
            {
              organizationId,
              userId: org.owner_user_id,
              status: sophisticatedResult.isSophisticated,
              reason: sophisticatedResult.reason,
            },
            "Logged automatic sophisticated investor status grant"
          );
        }

        logger.info(
          {
            organizationId,
            updatedFields: Object.keys(updateData).filter(
              (key) => updateData[key as keyof typeof updateData] !== null
            ),
            hasFirstName: !!updated.first_name,
            hasLastName: !!updated.last_name,
            hasKycId: !!updated.kyc_id,
          },
          "Successfully updated investor organization with RegTank data"
        );
      } else {
        // Verify organization exists before updating
        const orgExists = await prisma.issuerOrganization.findUnique({
          where: { id: organizationId },
          select: { id: true },
        });

        if (!orgExists) {
          throw new Error(`Issuer organization ${organizationId} not found`);
        }

        const updated = await prisma.issuerOrganization.update({
          where: { id: organizationId },
          data: updateData,
        });

        logger.info(
          {
            organizationId,
            updatedFields: Object.keys(updateData).filter(
              (key) => updateData[key as keyof typeof updateData] !== null
            ),
            hasFirstName: !!updated.first_name,
            hasLastName: !!updated.last_name,
            hasKycId: !!updated.kyc_id,
          },
          "Successfully updated issuer organization with RegTank data"
        );
      }

      logger.info(
        {
          organizationId,
          portalType,
          kycId,
          extractedFields: {
            firstName: !!firstName,
            lastName: !!lastName,
            middleName: !!middleName,
            nationality: !!nationality,
            country: !!country,
            idIssuingCountry: !!idIssuingCountry,
            gender: !!gender,
            address: !!address,
            dateOfBirth: !!dateOfBirth,
            documentType: !!documentType,
            documentNumber: !!documentNumber,
            phoneNumber: !!phoneNumber,
            kycId: !!kycId,
            bankAccountDetails: !!bankAccountDetails,
            wealthDeclaration: !!wealthDeclaration,
            complianceDeclaration: !!complianceDeclaration,
            documentInfo: !!documentInfo,
            livenessCheckInfo: !!livenessCheckInfo,
          },
        },
        "Extracted and updated organization data from RegTank"
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          organizationId,
          portalType,
        },
        "Failed to extract and update organization data from RegTank"
      );
      throw error;
    }
  }

  /**
   * Handle webhook update from RegTank
   */
  async handleWebhookUpdate(payload: RegTankWebhookPayload): Promise<void> {
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
    let onboarding = await this.repository.findByRequestId(requestId);

    if (!onboarding) {
      logger.warn({ requestId }, "Webhook received for unknown requestId");
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

    // Status transition logic for regtank_onboarding table:
    // IN_PROGRESS → PENDING_APPROVAL → PENDING_AML → COMPLETED/APPROVED
    // Note: Final approval is done on our side, not in RegTank

    // Map RegTank status to our internal status
    let internalStatus = statusUpper;

    // Map form filling statuses (before liveness test)
    if (
      statusUpper === "PROCESSING" ||
      statusUpper === "ID_UPLOADED" ||
      statusUpper === "LIVENESS_STARTED"
    ) {
      internalStatus = "FORM_FILLING";
    } else if (statusUpper === "LIVENESS_PASSED") {
      internalStatus = "LIVENESS_PASSED";
    } else if (statusUpper === "WAIT_FOR_APPROVAL") {
      internalStatus = "PENDING_APPROVAL";
    } else if (statusUpper === "APPROVED") {
      // When RegTank approves, set status to PENDING_AML (not APPROVED)
      // Final approval (COMPLETED) happens on our side after AML approval
      internalStatus = "PENDING_AML";
    } else if (statusUpper === "REJECTED") {
      internalStatus = statusUpper;
    }

    // Detect when liveness test is completed (for organization status updates)
    const isLivenessCompleted =
      statusUpper === "LIVENESS_PASSED" || statusUpper === "WAIT_FOR_APPROVAL";

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

    // Set completed_at if status is REJECTED
    // Note: APPROVED from RegTank becomes PENDING_AML, so we don't set completed_at yet
    // completed_at will be set when status becomes COMPLETED after final approval
    if (statusUpper === "REJECTED") {
      updateData.completedAt = new Date();
    }

    await this.repository.updateStatus(requestId, updateData);

    // Log the status update for verification
    logger.info(
      {
        requestId,
        regtankStatus: statusUpper,
        internalStatus,
        organizationId: onboarding.investor_organization_id || onboarding.issuer_organization_id,
        portalType: onboarding.portal_type,
        note:
          internalStatus === "PENDING_AML"
            ? "Status set to PENDING_AML (will remain until final approval)"
            : `Status set to ${internalStatus}`,
      },
      "[RegTank Webhook] Updated regtank_onboarding.status"
    );

    // Update organization status based on RegTank status
    const organizationId = onboarding.investor_organization_id || onboarding.issuer_organization_id;

    // Update organization to PENDING_APPROVAL when liveness test completes
    if (isLivenessCompleted && organizationId) {
      const portalType = onboarding.portal_type as PortalType;

      try {
        if (portalType === "investor") {
          const orgExists =
            await this.organizationRepository.findInvestorOrganizationById(organizationId);
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
          const orgExists =
            await this.organizationRepository.findIssuerOrganizationById(organizationId);
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

    // If approved by RegTank, fetch details and update organization to PENDING_AML
    // RegTank onboarding status is now PENDING_AML (not APPROVED)
    if (statusUpper === "APPROVED" && organizationId) {
      const portalType = onboarding.portal_type as PortalType;

      try {
        // Wait 3 seconds to allow KYC webhooks to arrive and be stored
        logger.info(
          { requestId, organizationId, portalType },
          "Waiting 3 seconds before fetching RegTank onboarding details to allow KYC webhooks to arrive"
        );
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Fetch full details from RegTank API
        logger.info(
          { requestId, organizationId, portalType },
          "Fetching RegTank onboarding details after approval"
        );

        // Re-fetch onboarding record to get latest webhook payloads (including any KYC webhooks that arrived)
        const updatedOnboarding = await this.repository.findByRequestId(requestId);
        if (updatedOnboarding) {
          onboarding = updatedOnboarding;
        }

        const regtankDetails = await this.apiClient.queryOnboardingDetails(requestId);

        // Log the response structure to debug kycId extraction
        // Check all possible locations for kycId
        const allKeys = Object.keys(regtankDetails);
        const kycLikeKeys = allKeys.filter(
          (key) =>
            key.toLowerCase().includes("kyc") ||
            (typeof regtankDetails[key] === "string" &&
              (regtankDetails[key] as string).startsWith("KYC"))
        );

        logger.info(
          {
            requestId,
            organizationId,
            hasKycId: "kycId" in regtankDetails,
            kycIdValue: regtankDetails.kycId,
            kycIdType: typeof regtankDetails.kycId,
            topLevelKeys: allKeys.slice(0, 40),
            kycLikeKeys,
            kycLikeValues: kycLikeKeys.map((key) => ({ key, value: regtankDetails[key] })),
            // Check if response is wrapped
            hasData: "data" in regtankDetails,
            hasResult: "result" in regtankDetails,
            // Sample of response structure
            responseSample: {
              requestId: regtankDetails.requestId,
              status: regtankDetails.status,
              kycId: regtankDetails.kycId,
              kycStatus: (regtankDetails as Record<string, unknown>).kycStatus,
              hasUserProfile: !!regtankDetails.userProfile,
            },
            // Check if kycId might be in a nested object
            fullResponseStructure: JSON.stringify(regtankDetails).substring(0, 500), // First 500 chars for debugging
          },
          "RegTank query response received - comprehensive kycId check"
        );

        // Try to get kycId from stored onboarding record's webhook payloads (KYC webhooks)
        // kycId might not be in the query response immediately, but may be in KYC webhook payloads
        let kycIdFromWebhooks: string | null = null;
        if (onboarding.webhook_payloads && Array.isArray(onboarding.webhook_payloads)) {
          for (const payload of onboarding.webhook_payloads) {
            if (payload && typeof payload === "object" && !Array.isArray(payload)) {
              const payloadObj = payload as Record<string, unknown>;
              // KYC webhooks have requestId that is the kycId
              if (
                payloadObj.requestId &&
                typeof payloadObj.requestId === "string" &&
                payloadObj.requestId.startsWith("KYC")
              ) {
                kycIdFromWebhooks = payloadObj.requestId;
                logger.info(
                  {
                    requestId,
                    kycIdFromWebhooks,
                    webhookType: payloadObj.webhookType || "unknown",
                  },
                  "Found kycId in stored webhook payloads"
                );
                break;
              }
              // Also check if kycId field exists directly
              if (payloadObj.kycId && typeof payloadObj.kycId === "string") {
                kycIdFromWebhooks = payloadObj.kycId;
                logger.info(
                  {
                    requestId,
                    kycIdFromWebhooks,
                    webhookType: payloadObj.webhookType || "unknown",
                  },
                  "Found kycId field in stored webhook payloads"
                );
                break;
              }
            }
          }
        }

        // If kycId is not in query response but found in webhooks, add it to regtankDetails
        if (!regtankDetails.kycId && kycIdFromWebhooks) {
          regtankDetails.kycId = kycIdFromWebhooks;
          logger.info(
            { requestId, kycId: kycIdFromWebhooks },
            "Added kycId from webhook payloads to regtankDetails"
          );
        }

        // Extract and update organization with RegTank data
        await this.extractAndUpdateOrganizationData(
          organizationId,
          portalType,
          regtankDetails,
          requestId
        );

        // Update organization status to PENDING_AML
        // After RegTank onboarding approval, we wait for AML screening to complete (separate webhook)
        // When AML webhook arrives, we will transition to:
        // - PERSONAL accounts: PENDING_FINAL_APPROVAL (no SSM needed)
        // - COMPANY accounts: PENDING_SSM_REVIEW (SSM verification required)
        if (portalType === "investor") {
          const org =
            await this.organizationRepository.findInvestorOrganizationById(organizationId);
          if (org) {
            const previousStatus = org.onboarding_status;
            await this.organizationRepository.updateInvestorOrganizationOnboarding(
              organizationId,
              OnboardingStatus.PENDING_AML
            );

            // Create onboarding log - ONBOARDING_APPROVED when RegTank approves
            try {
              await this.authRepository.createOnboardingLog({
                userId: onboarding.user_id,
                role: UserRole.INVESTOR,
                eventType: "ONBOARDING_APPROVED",
                portal: portalType,
                metadata: {
                  organizationId,
                  requestId,
                  previousStatus,
                  newStatus: OnboardingStatus.PENDING_AML,
                  trigger: "REGTANK_APPROVED",
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId,
                  requestId,
                },
                "Failed to create onboarding log (non-blocking)"
              );
            }

            logger.info(
              { organizationId, portalType, orgType: org.type },
              "Updated investor organization status to PENDING_AML after RegTank onboarding approval"
            );
          } else {
            logger.warn(
              { organizationId, requestId },
              "Investor organization not found, skipping organization update"
            );
          }
        } else {
          const org = await this.organizationRepository.findIssuerOrganizationById(organizationId);
          if (org) {
            const previousStatus = org.onboarding_status;
            await this.organizationRepository.updateIssuerOrganizationOnboarding(
              organizationId,
              OnboardingStatus.PENDING_AML
            );

            // Create onboarding status updated log
            try {
              await this.authRepository.createOnboardingLog({
                userId: onboarding.user_id,
                role: UserRole.ISSUER,
                eventType: "ONBOARDING_STATUS_UPDATED",
                portal: portalType,
                metadata: {
                  organizationId,
                  requestId,
                  previousStatus,
                  newStatus: OnboardingStatus.PENDING_AML,
                  trigger: "REGTANK_APPROVED",
                },
              });
            } catch (logError) {
              logger.error(
                {
                  error: logError instanceof Error ? logError.message : String(logError),
                  organizationId,
                  requestId,
                },
                "Failed to create onboarding status updated log (non-blocking)"
              );
            }

            logger.info(
              { organizationId, portalType },
              "Updated issuer organization status to PENDING_AML after RegTank onboarding approval"
            );
          } else {
            logger.warn(
              { organizationId, requestId },
              "Issuer organization not found, skipping organization update"
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
          "Failed to fetch RegTank details or update organization, continuing with webhook processing"
        );
        // Don't throw - allow webhook to complete even if data extraction fails
      }

      // Update user's account array
      const user = await prisma.user.findUnique({
        where: { user_id: onboarding.user_id },
      });

      if (user) {
        const accountArrayField = portalType === "investor" ? "investor_account" : "issuer_account";
        const currentArray =
          portalType === "investor" ? user.investor_account : user.issuer_account;

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

      // Note: USER_COMPLETED log is only created when final approval is completed by admin
      // See apps/api/src/modules/admin/service.ts completeFinalApproval()
      logger.info(
        {
          requestId,
          organizationId,
          portalType,
        },
        "Organization status updated to PENDING_AML after RegTank approval"
      );
    }

    // Create onboarding log entry for audit purposes
    try {
      const portalType = onboarding.portal_type as PortalType;
      const role = portalType === "investor" ? UserRole.INVESTOR : UserRole.ISSUER;

      // Determine event type based on status
      // Use new specific event types for better tracking
      // Note: ONBOARDING_APPROVED is logged separately when admin approves in RegTank (see extractAndUpdateOrganizationData)
      let eventType = "WEBHOOK_RECEIVED";
      if (statusUpper === "APPROVED") {
        // Don't log ONBOARDING_APPROVED here - it's logged in extractAndUpdateOrganizationData
        // when admin actually approves in RegTank portal
        eventType = "WEBHOOK_APPROVED";
      } else if (statusUpper === "REJECTED") {
        eventType = "WEBHOOK_REJECTED";
      } else if (statusUpper === "WAIT_FOR_APPROVAL" || statusUpper === "PENDING_APPROVAL") {
        eventType = "WEBHOOK_PENDING_APPROVAL";
      } else if (statusUpper === "LIVENESS_PASSED") {
        eventType = "FORM_FILLED";
      } else if (
        statusUpper === "FORM_FILLING" ||
        statusUpper === "PROCESSING" ||
        statusUpper === "ID_UPLOADED"
      ) {
        eventType = "FORM_FILLED";
      } else if (statusUpper === "IN_PROGRESS") {
        eventType = "WEBHOOK_IN_PROGRESS";
      }

      await this.authRepository.createOnboardingLog({
        userId: onboarding.user_id,
        role,
        eventType,
        portal: portalType,
        metadata: {
          requestId,
          status: statusUpper,
          substatus: substatus || null,
          payload: payload,
        },
      });

      logger.debug(
        {
          requestId,
          userId: onboarding.user_id,
          role,
          eventType,
          portalType,
        },
        "Created onboarding log entry for webhook"
      );
    } catch (logError) {
      // Log error but don't fail the webhook processing
      logger.error(
        {
          error: logError instanceof Error ? logError.message : String(logError),
          requestId,
          userId: onboarding.user_id,
        },
        "Failed to create onboarding log entry for webhook (non-blocking)"
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
        ? await this.organizationRepository.findInvestorOrganizationById(organizationId)
        : await this.organizationRepository.findIssuerOrganizationById(organizationId);

    if (!organization) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
    }

    // Check access
    const isMember = organization.members.some((m: { user_id: string }) => m.user_id === userId);
    const isOwner = organization.owner_user_id === userId;

    if (!isMember && !isOwner) {
      throw new AppError(403, "FORBIDDEN", "You do not have access to this organization");
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
        ? await this.organizationRepository.findInvestorOrganizationById(organizationId)
        : await this.organizationRepository.findIssuerOrganizationById(organizationId);

    if (!organization) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
    }

    // Check access
    const isMember = organization.members.some((m: { user_id: string }) => m.user_id === userId);
    const isOwner = organization.owner_user_id === userId;

    if (!isMember && !isOwner) {
      throw new AppError(403, "FORBIDDEN", "You do not have access to this organization");
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
      if (
        details.status.toUpperCase() === "APPROVED" ||
        details.status.toUpperCase() === "REJECTED"
      ) {
        updateData.completedAt = new Date();
      }

      await this.repository.updateStatus(onboarding.request_id, updateData);

      // If approved, fetch details from RegTank and update organization to PENDING_AML (same logic as webhook handler)
      if (details.status.toUpperCase() === "APPROVED") {
        try {
          // Fetch full details from RegTank API
          logger.info(
            { requestId: onboarding.request_id, organizationId, portalType },
            "Fetching RegTank onboarding details after approval (manual sync)"
          );

          const regtankDetails = await this.apiClient.queryOnboardingDetails(onboarding.request_id);

          logger.info(regtankDetails, "RegTank details");

          // Extract and update organization with RegTank data
          await this.extractAndUpdateOrganizationData(
            organizationId,
            portalType,
            regtankDetails,
            onboarding.request_id
          );

          // Update organization status to PENDING_AML
          // After RegTank onboarding approval, we wait for AML screening to complete (separate webhook)
          // When AML webhook arrives, we will transition to:
          // - PERSONAL accounts: PENDING_FINAL_APPROVAL (no SSM needed)
          // - COMPANY accounts: PENDING_SSM_REVIEW (SSM verification required)
          if (portalType === "investor") {
            const org =
              await this.organizationRepository.findInvestorOrganizationById(organizationId);
            if (org) {
              await this.organizationRepository.updateInvestorOrganizationOnboarding(
                organizationId,
                OnboardingStatus.PENDING_AML
              );
              logger.info(
                { organizationId, portalType, orgType: org.type },
                "Updated investor organization status to PENDING_AML via manual sync after RegTank onboarding approval"
              );
            } else {
              logger.warn(
                { organizationId, requestId: onboarding.request_id },
                "Investor organization not found, skipping organization update"
              );
            }
          } else {
            const org =
              await this.organizationRepository.findIssuerOrganizationById(organizationId);
            if (org) {
              await this.organizationRepository.updateIssuerOrganizationOnboarding(
                organizationId,
                OnboardingStatus.PENDING_AML
              );
              logger.info(
                { organizationId, portalType },
                "Updated issuer organization status to PENDING_AML via manual sync after RegTank onboarding approval"
              );
            } else {
              logger.warn(
                { organizationId, requestId: onboarding.request_id },
                "Issuer organization not found, skipping organization update"
              );
            }
          }
        } catch (error) {
          logger.error(
            {
              error: error instanceof Error ? error.message : String(error),
              organizationId,
              portalType,
              requestId: onboarding.request_id,
            },
            "Failed to fetch RegTank details or update organization during manual sync"
          );
          // Don't throw - allow sync to complete even if data extraction fails
        }
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
        ? await this.organizationRepository.findInvestorOrganizationById(organizationId)
        : await this.organizationRepository.findIssuerOrganizationById(organizationId);

    if (!organization || organization.owner_user_id !== userId) {
      throw new AppError(403, "FORBIDDEN", "Only the organization owner can retry onboarding");
    }

    // Get user email for restart (required for corporate onboarding)
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    // Determine formId and redirectUrl based on organization type and portal
    const config = getRegTankConfig();
    let formId: number;
    let redirectUrl: string;

    if (organization.type === OrganizationType.PERSONAL) {
      // Personal onboarding
      formId = parseInt(process.env.REGTANK_INVESTOR_PERSONAL_FORM_ID || "1036131", 10);
      redirectUrl = config.redirectUrlInvestor;
    } else {
      // Corporate onboarding
      if (portalType === "investor") {
        formId = parseInt(process.env.REGTANK_INVESTOR_CORPORATE_FORM_ID || "1015520", 10);
        redirectUrl = config.redirectUrlInvestor;
      } else {
        formId = parseInt(process.env.REGTANK_ISSUER_CORPORATE_FORM_ID || "1015520", 10);
        redirectUrl = config.redirectUrlIssuer;
      }
    }

    // Ensure onboarding settings are configured before restarting
    try {
      await this.apiClient.setOnboardingSettings({
        formId,
        livenessConfidence: 70,
        approveMode: true,
        kycApprovalTarget: "ACURIS",
        enabledRegistrationEmail: false,
        redirectUrl,
      });
      logger.info(
        { formId, redirectUrl, organizationType: organization.type, portalType },
        "RegTank onboarding settings configured successfully (retry)"
      );
    } catch (error) {
      // Log but don't block - settings might already be configured
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          formId,
          redirectUrl,
          organizationType: organization.type,
          portalType,
          message: "Failed to set RegTank settings during retry, but continuing",
        },
        "Failed to set RegTank onboarding settings during retry (non-blocking)"
      );
    }

    // Call RegTank restart API
    const regTankResponse = await this.apiClient.restartOnboarding(existingOnboarding.request_id, {
      email: user.email, // Required for corporate onboarding restart
    });

    // Update onboarding record with new verifyLink
    const expiresIn = regTankResponse.expiredIn || 86400;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // For personal accounts, set to IN_PROGRESS to match organization status
    // For company accounts, set to PENDING
    const retryStatus = organization.type === OrganizationType.PERSONAL ? "IN_PROGRESS" : "PENDING";

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
  async getOnboardingSettings(formId: number): Promise<unknown> {
    return this.apiClient.getOnboardingSettings(formId);
  }
}
