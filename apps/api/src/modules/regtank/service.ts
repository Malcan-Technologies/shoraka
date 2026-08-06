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
import { advanceOnboardingStatusFromFlags } from "../onboarding/utils/advance-onboarding-status";
import { normalizeRawStatus } from "@cashsouk/types";
import { decideIndividualApprovedOutcome } from "./helpers/individual-onboarding-transition";
import { assertIssuerOnboardingFeePaid } from "../payment/onboarding-fee-service";

type StartPersonalOnboardingResult = {
  verifyLink: string;
  requestId: string;
  expiresIn: number;
  organizationType: string;
};

type StartCorporateOnboardingResult = {
  verifyLink: string;
  requestId: string;
  expiresIn: number;
  organizationType: string;
};

type ResolvedRestartResponse = {
  requestId: string;
  verifyLink: string;
  expiredIn: number;
};

type ResolvedCompanyOnboardingResponse = {
  requestId: string;
  verifyLink: string;
  expiredIn: number;
};

const REUSABLE_PERSONAL_ONBOARDING_STATUSES = new Set<string>([
  "URL_GENERATED",
  "IN_PROGRESS",
  "PROCESSING",
  "ID_UPLOADED",
  "LIVENESS_STARTED",
  "LIVENESS_FAILED",
  "CAMERA_FAILED",
  "EMAIL_SENT",
  "ID_UPLOADED_FAILED",
  "RESUBMISSION",
]);

const PROTECTED_PERSONAL_ONBOARDING_STATUSES = new Set<string>([
  "WAIT_FOR_APPROVAL",
  "PENDING_APPROVAL",
  "LIVENESS_PASSED",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
]);

const PROVIDER_INVALID_OR_ENDED_PERSONAL_STATUSES = new Set<string>([
  "CANCELLED",
  "EXPIRED",
  "ENDED",
  "INVALID",
]);

const PROVIDER_INVALID_OR_ENDED_COMPANY_STATUSES = new Set<string>([
  "CANCELLED",
  "EXPIRED",
  "ENDED",
  "INVALID",
]);

const personalOnboardingSingleFlight = new Map<string, Promise<StartPersonalOnboardingResult>>();
const companyOnboardingSingleFlight = new Map<string, Promise<StartCorporateOnboardingResult>>();

const REUSABLE_COMPANY_ONBOARDING_STATUSES = new Set<string>([
  "PENDING",
  "IN_PROGRESS",
  "URL_GENERATED",
  "EMAIL_SENT",
]);

const REGENERATABLE_COMPANY_ONBOARDING_STATUSES = new Set<string>([
  ...REUSABLE_COMPANY_ONBOARDING_STATUSES,
  "CANCELLED",
  "EXPIRED",
]);

const PROTECTED_COMPANY_REGTANK_STATUSES = new Set<string>([
  "APPROVED",
  "REJECTED",
  "COMPLETED",
  "PENDING_APPROVAL",
  "WAIT_FOR_APPROVAL",
  "PENDING_SSM_REVIEW",
  "PENDING_AML",
  "PENDING_FINAL_APPROVAL",
]);

const PROTECTED_COMPANY_ORGANIZATION_STATUSES = new Set<OnboardingStatus>([
  OnboardingStatus.PENDING_APPROVAL,
  OnboardingStatus.PENDING_SSM_REVIEW,
  OnboardingStatus.PENDING_AML,
  OnboardingStatus.PENDING_FINAL_APPROVAL,
  OnboardingStatus.COMPLETED,
  OnboardingStatus.REJECTED,
]);

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

  private async runPersonalOnboardingSingleFlight(
    organizationId: string,
    run: () => Promise<StartPersonalOnboardingResult>
  ): Promise<StartPersonalOnboardingResult> {
    const existing = personalOnboardingSingleFlight.get(organizationId);
    if (existing) {
      return existing;
    }

    const inFlight = run().finally(() => {
      const current = personalOnboardingSingleFlight.get(organizationId);
      if (current === inFlight) {
        personalOnboardingSingleFlight.delete(organizationId);
      }
    });

    personalOnboardingSingleFlight.set(organizationId, inFlight);
    return inFlight;
  }

  private async runCompanyOnboardingSingleFlight(
    organizationId: string,
    run: () => Promise<StartCorporateOnboardingResult>
  ): Promise<StartCorporateOnboardingResult> {
    const existing = companyOnboardingSingleFlight.get(organizationId);
    if (existing) {
      return existing;
    }

    const inFlight = run().finally(() => {
      const current = companyOnboardingSingleFlight.get(organizationId);
      if (current === inFlight) {
        companyOnboardingSingleFlight.delete(organizationId);
      }
    });

    companyOnboardingSingleFlight.set(organizationId, inFlight);
    return inFlight;
  }

  private isVerifyLinkReusable(expiresAt: Date | null | undefined): boolean {
    if (!expiresAt) {
      return false;
    }
    return expiresAt.getTime() > Date.now();
  }

  private extractRequestIdFromVerifyLink(verifyLink: string): string | null {
    try {
      const parsed = new URL(verifyLink);
      const requestId = parsed.searchParams.get("requestId");
      return typeof requestId === "string" && requestId.trim().length > 0 ? requestId.trim() : null;
    } catch {
      return null;
    }
  }

  private resolvePersonalRestartResponse(params: {
    response: { requestId?: unknown; verifyLink?: unknown; expiredIn?: unknown };
    organizationId: string;
    previousRequestId: string;
    source: "start-personal-auto-restart" | "retry-personal";
  }): ResolvedRestartResponse {
    const { response, organizationId, previousRequestId, source } = params;
    const responseRequestId =
      typeof response.requestId === "string" && response.requestId.trim().length > 0
        ? response.requestId.trim()
        : "";
    const verifyLink =
      typeof response.verifyLink === "string" && response.verifyLink.trim().length > 0
        ? response.verifyLink
        : "";
    const parsedVerifyLinkRequestId = verifyLink
      ? this.extractRequestIdFromVerifyLink(verifyLink)
      : null;

    if (!responseRequestId || !verifyLink || !parsedVerifyLinkRequestId) {
      logger.error(
        {
          organizationId,
          previousRequestId,
          source,
          responseRequestId: responseRequestId || null,
          parsedVerifyLinkRequestId,
          hasVerifyLink: Boolean(verifyLink),
          reason: "missing requestId/verifyLink or verifyLink requestId",
        },
        "Invalid personal restart response from RegTank"
      );
      throw new AppError(
        503,
        "REGTANK_RESTART_RESPONSE_INVALID",
        "We could not verify your onboarding restart response from RegTank. Please try again shortly."
      );
    }

    if (parsedVerifyLinkRequestId !== responseRequestId) {
      logger.error(
        {
          organizationId,
          previousRequestId,
          source,
          responseRequestId,
          parsedVerifyLinkRequestId,
          reason: "requestId mismatch between response and verifyLink",
        },
        "RegTank personal restart response requestId mismatch"
      );
      throw new AppError(
        503,
        "REGTANK_RESTART_RESPONSE_MISMATCH",
        "We could not verify your onboarding restart response from RegTank. Please try again shortly."
      );
    }

    const expiredIn = typeof response.expiredIn === "number" && Number.isFinite(response.expiredIn)
      ? response.expiredIn
      : 86400;

    return {
      requestId: responseRequestId,
      verifyLink,
      expiredIn,
    };
  }

  private resolveCompanyOnboardingResponse(params: {
    response: { requestId?: unknown; verifyLink?: unknown; expiredIn?: unknown };
    organizationId: string;
    previousRequestId?: string;
    portalType: PortalType;
    source:
      | "start-corporate-new"
      | "start-corporate-regenerate"
      | "retry-company"
      | "admin-restart-company";
  }): ResolvedCompanyOnboardingResponse {
    const { response, organizationId, previousRequestId, portalType, source } = params;
    const responseRequestId =
      typeof response.requestId === "string" && response.requestId.trim().length > 0
        ? response.requestId.trim()
        : "";
    const verifyLink =
      typeof response.verifyLink === "string" && response.verifyLink.trim().length > 0
        ? response.verifyLink
        : "";
    const parsedVerifyLinkRequestId = verifyLink
      ? this.extractRequestIdFromVerifyLink(verifyLink)
      : null;

    if (!responseRequestId || !verifyLink || !parsedVerifyLinkRequestId) {
      logger.error(
        {
          organizationId,
          portalType,
          previousRequestId: previousRequestId || null,
          source,
          responseRequestId: responseRequestId || null,
          parsedVerifyLinkRequestId,
          hasVerifyLink: Boolean(verifyLink),
          reason: "missing requestId/verifyLink or verifyLink requestId",
        },
        "Invalid company onboarding response from RegTank"
      );
      throw new AppError(
        503,
        "REGTANK_CORPORATE_RESPONSE_INVALID",
        "We could not verify your company onboarding response from RegTank. Please try again shortly."
      );
    }

    if (parsedVerifyLinkRequestId !== responseRequestId) {
      logger.error(
        {
          organizationId,
          portalType,
          previousRequestId: previousRequestId || null,
          source,
          responseRequestId,
          parsedVerifyLinkRequestId,
          reason: "requestId mismatch between response and verifyLink",
        },
        "RegTank company onboarding response requestId mismatch"
      );
      throw new AppError(
        503,
        "REGTANK_CORPORATE_RESPONSE_MISMATCH",
        "We could not verify your company onboarding response from RegTank. Please try again shortly."
      );
    }

    const expiredIn = typeof response.expiredIn === "number" && Number.isFinite(response.expiredIn)
      ? response.expiredIn
      : 86400;

    return {
      requestId: responseRequestId,
      verifyLink,
      expiredIn,
    };
  }

  private isReusablePersonalOnboardingStatus(status: string): boolean {
    return REUSABLE_PERSONAL_ONBOARDING_STATUSES.has(status);
  }

  private isProtectedPersonalOnboardingStatus(status: string): boolean {
    return PROTECTED_PERSONAL_ONBOARDING_STATUSES.has(status);
  }

  private isProviderInvalidOrEndedPersonalStatus(status: string): boolean {
    return PROVIDER_INVALID_OR_ENDED_PERSONAL_STATUSES.has(status);
  }

  private isRegTankNotFoundError(error: unknown): boolean {
    if (error instanceof AppError) {
      if (error.statusCode === 404) return true;
      const message = `${error.code} ${error.message}`.toLowerCase();
      return (
        message.includes("not found") ||
        message.includes("data_not_found") ||
        message.includes("error_data_not_found")
      );
    }
    const fallback = String(error ?? "").toLowerCase();
    return fallback.includes("not found");
  }

  private isRegTankCorporateRequestNotFoundError(error: unknown, requestId: string): boolean {
    if (!(error instanceof AppError) || error.statusCode !== 404) {
      return false;
    }

    const message = `${error.code} ${error.message}`.toLowerCase();
    const normalizedRequestId = requestId.toLowerCase();
    const referencesCodRequest =
      message.includes(normalizedRequestId) || message.includes("cod");
    const indicatesNotFound =
      message.includes("not found") ||
      message.includes("record not found") ||
      message.includes("data_not_found") ||
      message.includes("error_data_not_found");

    return referencesCodRequest && indicatesNotFound;
  }

  private classifyRegTankStatusCheckFailure(error: unknown): {
    category: string;
    providerHttpStatus?: number;
  } {
    if (error instanceof AppError) {
      if (error.statusCode === 408) {
        return { category: "TIMEOUT", providerHttpStatus: error.statusCode };
      }
      if (error.statusCode >= 500 && error.statusCode <= 504) {
        return { category: "PROVIDER_HTTP_5XX", providerHttpStatus: error.statusCode };
      }
      if (error.code === "REGTANK_REQUEST_FAILED") {
        return { category: "NETWORK_OR_TRANSPORT_FAILURE", providerHttpStatus: error.statusCode };
      }
      if (error.code === "INVALID_RESPONSE") {
        return { category: "MALFORMED_PROVIDER_RESPONSE", providerHttpStatus: error.statusCode };
      }
      return { category: "PROVIDER_CHECK_ERROR", providerHttpStatus: error.statusCode };
    }
    return { category: "UNKNOWN_PROVIDER_CHECK_ERROR" };
  }

  private async shouldRestartExistingPersonalOnboardingLink(
    onboarding: NonNullable<Awaited<ReturnType<RegTankRepository["findByOrganizationId"]>>>,
    organizationId: string
  ): Promise<
    | { decision: "reuse"; providerStatus: string }
    | { decision: "restart"; reason: string }
    | { decision: "protected"; providerStatus: string }
    | { decision: "unavailable"; errorCategory: string; providerHttpStatus?: number }
  > {
    try {
      const details = await this.apiClient.getOnboardingDetails(onboarding.request_id);
      const providerStatusRaw = details?.status;
      const providerStatus = normalizeRawStatus(providerStatusRaw);

      if (typeof providerStatusRaw !== "string" || providerStatus.length === 0) {
        logger.warn(
          {
            organizationId,
            requestId: onboarding.request_id,
            errorCategory: "MALFORMED_PROVIDER_RESPONSE",
          },
          "Provider status check returned missing/invalid status for personal onboarding"
        );
        return { decision: "unavailable", errorCategory: "MALFORMED_PROVIDER_RESPONSE" };
      }

      if (this.isProtectedPersonalOnboardingStatus(providerStatus)) {
        return { decision: "protected", providerStatus };
      }

      if (this.isProviderInvalidOrEndedPersonalStatus(providerStatus)) {
        return {
          decision: "restart",
          reason: `Provider status requires restart: ${providerStatus || "UNKNOWN"}`,
        };
      }

      if (!this.isReusablePersonalOnboardingStatus(providerStatus)) {
        logger.warn(
          {
            organizationId,
            requestId: onboarding.request_id,
            errorCategory: "AMBIGUOUS_PROVIDER_STATUS",
            providerStatus,
          },
          "Provider status is not reusable and not in known dead/protected sets"
        );
        return {
          decision: "unavailable",
          errorCategory: "AMBIGUOUS_PROVIDER_STATUS",
        };
      }

      return { decision: "reuse", providerStatus };
    } catch (error) {
      if (this.isRegTankNotFoundError(error)) {
        return { decision: "restart", reason: "Provider request not found" };
      }

      const { category, providerHttpStatus } = this.classifyRegTankStatusCheckFailure(error);
      logger.warn(
        {
          organizationId,
          requestId: onboarding.request_id,
          errorCategory: category,
          providerHttpStatus,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        "Provider status check unavailable for personal onboarding link"
      );
      return { decision: "unavailable", errorCategory: category, providerHttpStatus };
    }
  }

  private isReusableCompanyOnboardingStatus(status: string): boolean {
    return REUSABLE_COMPANY_ONBOARDING_STATUSES.has(status);
  }

  private isProviderInvalidOrEndedCompanyStatus(status: string): boolean {
    return PROVIDER_INVALID_OR_ENDED_COMPANY_STATUSES.has(status);
  }

  private isProtectedCompanyRegTankStatus(status: string): boolean {
    return PROTECTED_COMPANY_REGTANK_STATUSES.has(status);
  }

  private isRegeneratableCompanyStatus(status: string): boolean {
    return REGENERATABLE_COMPANY_ONBOARDING_STATUSES.has(status);
  }

  private isProtectedCompanyOrganizationStatus(status: OnboardingStatus): boolean {
    return PROTECTED_COMPANY_ORGANIZATION_STATUSES.has(status);
  }

  private isCompanyLinkSafelyReusable(
    onboarding: Pick<Prisma.RegTankOnboardingUncheckedCreateInput, "verify_link" | "verify_link_expires_at"> & {
      status?: string | null;
    }
  ): boolean {
    const status = normalizeRawStatus(onboarding.status);
    return (
      this.isReusableCompanyOnboardingStatus(status) &&
      Boolean(onboarding.verify_link) &&
      this.isVerifyLinkReusable(onboarding.verify_link_expires_at as Date | null | undefined)
    );
  }

  private async shouldRegenerateExistingCompanyOnboardingLink(
    onboarding: NonNullable<Awaited<ReturnType<RegTankRepository["findByOrganizationId"]>>>,
    organizationId: string
  ): Promise<
    | { decision: "reuse"; providerStatus: string }
    | { decision: "regenerate"; reason: string }
    | { decision: "protected"; providerStatus: string }
    | { decision: "unavailable"; errorCategory: string; providerHttpStatus?: number }
  > {
    try {
      const details = await this.apiClient.getCorporateOnboardingDetails(onboarding.request_id);
      const providerRequestIdRaw = details?.requestId;
      const providerStatusRaw = details?.status;
      const providerStatus = normalizeRawStatus(providerStatusRaw);
      const providerRequestId =
        typeof providerRequestIdRaw === "string" ? providerRequestIdRaw.trim() : "";

      if (providerRequestId.length === 0 || providerRequestId !== onboarding.request_id) {
        logger.warn(
          {
            organizationId,
            requestId: onboarding.request_id,
            providerRequestId,
            errorCategory: "MISMATCHED_OR_MISSING_PROVIDER_REQUEST_ID",
          },
          "Provider status check returned mismatched or missing COD requestId"
        );
        return {
          decision: "unavailable",
          errorCategory: "MISMATCHED_OR_MISSING_PROVIDER_REQUEST_ID",
        };
      }

      if (typeof providerStatusRaw !== "string" || providerStatus.length === 0) {
        logger.warn(
          {
            organizationId,
            requestId: onboarding.request_id,
            errorCategory: "MALFORMED_PROVIDER_RESPONSE",
          },
          "Provider status check returned missing/invalid status for company onboarding"
        );
        return { decision: "unavailable", errorCategory: "MALFORMED_PROVIDER_RESPONSE" };
      }

      if (this.isProtectedCompanyRegTankStatus(providerStatus)) {
        return { decision: "protected", providerStatus };
      }

      if (this.isProviderInvalidOrEndedCompanyStatus(providerStatus)) {
        return {
          decision: "regenerate",
          reason: `Provider status requires regeneration: ${providerStatus || "UNKNOWN"}`,
        };
      }

      if (this.isReusableCompanyOnboardingStatus(providerStatus)) {
        return { decision: "reuse", providerStatus };
      }

      logger.warn(
        {
          organizationId,
          requestId: onboarding.request_id,
          providerStatus,
          errorCategory: "AMBIGUOUS_PROVIDER_STATUS",
        },
        "Provider status is not reusable and not in known dead/protected sets for company onboarding"
      );
      return {
        decision: "unavailable",
        errorCategory: "AMBIGUOUS_PROVIDER_STATUS",
      };
    } catch (error) {
      if (this.isRegTankCorporateRequestNotFoundError(error, onboarding.request_id)) {
        return { decision: "regenerate", reason: "Provider COD request not found" };
      }

      const { category, providerHttpStatus } = this.classifyRegTankStatusCheckFailure(error);
      logger.warn(
        {
          organizationId,
          requestId: onboarding.request_id,
          errorCategory: category,
          providerHttpStatus,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        "Provider status check unavailable for company onboarding link"
      );
      return { decision: "unavailable", errorCategory: category, providerHttpStatus };
    }
  }

  private async generateCompanyOnboardingLinkFromExisting(params: {
    req: Request;
    userId: string;
    organizationId: string;
    portalType: PortalType;
    organizationType: OrganizationType;
    companyName: string;
    formName: string;
    existingOnboarding: NonNullable<Awaited<ReturnType<RegTankRepository["findByOrganizationId"]>>>;
  }): Promise<StartCorporateOnboardingResult> {
    const {
      req,
      userId,
      organizationId,
      portalType,
      organizationType,
      companyName,
      formName,
      existingOnboarding,
    } = params;

    const onboardingRequest: RegTankCorporateOnboardingRequest = {
      email: (await prisma.user.findUnique({
        where: { user_id: userId },
        select: { email: true },
      }))!.email,
      companyName,
      formName,
      referenceId: organizationId,
    };

    const regTankResponse = await this.apiClient.createCorporateOnboarding(onboardingRequest);
    const resolvedResponse = this.resolveCompanyOnboardingResponse({
      response: regTankResponse as { requestId?: unknown; verifyLink?: unknown; expiredIn?: unknown },
      organizationId,
      previousRequestId: existingOnboarding.request_id,
      portalType,
      source: "start-corporate-regenerate",
    });
    const expiresIn = resolvedResponse.expiredIn;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    if (resolvedResponse.requestId === existingOnboarding.request_id) {
      await this.repository.updateStatus(existingOnboarding.request_id, {
        status: "PENDING",
        verifyLink: resolvedResponse.verifyLink,
        verifyLinkExpiresAt: expiresAt,
        regtankResponse: regTankResponse as Prisma.InputJsonValue,
      });

      return {
        verifyLink: resolvedResponse.verifyLink,
        requestId: resolvedResponse.requestId,
        expiresIn,
        organizationType,
      };
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.regTankOnboarding.update({
          where: { id: existingOnboarding.id },
          data: {
            status: "CANCELLED",
            substatus: `Auto-regenerated company onboarding link. New requestId: ${resolvedResponse.requestId}`,
          },
        });

        await tx.regTankOnboarding.create({
          data: {
            user_id: userId,
            investor_organization_id: portalType === "investor" ? organizationId : null,
            issuer_organization_id: portalType === "issuer" ? organizationId : null,
            organization_type: organizationType,
            portal_type: portalType,
            request_id: resolvedResponse.requestId,
            reference_id: `${organizationId}-corp-regenerated-${Date.now()}`,
            onboarding_type: "CORPORATE",
            verify_link: resolvedResponse.verifyLink,
            verify_link_expires_at: expiresAt,
            status: "PENDING",
            regtank_response: regTankResponse as Prisma.InputJsonValue,
          },
        });
      });
    } catch (error) {
      logger.error(
        {
          organizationId,
          oldRequestId: existingOnboarding.request_id,
          newRequestId: resolvedResponse.requestId,
          error: error instanceof Error ? error.message : String(error),
        },
        "RegTank company link regeneration succeeded upstream but failed local persistence"
      );
      throw error;
    }

    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);
    await prisma.onboardingLog.create({
      data: {
        user_id: userId,
        role: portalType === "investor" ? UserRole.INVESTOR : UserRole.ISSUER,
        event_type: "ONBOARDING_RESUMED",
        portal: portalType,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_info: deviceInfo,
        device_type: deviceType,
        investor_organization_id: portalType === "investor" ? organizationId : null,
        issuer_organization_id: portalType === "issuer" ? organizationId : null,
        metadata: {
          organizationId,
          previousRequestId: existingOnboarding.request_id,
          newRequestId: resolvedResponse.requestId,
          onboardingType: "CORPORATE",
          trigger: "AUTO_REGENERATE_EXPIRED_COMPANY_LINK",
        },
      },
    });

    logger.info(
      {
        organizationId,
        previousRequestId: existingOnboarding.request_id,
        newRequestId: resolvedResponse.requestId,
      },
      "Auto-regenerated company onboarding link"
    );

    return {
      verifyLink: resolvedResponse.verifyLink,
      requestId: resolvedResponse.requestId,
      expiresIn,
      organizationType,
    };
  }

  private async restartExpiredOrCancelledPersonalOnboarding(params: {
    req: Request;
    userId: string;
    organizationId: string;
    organizationType: OrganizationType;
    previousOrgStatus: OnboardingStatus;
    portalType: PortalType;
    existingOnboarding: NonNullable<Awaited<ReturnType<RegTankRepository["findByOrganizationId"]>>>;
  }): Promise<StartPersonalOnboardingResult> {
    const {
      req,
      userId,
      organizationId,
      organizationType,
      previousOrgStatus,
      portalType,
      existingOnboarding,
    } = params;

    const regTankResponse = await this.apiClient.restartOnboarding(existingOnboarding.request_id);
    const resolvedRestart = this.resolvePersonalRestartResponse({
      response: regTankResponse as { requestId?: unknown; verifyLink?: unknown; expiredIn?: unknown },
      organizationId,
      previousRequestId: existingOnboarding.request_id,
      source: "start-personal-auto-restart",
    });
    const expiresIn = resolvedRestart.expiredIn;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    if (existingOnboarding.status !== "CANCELLED") {
      await this.repository.cancelOnboarding(
        existingOnboarding.id,
        `Auto-restarted due to stale/expired link. New requestId: ${resolvedRestart.requestId}`
      );
    }

    await this.repository.createOnboarding({
      userId,
      organizationId,
      organizationType,
      portalType,
      requestId: resolvedRestart.requestId,
      referenceId: `${organizationId}-restart-${Date.now()}`,
      onboardingType: "INDIVIDUAL",
      verifyLink: resolvedRestart.verifyLink,
      verifyLinkExpiresAt: expiresAt,
      status: "IN_PROGRESS",
      regtankResponse: regTankResponse as Prisma.InputJsonValue,
    });

    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);
    await prisma.onboardingLog.create({
      data: {
        user_id: userId,
        role: UserRole.INVESTOR,
        event_type: "ONBOARDING_RESUMED",
        portal: portalType,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_info: deviceInfo,
        device_type: deviceType,
        investor_organization_id: organizationId,
        issuer_organization_id: null,
        metadata: {
          organizationId,
          previousRequestId: existingOnboarding.request_id,
          newRequestId: resolvedRestart.requestId,
          onboardingType: "INDIVIDUAL",
          previousOrgStatus,
          trigger: "AUTO_RESTART_EXPIRED_OR_STALE_LINK",
        },
      },
    });

    logger.info(
      {
        organizationId,
        previousRequestId: existingOnboarding.request_id,
        newRequestId: resolvedRestart.requestId,
      },
      "Auto-restarted personal onboarding due to stale/expired link"
    );

    return {
      verifyLink: resolvedRestart.verifyLink,
      requestId: resolvedRestart.requestId,
      expiresIn,
      organizationType,
    };
  }

  /**
   * Start personal (individual) onboarding for an organization
   */
  async startPersonalOnboarding(
    req: Request,
    userId: string,
    organizationId: string,
    portalType: PortalType
  ): Promise<StartPersonalOnboardingResult> {
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

    if (portalType === "investor" && !organization.tnc_accepted) {
      throw new AppError(
        402,
        "TNC_REQUIRED",
        "Terms and Conditions must be accepted before starting identity verification"
      );
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

    return this.runPersonalOnboardingSingleFlight(organizationId, async () => {
      const existingOnboarding = await this.repository.findByOrganizationId(
        organizationId,
        portalType
      );
      const rtStored = normalizeRawStatus(existingOnboarding?.status);
      const hasVerifyLink = Boolean(existingOnboarding?.verify_link);
      const hasReusableExpiry = this.isVerifyLinkReusable(existingOnboarding?.verify_link_expires_at);
      const reusableStatus = this.isReusablePersonalOnboardingStatus(rtStored);

      const shouldResume =
        organization.onboarding_status !== OnboardingStatus.PENDING_APPROVAL &&
        existingOnboarding &&
        hasVerifyLink &&
        hasReusableExpiry &&
        reusableStatus;

      if (shouldResume && existingOnboarding.verify_link) {
        const providerLinkDecision = await this.shouldRestartExistingPersonalOnboardingLink(
          existingOnboarding,
          organizationId
        );

        if (providerLinkDecision.decision === "protected") {
          throw new AppError(
            400,
            "INVALID_STATE",
            `Cannot start onboarding in status: ${providerLinkDecision.providerStatus}. Please contact support if restart is required.`
          );
        }

        if (providerLinkDecision.decision === "restart") {
          logger.info(
            {
              organizationId,
              requestId: existingOnboarding.request_id,
              reason: providerLinkDecision.reason,
            },
            "Existing personal onboarding link failed provider pre-check; auto-restarting before redirect"
          );

          return this.restartExpiredOrCancelledPersonalOnboarding({
            req,
            userId,
            organizationId,
            organizationType: organization.type,
            previousOrgStatus,
            portalType,
            existingOnboarding,
          });
        }

        if (providerLinkDecision.decision === "unavailable") {
          throw new AppError(
            503,
            "REGTANK_STATUS_CHECK_UNAVAILABLE",
            "We could not verify your onboarding status with RegTank. Please try again shortly."
          );
        }

        logger.info(
          {
            userId,
            organizationId,
            requestId: existingOnboarding.request_id,
            orgStatus: organization.onboarding_status,
            rtStatus: existingOnboarding.status,
            providerStatus: providerLinkDecision.providerStatus,
          },
          "Resuming existing onboarding for organization (active and unexpired)"
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
            organization_name: organization.name,
            investor_organization_id: organizationId,
            issuer_organization_id: null,
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
          expiresIn: Math.floor(
            (existingOnboarding.verify_link_expires_at!.getTime() - Date.now()) / 1000
          ),
          organizationType: existingOnboarding.organization_type,
        };
      }

      if (existingOnboarding) {
        if (this.isProtectedPersonalOnboardingStatus(rtStored)) {
          throw new AppError(
            400,
            "INVALID_STATE",
            `Cannot start onboarding in status: ${rtStored}. Please contact support if restart is required.`
          );
        }

        const shouldAutoRestart =
          rtStored === "CANCELLED" ||
          rtStored === "EXPIRED" ||
          !hasVerifyLink ||
          !hasReusableExpiry ||
          reusableStatus;

        if (shouldAutoRestart) {
          return this.restartExpiredOrCancelledPersonalOnboarding({
            req,
            userId,
            organizationId,
            organizationType: organization.type,
            previousOrgStatus,
            portalType,
            existingOnboarding,
          });
        }

        throw new AppError(
          400,
          "INVALID_STATE",
          `Cannot start onboarding in status: ${rtStored || "UNKNOWN"}`
        );
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
          organization_name: organization.name,
          investor_organization_id: organizationId,
          issuer_organization_id: null,
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
    });
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
  ): Promise<StartCorporateOnboardingResult> {
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

    if (portalType === "issuer") {
      await assertIssuerOnboardingFeePaid(prisma, organizationId);
    }

    if (portalType === "investor" && !organization.tnc_accepted) {
      throw new AppError(
        402,
        "TNC_REQUIRED",
        "Terms and Conditions must be accepted before starting identity verification"
      );
    }

    return this.runCompanyOnboardingSingleFlight(organizationId, async () => {
      // Check if there's already an active onboarding
      const existingOnboarding = await this.repository.findByOrganizationId(
        organizationId,
        portalType
      );

      const rtStatus = normalizeRawStatus(existingOnboarding?.status);

      if (this.isProtectedCompanyOrganizationStatus(organization.onboarding_status)) {
        throw new AppError(
          400,
          "INVALID_STATE",
          `Cannot continue company onboarding in organization status: ${organization.onboarding_status}`
        );
      }

      if (existingOnboarding && this.isProtectedCompanyRegTankStatus(rtStatus)) {
        throw new AppError(
          400,
          "INVALID_STATE",
          `Cannot continue company onboarding in status: ${rtStatus}`
        );
      }

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

      if (existingOnboarding && this.isCompanyLinkSafelyReusable(existingOnboarding)) {
        const providerDecision = await this.shouldRegenerateExistingCompanyOnboardingLink(
          existingOnboarding,
          organizationId
        );

        if (providerDecision.decision === "reuse") {
          logger.info(
            {
              organizationId,
              requestId: existingOnboarding.request_id,
              providerStatus: providerDecision.providerStatus,
              decision: "reuse",
            },
            "Reusing existing company onboarding link after provider status verification"
          );
          return {
            verifyLink: existingOnboarding.verify_link!,
            requestId: existingOnboarding.request_id,
            expiresIn: Math.floor(
              (existingOnboarding.verify_link_expires_at!.getTime() - Date.now()) / 1000
            ),
            organizationType: organization.type,
          };
        }

        if (providerDecision.decision === "protected") {
          throw new AppError(
            400,
            "INVALID_STATE",
            `Cannot continue company onboarding in status: ${providerDecision.providerStatus}`
          );
        }

        if (providerDecision.decision === "unavailable") {
          throw new AppError(
            503,
            "REGTANK_STATUS_CHECK_UNAVAILABLE",
            "We could not verify your onboarding status with RegTank. Please try again shortly."
          );
        }

        logger.info(
          {
            organizationId,
            requestId: existingOnboarding.request_id,
            decision: "regenerate",
            reason: providerDecision.reason,
          },
          "Regenerating company onboarding link after provider status verification"
        );

        const latest = await this.repository.findByOrganizationId(organizationId, portalType);
        if (
          latest &&
          latest.request_id !== existingOnboarding.request_id &&
          this.isCompanyLinkSafelyReusable(latest)
        ) {
          return {
            verifyLink: latest.verify_link!,
            requestId: latest.request_id,
            expiresIn: Math.floor((latest.verify_link_expires_at!.getTime() - Date.now()) / 1000),
            organizationType: organization.type,
          };
        }

        if (latest && this.isProtectedCompanyRegTankStatus(normalizeRawStatus(latest.status))) {
          throw new AppError(
            400,
            "INVALID_STATE",
            `Cannot continue company onboarding in status: ${normalizeRawStatus(latest.status)}`
          );
        }

        if (latest && this.isRegeneratableCompanyStatus(normalizeRawStatus(latest.status))) {
          return this.generateCompanyOnboardingLinkFromExisting({
            req,
            userId,
            organizationId,
            portalType,
            organizationType: organization.type,
            companyName,
            formName,
            existingOnboarding: latest,
          });
        }
      }

      if (existingOnboarding && this.isRegeneratableCompanyStatus(rtStatus)) {
        // Re-check latest row inside protected single-flight operation.
        const latest = await this.repository.findByOrganizationId(organizationId, portalType);
        if (latest && this.isCompanyLinkSafelyReusable(latest)) {
          return {
            verifyLink: latest.verify_link!,
            requestId: latest.request_id,
            expiresIn: Math.floor((latest.verify_link_expires_at!.getTime() - Date.now()) / 1000),
            organizationType: organization.type,
          };
        }

        if (latest && this.isProtectedCompanyRegTankStatus(normalizeRawStatus(latest.status))) {
          throw new AppError(
            400,
            "INVALID_STATE",
            `Cannot continue company onboarding in status: ${normalizeRawStatus(latest.status)}`
          );
        }

        if (latest && this.isRegeneratableCompanyStatus(normalizeRawStatus(latest.status))) {
          return this.generateCompanyOnboardingLinkFromExisting({
            req,
            userId,
            organizationId,
            portalType,
            organizationType: organization.type,
            companyName,
            formName,
            existingOnboarding: latest,
          });
        }

        if (latest) {
          throw new AppError(
            400,
            "INVALID_STATE",
            `Cannot continue company onboarding in status: ${normalizeRawStatus(latest.status) || "UNKNOWN"}`
          );
        }
      }

      if (!existingOnboarding) {
        // Prepare RegTank corporate onboarding request
        const referenceId = organizationId; // Use organization ID as reference

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

        const resolvedResponse = this.resolveCompanyOnboardingResponse({
          response: regTankResponse as { requestId?: unknown; verifyLink?: unknown; expiredIn?: unknown },
          organizationId,
          portalType,
          source: "start-corporate-new",
        });

        // Calculate expiration time (24 hours default)
        const expiresIn = resolvedResponse.expiredIn;
        const expiresAt = new Date(Date.now() + expiresIn * 1000);

        // Corporate onboarding starts with PENDING status
        const initialStatus = "PENDING";

        // Store onboarding record
        await this.repository.createOnboarding({
          userId,
          organizationId,
          organizationType: organization.type,
          portalType,
          requestId: resolvedResponse.requestId,
          referenceId,
          onboardingType: "CORPORATE",
          verifyLink: resolvedResponse.verifyLink,
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
            organization_name: organization.name,
            investor_organization_id: portalType === "investor" ? organizationId : null,
            issuer_organization_id: portalType === "issuer" ? organizationId : null,
            metadata: {
              organizationId,
              requestId: resolvedResponse.requestId,
              onboardingType: "CORPORATE",
            },
          },
        });

        logger.info(
          {
            requestId: resolvedResponse.requestId,
            organizationId,
          },
          "RegTank corporate onboarding started successfully"
        );

        return {
          verifyLink: resolvedResponse.verifyLink,
          requestId: resolvedResponse.requestId,
          expiresIn,
          organizationType: organization.type,
        };
      }

      throw new AppError(
        400,
        "INVALID_STATE",
        `Cannot continue company onboarding in status: ${rtStatus || "UNKNOWN"}`
      );
    });
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

  /** Build the IC legal name from RegTank OCR fields (name, fullName, or first/last parts). */
  private extractOcrLegalName(ocrResults: Record<string, unknown>): string | null {
    const directName = this.normalizeValue(ocrResults.name ?? ocrResults.fullName);
    if (directName) {
      return directName;
    }

    const parts = [
      this.normalizeValue(ocrResults.firstName),
      this.normalizeValue(ocrResults.middleName),
      this.normalizeValue(ocrResults.lastName),
    ].filter(Boolean) as string[];

    return parts.length > 0 ? parts.join(" ") : null;
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

      // Extract OCR data (idNumber, idType, legal name) from Individual Onboarding webhook payloads
      // OCR results are more accurate than userProfile values, so we prioritize them
      let legalNameOnId: string | null = null;
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
              legalNameOnId = this.extractOcrLegalName(ocrResults);
              if (legalNameOnId) {
                logger.info(
                  {
                    organizationId,
                    requestId,
                    legalNameOnId,
                    source: "ocrResults",
                  },
                  "Extracted legal_name_on_id from OCR results in Individual Onboarding webhook"
                );
              }
              // Once we find OCR results, we can break (OCR results are typically in the latest Individual Onboarding webhook)
              break;
            }
          }
        }
      }

      if (!legalNameOnId) {
        const profileParts = [firstName, middleName, lastName]
          .map((part) => part?.trim())
          .filter(Boolean);
        if (profileParts.length > 0) {
          legalNameOnId = profileParts.join(" ");
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
        legal_name_on_id: legalNameOnId,
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
            name: true,
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
              organization_name: org.name,
              investor_organization_id: organizationId,
              issuer_organization_id: null,
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

    // Note: raw payload persistence is owned by the caller (the actual webhook intake
    // handler already appends the full received payload before invoking this method,
    // and the admin "Refresh status" path is not a webhook and stores its live-query
    // snapshot separately in `regtank_response`). Appending a synthetic payload here
    // would duplicate/misrepresent webhook history, so it is intentionally not done.

    // Update status
    const statusUpper = status.toUpperCase();

    const persistedRegtankStatus = normalizeRawStatus(status);

    // Detect when liveness test is completed (for organization status updates)
    const isLivenessCompleted =
      statusUpper === "LIVENESS_PASSED" || statusUpper === "WAIT_FOR_APPROVAL";

    const updateData: {
      status: string;
      substatus?: string;
      completedAt?: Date;
    } = {
      status: persistedRegtankStatus,
    };

    if (substatus) {
      updateData.substatus = substatus;
    }

    if (statusUpper === "REJECTED") {
      updateData.completedAt = new Date();
    }

    await this.repository.updateStatus(requestId, updateData);

    // Log the status update for verification
    logger.info(
      {
        requestId,
        regtankStatus: statusUpper,
        persistedRegtankStatus,
        organizationId: onboarding.investor_organization_id || onboarding.issuer_organization_id,
        portalType: onboarding.portal_type,
        note: `reg_tank_onboarding.status set to ${persistedRegtankStatus || "(empty)"}`,
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
              OnboardingStatus.PENDING_APPROVAL,
              { resetCompanySsmGateFromRegtankWebhook: true }
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
              OnboardingStatus.PENDING_APPROVAL,
              { resetCompanySsmGateFromRegtankWebhook: true }
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

        // User milestone after RegTank onboarding approval:
        // - COMPANY: first admin step is CTOS → PENDING_SSM_REVIEW
        // - PERSONAL: PENDING_APPROVAL → PENDING_AML + onboarding_approved when RegTank APPROVED (webhook); else land on PENDING_APPROVAL
        if (portalType === "investor") {
          const org =
            await this.organizationRepository.findInvestorOrganizationById(organizationId);
          if (org) {
            const previousStatus = org.onboarding_status;

            if (org.type === OrganizationType.COMPANY) {
              const nextOrgStatus = OnboardingStatus.PENDING_SSM_REVIEW;
              await this.organizationRepository.updateInvestorOrganizationOnboarding(
                organizationId,
                nextOrgStatus
              );

              try {
                await this.authRepository.createOnboardingLog({
                  userId: onboarding.user_id,
                  role: UserRole.INVESTOR,
                  eventType: "ONBOARDING_APPROVED",
                  portal: portalType,
                  organizationName: org.name || undefined,
                  investorOrganizationId: organizationId,
                  issuerOrganizationId: undefined,
                  metadata: {
                    organizationId,
                    requestId,
                    previousStatus,
                    newStatus: nextOrgStatus,
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
                { organizationId, portalType, orgType: org.type, nextOrgStatus },
                "Updated investor organization to first admin gate after RegTank onboarding approval"
              );
            } else {
              // Personal investor: decide the safe outcome from current status/flags so
              // duplicate or out-of-order APPROVED webhooks can never regress an org that
              // has already progressed past PENDING_APPROVAL (or is terminal).
              const outcome = decideIndividualApprovedOutcome({
                currentOnboardingStatus: org.onboarding_status,
                onboardingApproved: org.onboarding_approved,
              });

              if (outcome === "heal-to-pending-approval") {
                // APPROVED arrived before WAIT_FOR_APPROVAL/LIVENESS_PASSED was processed
                // (org still PENDING/IN_PROGRESS) — safe to land it on PENDING_APPROVAL.
                const healedOrgStatus = OnboardingStatus.PENDING_APPROVAL;
                await this.organizationRepository.updateInvestorOrganizationOnboarding(
                  organizationId,
                  healedOrgStatus,
                  { resetCompanySsmGateFromRegtankWebhook: true }
                );

                try {
                  await this.authRepository.createOnboardingLog({
                    userId: onboarding.user_id,
                    role: UserRole.INVESTOR,
                    eventType: "ONBOARDING_APPROVED",
                    portal: portalType,
                    organizationName: org.name || undefined,
                    investorOrganizationId: organizationId,
                    issuerOrganizationId: undefined,
                    metadata: {
                      organizationId,
                      requestId,
                      previousStatus,
                      newStatus: healedOrgStatus,
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
                  { organizationId, portalType, orgType: org.type, nextOrgStatus: healedOrgStatus },
                  "Updated investor organization to first admin gate after RegTank onboarding approval"
                );
              } else if (outcome === "set-approved-and-advance") {
                await prisma.investorOrganization.update({
                  where: { id: organizationId },
                  data: {
                    onboarding_approved: true,
                  },
                });
                await advanceOnboardingStatusFromFlags({
                  organizationId,
                  portalType: "investor",
                  reason: "REGTANK_INDIVIDUAL_APPROVED",
                });
                const after = await prisma.investorOrganization.findUnique({
                  where: { id: organizationId },
                  select: { onboarding_status: true },
                });

                try {
                  await this.authRepository.createOnboardingLog({
                    userId: onboarding.user_id,
                    role: UserRole.INVESTOR,
                    eventType: "ONBOARDING_APPROVED",
                    portal: portalType,
                    organizationName: org.name || undefined,
                    investorOrganizationId: organizationId,
                    issuerOrganizationId: undefined,
                    metadata: {
                      organizationId,
                      requestId,
                      previousStatus,
                      newStatus: after?.onboarding_status,
                      trigger: "REGTANK_INDIVIDUAL_APPROVED",
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
                  { organizationId, portalType, newStatus: after?.onboarding_status },
                  "Set onboarding_approved and applied advance after RegTank APPROVED (personal investor)"
                );
              } else {
                // "advance-only": duplicate/late APPROVED. The org is already approved,
                // already progressed past PENDING_APPROVAL, or is terminal — only re-run
                // the shared, idempotent sequencing helper. Never mutate status/flags
                // directly here (prevents regressing PENDING_AML/PENDING_FINAL_APPROVAL/
                // COMPLETED/REJECTED back down to PENDING_APPROVAL).
                await advanceOnboardingStatusFromFlags({
                  organizationId,
                  portalType: "investor",
                  reason: "REGTANK_INDIVIDUAL_APPROVED",
                });
                logger.info(
                  {
                    organizationId,
                    requestId,
                    onboardingStatus: org.onboarding_status,
                    onboardingApproved: org.onboarding_approved,
                  },
                  "[Individual APPROVED] Idempotent no-op — ran shared advance only (org already approved, progressed, or terminal)"
                );
              }
            }
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
              OnboardingStatus.PENDING_SSM_REVIEW
            );

            // Create onboarding status updated log
            try {
              await this.authRepository.createOnboardingLog({
                userId: onboarding.user_id,
                role: UserRole.ISSUER,
                eventType: "ONBOARDING_STATUS_UPDATED",
                portal: portalType,
                organizationName: org.name || undefined,
                investorOrganizationId: undefined,
                issuerOrganizationId: organizationId,
                metadata: {
                  organizationId,
                  requestId,
                  previousStatus,
                  newStatus: OnboardingStatus.PENDING_SSM_REVIEW,
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
              "Updated issuer organization to PENDING_SSM_REVIEW after RegTank onboarding approval"
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

      // Fetch organization details for logging
      const org = organizationId
        ? portalType === "investor"
          ? await this.organizationRepository.findInvestorOrganizationById(organizationId)
          : await this.organizationRepository.findIssuerOrganizationById(organizationId)
        : null;

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
        organizationName: org?.name || undefined,
        investorOrganizationId: (portalType === "investor" && organizationId) ? organizationId : undefined,
        issuerOrganizationId: (portalType === "issuer" && organizationId) ? organizationId : undefined,
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
        status: "",
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

          if (portalType === "investor") {
            const org =
              await this.organizationRepository.findInvestorOrganizationById(organizationId);
            if (org) {
              const nextOrgStatus =
                org.type === OrganizationType.COMPANY
                  ? OnboardingStatus.PENDING_SSM_REVIEW
                  : OnboardingStatus.PENDING_APPROVAL;
              await this.organizationRepository.updateInvestorOrganizationOnboarding(
                organizationId,
                nextOrgStatus
              );
              logger.info(
                { organizationId, portalType, orgType: org.type, nextOrgStatus },
                "Updated investor organization to first admin gate via manual sync after RegTank onboarding approval"
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
                OnboardingStatus.PENDING_SSM_REVIEW
              );
              logger.info(
                { organizationId, portalType },
                "Updated issuer organization to PENDING_SSM_REVIEW via manual sync after RegTank onboarding approval"
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

    if (portalType === "issuer") {
      await assertIssuerOnboardingFeePaid(prisma, organizationId);
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

    const isPersonalRetry = organization.type === OrganizationType.PERSONAL;
    const resolvedRestart = isPersonalRetry
      ? this.resolvePersonalRestartResponse({
        response: regTankResponse as { requestId?: unknown; verifyLink?: unknown; expiredIn?: unknown },
        organizationId,
        previousRequestId: existingOnboarding.request_id,
        source: "retry-personal",
      })
      : null;
    const isCompanyRetry = organization.type === OrganizationType.COMPANY;
    const resolvedCompanyRetry = isCompanyRetry
      ? this.resolveCompanyOnboardingResponse({
        response: regTankResponse as { requestId?: unknown; verifyLink?: unknown; expiredIn?: unknown },
        organizationId,
        previousRequestId: existingOnboarding.request_id,
        portalType,
        source: "retry-company",
      })
      : null;

    // Update onboarding record with new verifyLink
    const expiresIn = resolvedRestart
      ? resolvedRestart.expiredIn
      : resolvedCompanyRetry
        ? resolvedCompanyRetry.expiredIn
        : (regTankResponse.expiredIn || 86400);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    if (isPersonalRetry && resolvedRestart) {
      if (existingOnboarding.status !== "CANCELLED") {
        await this.repository.cancelOnboarding(
          existingOnboarding.id,
          `Retried personal onboarding via restart. New requestId: ${resolvedRestart.requestId}`
        );
      }

      await this.repository.createOnboarding({
        userId,
        organizationId,
        organizationType: organization.type,
        portalType,
        requestId: resolvedRestart.requestId,
        referenceId: `${organizationId}-retry-${Date.now()}`,
        onboardingType: "INDIVIDUAL",
        verifyLink: resolvedRestart.verifyLink,
        verifyLinkExpiresAt: expiresAt,
        status: "IN_PROGRESS",
        regtankResponse: regTankResponse as Prisma.InputJsonValue,
      });
    } else if (isCompanyRetry && resolvedCompanyRetry) {
      if (resolvedCompanyRetry.requestId === existingOnboarding.request_id) {
        await this.repository.updateStatus(existingOnboarding.request_id, {
          status: "PENDING",
          verifyLink: resolvedCompanyRetry.verifyLink,
          verifyLinkExpiresAt: expiresAt,
          regtankResponse: regTankResponse as Prisma.InputJsonValue,
        });
      } else {
        if (existingOnboarding.status !== "CANCELLED") {
          await this.repository.cancelOnboarding(
            existingOnboarding.id,
            `Retried company onboarding via request regeneration. New requestId: ${resolvedCompanyRetry.requestId}`
          );
        }

        await this.repository.createOnboarding({
          userId,
          organizationId,
          organizationType: organization.type,
          portalType,
          requestId: resolvedCompanyRetry.requestId,
          referenceId: `${organizationId}-retry-${Date.now()}`,
          onboardingType: "CORPORATE",
          verifyLink: resolvedCompanyRetry.verifyLink,
          verifyLinkExpiresAt: expiresAt,
          status: "PENDING",
          regtankResponse: regTankResponse as Prisma.InputJsonValue,
        });
      }
    }

    logger.info(
      {
        requestId:
          isPersonalRetry && resolvedRestart
            ? resolvedRestart.requestId
            : isCompanyRetry && resolvedCompanyRetry
              ? resolvedCompanyRetry.requestId
              : existingOnboarding.request_id,
        organizationId,
        newVerifyLink:
          isPersonalRetry && resolvedRestart
            ? resolvedRestart.verifyLink
            : isCompanyRetry && resolvedCompanyRetry
              ? resolvedCompanyRetry.verifyLink
              : regTankResponse.verifyLink,
      },
      "RegTank onboarding restarted"
    );

    return {
      verifyLink:
        isPersonalRetry && resolvedRestart
          ? resolvedRestart.verifyLink
          : isCompanyRetry && resolvedCompanyRetry
            ? resolvedCompanyRetry.verifyLink
            : regTankResponse.verifyLink,
      requestId:
        isPersonalRetry && resolvedRestart
          ? resolvedRestart.requestId
          : isCompanyRetry && resolvedCompanyRetry
            ? resolvedCompanyRetry.requestId
            : existingOnboarding.request_id,
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
