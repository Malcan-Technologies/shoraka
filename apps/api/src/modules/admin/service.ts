import { AdminRepository } from "./repository";
import {
  User,
  AccessLog,
  UserRole,
  Prisma,
  AdminRole,
  OnboardingLog,
  SecurityLog,
  OrganizationType,
  OnboardingStatus,
  ApplicationStatus,
  ReviewSection,
  ReviewStepStatus,
} from "@prisma/client";
import { Request } from "express";
import { extractRequestMetadata } from "../../lib/http/request-utils";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../lib/email/ses-client";
import { adminInvitationTemplate } from "../../lib/email/templates";
import { randomBytes } from "crypto";
import { logger } from "../../lib/logger";
import type {
  GetUsersQuery,
  GetAccessLogsQuery,
  UpdateUserRolesInput,
  UpdateUserOnboardingInput,
  UpdateUserProfileInput,
  GetAdminUsersQuery,
  UpdateAdminRoleInput,
  InviteAdminInput,
  AcceptInvitationInput,
  GetSecurityLogsQuery,
  GetOnboardingLogsQuery,
  ResetOnboardingInput,
  GetOnboardingApplicationsQuery,
  GetAdminApplicationsQuery,
  GetAdminContractsQuery,
} from "./schemas";
import { RegTankRepository, OnboardingApplicationRecord } from "../regtank/repository";
import { RegTankAPIClient } from "../regtank/api-client";
import { NotificationService } from "../notification/service";
import {
  NotificationPayloads,
  NotificationTypeId,
  NotificationTypeIds,
} from "../notification/registry";
import { getIssuerRecipientUserIdsForApplication } from "../notification/application-recipients";
import { getRegTankConfig } from "../../config/regtank";
import type { OnboardingApprovalStatus, OnboardingApplicationResponse } from "@cashsouk/types";
import {
  getSectionForPendingAmendment,
  getSectionForScopeKey,
  parseItemScopeKey,
  REVIEW_SECTION_ORDER,
  getStepKeyFromStepId,
} from "@cashsouk/types";
import { AMLFetcherService } from "../regtank/aml-fetcher";
import type { PortalType } from "../regtank/types";
import { extractCorporateEntities } from "../regtank/helpers/extract-corporate-entities";
import { extractGovernmentIdFromCorporateUserInfo } from "../regtank/helpers/extract-government-id";
import { logApplicationActivity } from "../applications/logs/service";
import { ActivityPortal } from "../applications/logs/types";

export interface AdminLogContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceInfo?: string | null;
}
import { ProductRepository } from "../products/repository";
import {
  computeContractFacilitySnapshot,
  resolveRequestedFacility,
} from "../../lib/contract-facility";
import { getS3ObjectBuffer } from "../../lib/s3/client";
import { computeSupportingDocumentsSectionStatus } from "../applications/supporting-documents-section-status";
import { computeInvoiceDetailsSectionStatus } from "../applications/invoice-details-section-status";
import { assertMaturityForSendInvoiceOffer } from "../products/validate-financial-config";

type ResubmitComparisonAmendmentRemark = {
  scope: string;
  scope_key: string;
  remark: string;
  author_user_id: string;
  submitted_at: string | null;
};

function isPlainObjectRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export class AdminService {
  private repository: AdminRepository;
  private regTankRepository: RegTankRepository;
  private regTankApiClient: RegTankAPIClient;
  private notificationService: NotificationService;
  private productRepository: ProductRepository;

  /** Sections that are workflow-step-driven (financial is always required separately). */
  private static readonly WORKFLOW_REVIEW_SECTION_KEYS: ReadonlySet<string> = new Set(
    REVIEW_SECTION_ORDER.filter((section) => section !== "financial")
  );

  constructor() {
    this.repository = new AdminRepository();
    this.regTankRepository = new RegTankRepository();
    this.regTankApiClient = new RegTankAPIClient();
    this.notificationService = new NotificationService();
    this.productRepository = new ProductRepository();
  }

  private async sendIssuerNotification<T extends NotificationTypeId>(
    applicationId: string,
    typeId: T,
    payload: NotificationPayloads[T],
    idempotencySuffix: string
  ) {
    const recipientUserIds = await getIssuerRecipientUserIdsForApplication(applicationId);
    await Promise.all(
      recipientUserIds.map((userId) =>
        this.notificationService.sendTyped(
          userId,
          typeId,
          payload,
          `app:${applicationId}:notif:${String(typeId)}:user:${userId}:${idempotencySuffix}`
        )
      )
    );
  }

  /**
   * Recompute and update contract facility values (approved_facility, utilized_facility, available_facility).
   * approved_facility is non-zero only when contract is APPROVED and issuer accepted the offer.
   * Otherwise 0 (SUBMITTED, OFFER_SENT, REJECTED, DRAFT).
   */
  private async refreshContractFacilityValues(contractId: string): Promise<void> {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { invoices: true },
    });
    if (!contract) return;
    const cd = contract.contract_details as Record<string, unknown> | null;
    const { approvedFacility, utilizedFacility, availableFacility } = computeContractFacilitySnapshot(
      contract.status,
      cd,
      contract.invoices.map((invoice) => ({
        status: invoice.status,
        details: (invoice.details as Record<string, unknown> | null) ?? null,
        offer_details: (invoice.offer_details as Record<string, unknown> | null) ?? null,
      }))
    );
    const mergedDetails = {
      ...(cd && typeof cd === "object" ? cd : {}),
      approved_facility: approvedFacility,
      utilized_facility: utilizedFacility,
      available_facility: availableFacility,
    };
    await prisma.contract.update({
      where: { id: contractId },
      data: { contract_details: mergedDetails },
    });
  }

  private ensureContractOfferActionAllowed(
    application: { contract_id?: string | null; contract?: { status?: string | null } | null }
  ): void {
    if (!application.contract_id) {
      throw new AppError(400, "INVALID_STATE", "Application has no contract");
    }
    if (application.contract?.status === "APPROVED") {
      throw new AppError(
        400,
        "OFFER_FINALIZED",
        "Contract offer was finalized by issuer and cannot be modified"
      );
    }
  }

  private async ensureInvoiceOfferItemActionAllowed(
    applicationId: string,
    itemScopeKey: string,
    application: { invoices?: { id: string; details?: unknown }[] }
  ): Promise<void> {
    const invoiceId = this.resolveInvoiceIdFromScopeKey(
      application as { invoices?: { id: string; details?: { number?: string | number } }[] },
      itemScopeKey
    );
    if (!invoiceId) {
      throw new AppError(400, "INVALID_INPUT", "Unable to resolve invoice from scope key");
    }
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId, application_id: applicationId },
      select: { status: true },
    });
    if (!invoice) {
      throw new AppError(404, "NOT_FOUND", "Invoice not found");
    }
    if (invoice.status === "APPROVED") {
      throw new AppError(
        400,
        "OFFER_FINALIZED",
        "Invoice offer was finalized by issuer and cannot be modified"
      );
    }
  }

  private async ensureInvoiceSectionActionAllowed(applicationId: string): Promise<void> {
    const approvedCount = await prisma.invoice.count({
      where: { application_id: applicationId, status: "APPROVED" },
    });
    if (approvedCount > 0) {
      throw new AppError(
        400,
        "OFFER_FINALIZED",
        "Invoice offer was finalized by issuer and section-level actions are locked"
      );
    }
  }

  /**
   * Build section policy for review UI and finalization checks.
   * - requiredSections: must be APPROVED before application final approval
   * - visibleSections: sections that should be shown in admin review tabs
   * - prerequisitesBySection: lock dependencies for each section
   */
  private async getReviewSectionPolicy(application: {
    financing_type?: unknown;
    financing_structure?: unknown;
  }): Promise<{
    requiredSections: Set<ReviewSection>;
    visibleSections: Set<ReviewSection>;
    prerequisitesBySection: Partial<Record<ReviewSection, ReviewSection[]>>;
  }> {
    const requiredSections = new Set<ReviewSection>(["financial"]);
    const financingType =
      application.financing_type && typeof application.financing_type === "object"
        ? (application.financing_type as Record<string, unknown>)
        : null;
    const productId = typeof financingType?.product_id === "string" ? financingType.product_id : null;

    const prerequisitesBySection: Partial<Record<ReviewSection, ReviewSection[]>> = {
      financial: [],
      company_details: [],
      business_details: [],
      supporting_documents: [],
      contract_details: ["financial", "company_details", "business_details", "supporting_documents"],
      invoice_details: [
        "financial",
        "company_details",
        "business_details",
        "supporting_documents",
        "contract_details",
      ],
    };

    const applyStructureOverrides = (sections: Set<ReviewSection>) => {
      const structure =
        application.financing_structure && typeof application.financing_structure === "object"
          ? (application.financing_structure as Record<string, unknown>)
          : null;
      if (structure?.structure_type === "invoice_only") {
        prerequisitesBySection.invoice_details = [
          "financial",
          "company_details",
          "business_details",
          "supporting_documents",
          "contract_details",
        ];
      }
      return sections;
    };

    if (!productId) {
      const fallback = applyStructureOverrides(
        new Set(REVIEW_SECTION_ORDER as readonly ReviewSection[])
      );
      return {
        requiredSections: fallback,
        visibleSections: new Set(fallback),
        prerequisitesBySection,
      };
    }

    const product = await this.productRepository.findById(productId);
    if (!product) {
      const fallback = applyStructureOverrides(
        new Set(REVIEW_SECTION_ORDER as readonly ReviewSection[])
      );
      return {
        requiredSections: fallback,
        visibleSections: new Set(fallback),
        prerequisitesBySection,
      };
    }

    const workflow = Array.isArray(product.workflow) ? product.workflow : [];
    for (const rawStep of workflow) {
      const step = rawStep as { id?: unknown };
      const stepId = typeof step.id === "string" ? step.id : "";
      if (!stepId) continue;
      const stepKey = getStepKeyFromStepId(stepId);
      if (!stepKey) continue;
      if (stepKey === "financial_statements") {
        requiredSections.add("financial");
        continue;
      }
      if (!AdminService.WORKFLOW_REVIEW_SECTION_KEYS.has(stepKey)) continue;
      requiredSections.add(stepKey as ReviewSection);
    }

    const normalizedRequiredSections = applyStructureOverrides(requiredSections);
    const visibleSections = new Set(normalizedRequiredSections);
    return {
      requiredSections: normalizedRequiredSections,
      visibleSections,
      prerequisitesBySection,
    };
  }

  /**
   * List users with pagination and filters
   */
  async listUsers(params: GetUsersQuery): Promise<{
    users: User[];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const { users, total } = await this.repository.getUsers(params);
    const totalPages = Math.ceil(total / params.pageSize);

    return {
      users,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount: total,
        totalPages,
      },
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.repository.getUserById(userId);
  }

  /**
   * Update user roles
   */
  async updateUserRoles(
    req: Request,
    userId: string,
    data: UpdateUserRolesInput,
    adminUserId: string
  ): Promise<User> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if ADMIN role is being added or removed
    const hadAdminRole = user.roles.includes(UserRole.ADMIN);
    const hasAdminRole = data.roles.includes(UserRole.ADMIN);
    const adminRoleRemoved = hadAdminRole && !hasAdminRole;
    const adminRoleAdded = !hadAdminRole && hasAdminRole;

    // If ADMIN role is being removed, deactivate the admin record (if it exists)
    if (adminRoleRemoved) {
      const admin = await this.repository.getAdminByUserId(userId);
      if (admin && admin.status === "ACTIVE") {
        logger.info(
          { userId, email: user.email, deactivatedBy: adminUserId },
          "ADMIN role removed - deactivating admin record"
        );
        await this.repository.updateAdminStatus(userId, "INACTIVE");

        // Log security event for admin deactivation via role removal
        const { ipAddress, userAgent, deviceInfo } = extractRequestMetadata(req);
        await this.repository.createSecurityLog({
          userId,
          eventType: "ROLE_SWITCHED",
          ipAddress,
          userAgent,
          deviceInfo,
          metadata: {
            action: "DEACTIVATED_VIA_ROLE_REMOVAL",
            previousStatus: "ACTIVE",
            newStatus: "INACTIVE",
            previousRoles: user.roles,
            newRoles: data.roles,
            deactivatedBy: adminUserId,
          },
        });
      }
    }

    // If ADMIN role is being added, activate the admin record (if it exists) or create a new one
    if (adminRoleAdded) {
      const admin = await this.repository.getAdminByUserId(userId);

      if (admin) {
        // Admin record exists - reactivate it (preserving existing role_description)
        if (admin.status === "INACTIVE") {
          logger.info(
            {
              userId,
              email: user.email,
              roleDescription: admin.role_description,
              activatedBy: adminUserId,
            },
            "ADMIN role added - reactivating existing admin record with previous role description"
          );
          await this.repository.updateAdminStatus(userId, "ACTIVE");

          // Log security event for admin reactivation via role addition
          const { ipAddress, userAgent, deviceInfo } = extractRequestMetadata(req);
          await this.repository.createSecurityLog({
            userId,
            eventType: "ROLE_SWITCHED",
            ipAddress,
            userAgent,
            deviceInfo,
            metadata: {
              action: "ACTIVATED_VIA_ROLE_ADDITION",
              previousStatus: "INACTIVE",
              newStatus: "ACTIVE",
              previousRoles: user.roles,
              newRoles: data.roles,
              roleDescription: admin.role_description,
              activatedBy: adminUserId,
            },
          });
        }
      } else {
        // No admin record exists - create a new one with SUPER_ADMIN role
        logger.info(
          { userId, email: user.email, activatedBy: adminUserId },
          "ADMIN role added - creating new admin record with SUPER_ADMIN role"
        );
        await this.repository.createAdmin(userId, AdminRole.SUPER_ADMIN);
      }
    }

    // Validate that user has required roles for onboarding flags
    const hasInvestorRole = data.roles.includes(UserRole.INVESTOR);
    const hasIssuerRole = data.roles.includes(UserRole.ISSUER);

    // If removing INVESTOR role, reset investor onboarding
    // If removing ISSUER role, reset issuer onboarding
    const updateData: Prisma.UserUpdateInput = { roles: { set: data.roles } };
    if (!hasInvestorRole && user.investor_account.length > 0) {
      updateData.investor_account = { set: [] };
    }
    if (!hasIssuerRole && user.issuer_account.length > 0) {
      updateData.issuer_account = { set: [] };
    }

    const updatedUser = await this.repository.updateUserRoles(userId, data.roles);

    // Create access log for admin action
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);
    await this.repository.createAccessLog({
      userId: adminUserId,
      eventType: adminRoleRemoved ? "ROLE_REMOVED" : "ROLE_ADDED",
      portal: "admin",
      ipAddress,
      userAgent,
      deviceInfo,
      deviceType,
      success: true,
      metadata: {
        targetUserId: userId,
        targetUserEmail: user.email,
        newRoles: data.roles,
        previousRoles: user.roles,
        adminRoleRemoved,
      },
    });

    return updatedUser;
  }

  /**
   * Update user onboarding status
   */
  async updateUserOnboarding(
    req: Request,
    userId: string,
    data: UpdateUserOnboardingInput,
    adminUserId: string
  ): Promise<User> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Manage roles based on onboarding status
    let updatedRoles = [...user.roles];

    // When setting onboarding to true, automatically add the role if not present
    if (data.investorOnboarded === true && !updatedRoles.includes(UserRole.INVESTOR)) {
      updatedRoles.push(UserRole.INVESTOR);
    }

    if (data.issuerOnboarded === true && !updatedRoles.includes(UserRole.ISSUER)) {
      updatedRoles.push(UserRole.ISSUER);
    }

    // When setting onboarding to false, remove the role
    if (data.investorOnboarded === false && updatedRoles.includes(UserRole.INVESTOR)) {
      updatedRoles = updatedRoles.filter((role) => role !== UserRole.INVESTOR);
    }

    if (data.issuerOnboarded === false && updatedRoles.includes(UserRole.ISSUER)) {
      updatedRoles = updatedRoles.filter((role) => role !== UserRole.ISSUER);
    }

    const rolesChanged = JSON.stringify(updatedRoles.sort()) !== JSON.stringify(user.roles.sort());

    const updatedUser = await this.repository.updateUserOnboarding(
      userId,
      data,
      rolesChanged ? updatedRoles : undefined
    );

    // Fetch latest organizations for logging
    const [latestInvestorOrg, latestIssuerOrg] = await Promise.all([
      prisma.investorOrganization.findFirst({
        where: { owner_user_id: userId },
        orderBy: { updated_at: "desc" },
      }),
      prisma.issuerOrganization.findFirst({
        where: { owner_user_id: userId },
        orderBy: { updated_at: "desc" },
      }),
    ]);

    // Create onboarding logs for the target user(s) when their onboarding status is updated
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);

    // Create onboarding log for investor if status changed
    const previousInvestorOnboarded = user.investor_account.length > 0;
    if (
      data.investorOnboarded !== undefined &&
      data.investorOnboarded !== previousInvestorOnboarded
    ) {
      await this.repository.createOnboardingLog({
        userId: userId,
        role: UserRole.INVESTOR,
        eventType: "ONBOARDING_STATUS_UPDATED",
        portal: "investor",
        ipAddress,
        userAgent,
        deviceInfo,
        deviceType,
        organizationName: latestInvestorOrg?.name || undefined,
        investorOrganizationId: latestInvestorOrg?.id || undefined,
        issuerOrganizationId: undefined,
        metadata: {
          updatedBy: adminUserId,
          previousStatus: previousInvestorOnboarded,
          newStatus: data.investorOnboarded,
          adminAction: true,
        },
      });
    }

    // Create onboarding log for issuer if status changed
    const previousIssuerOnboarded = user.issuer_account.length > 0;
    if (data.issuerOnboarded !== undefined && data.issuerOnboarded !== previousIssuerOnboarded) {
      await this.repository.createOnboardingLog({
        userId: userId,
        role: UserRole.ISSUER,
        eventType: "ONBOARDING_STATUS_UPDATED",
        portal: "issuer",
        ipAddress,
        userAgent,
        deviceInfo,
        deviceType,
        organizationName: latestIssuerOrg?.name || undefined,
        investorOrganizationId: undefined,
        issuerOrganizationId: latestIssuerOrg?.id || undefined,
        metadata: {
          updatedBy: adminUserId,
          previousStatus: previousIssuerOnboarded,
          newStatus: data.issuerOnboarded,
          adminAction: true,
        },
      });
    }

    return updatedUser;
  }

  /**
   * Update user profile (name, phone)
   */
  async updateUserProfile(
    req: Request,
    userId: string,
    data: UpdateUserProfileInput,
    adminUserId: string
  ): Promise<User> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Admins can always edit names (no restrictions)
    // Note: This is the admin service, so admins can edit any user's name
    const isChangingName = data.firstName !== undefined || data.lastName !== undefined;
    const hasCompletedOnboarding =
      user.investor_account.length > 0 || user.issuer_account.length > 0;

    const updatedUser = await this.repository.updateUserProfile(userId, data);

    // Create access log for admin action
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);
    await this.repository.createAccessLog({
      userId: adminUserId,
      eventType: "PROFILE_UPDATED",
      portal: "admin",
      ipAddress,
      userAgent,
      deviceInfo,
      deviceType,
      success: true,
      metadata: {
        targetUserId: userId,
        targetUserEmail: user.email,
        updatedFields: Object.keys(data).filter(
          (k) => data[k as keyof UpdateUserProfileInput] !== undefined
        ),
        previousValues: {
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
        },
        nameLockedOverride: hasCompletedOnboarding && isChangingName,
      },
    });

    // Create security log if admin changed name of onboarded user
    if (hasCompletedOnboarding && isChangingName) {
      await this.repository.createSecurityLog({
        userId: userId,
        eventType: "PROFILE_UPDATED",
        ipAddress,
        userAgent,
        deviceInfo,
        metadata: {
          updatedBy: adminUserId,
          updatedFields: Object.keys(data).filter(
            (k) => data[k as keyof UpdateUserProfileInput] !== undefined
          ),
          previousValues: {
            firstName: user.first_name,
            lastName: user.last_name,
          },
          adminOverride: true,
        },
      });
    }

    return updatedUser;
  }

  /**
   * List access logs with pagination and filters
   */
  async listAccessLogs(params: GetAccessLogsQuery): Promise<{
    logs: (AccessLog & {
      user: { first_name: string; last_name: string; email: string; roles: UserRole[] };
    })[];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const { logs, total } = await this.repository.getAccessLogs(params);
    const totalPages = Math.ceil(total / params.pageSize);

    return {
      logs,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount: total,
        totalPages,
      },
    };
  }

  /**
   * Get access log by ID
   */
  async getAccessLogById(logId: string): Promise<(AccessLog & { user: User }) | null> {
    return this.repository.getAccessLogById(logId);
  }

  /**
   * Export access logs (returns all matching logs without pagination)
   */
  async exportAccessLogs(params: Omit<GetAccessLogsQuery, "page" | "pageSize">): Promise<
    (AccessLog & {
      user: { first_name: string; last_name: string; email: string; roles: UserRole[] };
    })[]
  > {
    return this.repository.getAllAccessLogsForExport(params);
  }

  /**
   * Get dashboard statistics including user counts, trends, and percentage changes
   */
  async getDashboardStats(): Promise<{
    users: {
      total: { current: number; previous: number; percentageChange: number };
      investorsOnboarded: { current: number; previous: number; percentageChange: number };
      issuersOnboarded: { current: number; previous: number; percentageChange: number };
    };
    signupTrends: {
      date: string;
      totalSignups: number;
      investorOrgsOnboarded: number;
      issuerOrgsOnboarded: number;
    }[];
    organizations: {
      investor: {
        total: number;
        personal: { total: number; onboarded: number; pending: number };
        company: { total: number; onboarded: number; pending: number };
      };
      issuer: {
        total: number;
        personal: { total: number; onboarded: number; pending: number };
        company: { total: number; onboarded: number; pending: number };
      };
    };
    onboardingOperations: {
      inProgress: number;
      pending: number;
      approved: number;
      rejected: number;
      expired: number;
      avgTimeToApprovalMinutes: number | null;
      avgTimeToApprovalChangePercent: number | null;
      avgTimeToOnboardingMinutes: number | null;
      avgTimeToOnboardingChangePercent: number | null;
    };
  }> {
    const TREND_PERIOD_DAYS = 30;

    // Get all stats in parallel
    const [
      totalStats,
      currentPeriodStats,
      previousPeriodStats,
      signupTrends,
      organizationStats,
      onboardingOperations,
    ] = await Promise.all([
      this.repository.getUserStats(),
      this.repository.getCurrentPeriodStats(TREND_PERIOD_DAYS),
      this.repository.getPreviousPeriodStats(TREND_PERIOD_DAYS),
      this.repository.getSignupTrends(TREND_PERIOD_DAYS),
      this.repository.getOrganizationStats(),
      this.repository.getOnboardingOperationsMetrics(),
    ]);

    // Calculate percentage changes
    const calculatePercentageChange = (current: number, previous: number): number => {
      if (previous === 0) {
        return current > 0 ? 100 : 0;
      }
      return Math.round(((current - previous) / previous) * 100);
    };

    return {
      users: {
        total: {
          current: totalStats.totalUsers,
          previous:
            totalStats.totalUsers - currentPeriodStats.totalUsers + previousPeriodStats.totalUsers,
          percentageChange: calculatePercentageChange(
            currentPeriodStats.totalUsers,
            previousPeriodStats.totalUsers
          ),
        },
        investorsOnboarded: {
          current: totalStats.investorsOnboarded,
          previous:
            totalStats.investorsOnboarded -
            currentPeriodStats.investorsOnboarded +
            previousPeriodStats.investorsOnboarded,
          percentageChange: calculatePercentageChange(
            currentPeriodStats.investorsOnboarded,
            previousPeriodStats.investorsOnboarded
          ),
        },
        issuersOnboarded: {
          current: totalStats.issuersOnboarded,
          previous:
            totalStats.issuersOnboarded -
            currentPeriodStats.issuersOnboarded +
            previousPeriodStats.issuersOnboarded,
          percentageChange: calculatePercentageChange(
            currentPeriodStats.issuersOnboarded,
            previousPeriodStats.issuersOnboarded
          ),
        },
      },
      signupTrends,
      organizations: organizationStats,
      onboardingOperations,
    };
  }

  /**
   * Update user's 5-letter ID (admin only)
   */
  async updateUserId(userId: string, newUserId: string): Promise<{ user_id: string }> {
    // Check if user exists
    const user = await prisma.user.findUnique({ where: { user_id: userId } });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    // Update user_id and let database unique constraint handle conflicts
    try {
      const updatedUser = await prisma.user.update({
        where: { user_id: userId },
        data: { user_id: newUserId },
      });

      return { user_id: updatedUser.user_id! };
    } catch (error) {
      // Handle unique constraint violation (P2002 is Prisma's code for unique constraint errors)
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        throw new AppError(409, "CONFLICT", "This User ID is already assigned to another user");
      }
      throw error;
    }
  }

  /**
   * Get admin users list
   */
  async getAdminUsers(params: GetAdminUsersQuery): Promise<{
    users: (User & {
      admin: { role_description: AdminRole; status: string; last_login: Date | null } | null;
    })[];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const { users, total } = await this.repository.getAdminUsers(params);
    const totalPages = Math.ceil(total / params.pageSize);

    return {
      users,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount: total,
        totalPages,
      },
    };
  }

  /**
   * Update admin role description
   */
  async updateAdminRole(
    req: Request,
    userId: string,
    data: UpdateAdminRoleInput,
    updatedBy: string
  ): Promise<User & { admin: { role_description: AdminRole } | null }> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    if (!user.roles.includes(UserRole.ADMIN)) {
      throw new AppError(400, "VALIDATION_ERROR", "User is not an admin");
    }

    const admin = await this.repository.getAdminByUserId(userId);
    if (!admin) {
      throw new AppError(404, "NOT_FOUND", "Admin record not found");
    }

    const previousRole = admin.role_description;
    await this.repository.updateAdminRole(userId, data.roleDescription);

    // Log ROLE_SWITCHED event in SecurityLog
    const { ipAddress, userAgent, deviceInfo } = extractRequestMetadata(req);
    await this.repository.createSecurityLog({
      userId,
      eventType: "ROLE_SWITCHED",
      ipAddress,
      userAgent,
      deviceInfo,
      metadata: {
        previousRole,
        newRole: data.roleDescription,
        updatedBy,
      },
    });

    const updatedUser = await this.repository.getUserById(userId);
    const updatedAdmin = await this.repository.getAdminByUserId(userId);

    return {
      ...updatedUser!,
      admin: updatedAdmin,
    } as User & { admin: { role_description: AdminRole } | null };
  }

  /**
   * Deactivate admin - removes ADMIN role and sets status to INACTIVE
   * Creates admin record if it doesn't exist (for users with ADMIN role but no admin record)
   * Removes ADMIN role from user.roles to sync with /users page
   * User will not be able to access admin portal until reactivated
   */
  async deactivateAdmin(req: Request, userId: string, deactivatedBy: string): Promise<User> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    // Check if admin record exists
    let admin = await this.repository.getAdminByUserId(userId);

    // If no admin record exists, create one with SUPER_ADMIN as default role
    // This handles cases where users have ADMIN role but no admin record
    if (!admin) {
      logger.info(
        { userId, email: user.email, deactivatedBy },
        "Admin record not found - creating new admin record with SUPER_ADMIN role before deactivation"
      );
      admin = await this.repository.createAdmin(userId, AdminRole.SUPER_ADMIN);
      // Admin record is created with ACTIVE status by default, so we'll deactivate it below
    } else if (admin.status === "INACTIVE") {
      throw new AppError(400, "VALIDATION_ERROR", "Admin is already deactivated");
    }

    // Update admin status to INACTIVE
    await this.repository.updateAdminStatus(userId, "INACTIVE");

    // Remove ADMIN role from user.roles to sync with /users page
    if (user.roles.includes(UserRole.ADMIN)) {
      logger.info(
        { userId, email: user.email, deactivatedBy },
        "Removing ADMIN role from user.roles to sync with /users page"
      );
      const updatedRoles = user.roles.filter((role) => role !== UserRole.ADMIN);
      await this.repository.updateUserRoles(userId, updatedRoles);
    }

    // Log ROLE_SWITCHED event (deactivating admin access)
    const { ipAddress, userAgent, deviceInfo } = extractRequestMetadata(req);
    await this.repository.createSecurityLog({
      userId,
      eventType: "ROLE_SWITCHED",
      ipAddress,
      userAgent,
      deviceInfo,
      metadata: {
        action: "DEACTIVATED",
        previousStatus: "ACTIVE",
        newStatus: "INACTIVE",
        deactivatedBy,
      },
    });

    return this.repository.getUserById(userId) as Promise<User>;
  }

  /**
   * Reactivate admin - sets status back to ACTIVE and adds ADMIN role
   * Creates admin record if it doesn't exist (for users with ADMIN role but no admin record)
   * Adds ADMIN role to user.roles to sync with /users page
   */
  async reactivateAdmin(req: Request, userId: string, reactivatedBy: string): Promise<User> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    // Add ADMIN role to user.roles if missing (to sync with /users page)
    if (!user.roles.includes(UserRole.ADMIN)) {
      logger.info(
        { userId, email: user.email, reactivatedBy },
        "Adding ADMIN role to user.roles to sync with /users page"
      );
      const updatedRoles = [...user.roles, UserRole.ADMIN];
      await this.repository.updateUserRoles(userId, updatedRoles);
    }

    // Check if admin record exists
    let admin = await this.repository.getAdminByUserId(userId);

    // If no admin record exists, create one with SUPER_ADMIN as default role
    // This handles cases where users have ADMIN role but no admin record
    if (!admin) {
      logger.info(
        { userId, email: user.email, reactivatedBy },
        "Admin record not found - creating new admin record with SUPER_ADMIN role"
      );
      admin = await this.repository.createAdmin(userId, AdminRole.SUPER_ADMIN);
      // Admin record is created with ACTIVE status by default, so we're done
    } else {
      // Admin record exists - check status
      if (admin.status === "ACTIVE") {
        throw new AppError(400, "VALIDATION_ERROR", "Admin is already active");
      }

      // Update admin status to ACTIVE
      await this.repository.updateAdminStatus(userId, "ACTIVE");
    }

    // Log ROLE_SWITCHED event (reactivating admin access)
    const { ipAddress, userAgent, deviceInfo } = extractRequestMetadata(req);
    await this.repository.createSecurityLog({
      userId,
      eventType: "ROLE_SWITCHED",
      ipAddress,
      userAgent,
      deviceInfo,
      metadata: {
        action: "REACTIVATED",
        previousStatus: "INACTIVE",
        newStatus: "ACTIVE",
        reactivatedBy,
      },
    });

    return this.repository.getUserById(userId) as Promise<User>;
  }

  /**
   * Generate invitation URL without sending email
   */
  async generateInvitationUrl(
    data: InviteAdminInput,
    invitedBy: string
  ): Promise<{ inviteUrl: string; token: string }> {
    const inviter = await this.repository.getUserById(invitedBy);
    if (!inviter) {
      throw new AppError(404, "NOT_FOUND", "Inviter not found");
    }

    // Use placeholder email if not provided (for link-based invitations)
    const email = data.email?.toLowerCase() || `invitation-${Date.now()}@cashsouk.com`;

    // Check if invitation already exists for this email and role
    const existingInvitation = await prisma.adminInvitation.findFirst({
      where: {
        email,
        role_description: data.roleDescription,
        accepted: false,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: "desc" },
    });

    let token: string;
    if (existingInvitation) {
      // Reuse existing invitation token
      token = existingInvitation.token;
    } else {
      // Generate secure token
      token = randomBytes(32).toString("hex");
      const expiryHours = parseInt(process.env.INVITATION_TOKEN_EXPIRY_HOURS || "24", 10);
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

      // Create invitation record
      await this.repository.createAdminInvitation({
        email,
        roleDescription: data.roleDescription,
        token,
        expiresAt,
        invitedByUserId: invitedBy,
      });
    }

    // Generate invitation URL
    // Use ADMIN_PORTAL_URL if set, otherwise fall back to ADMIN_URL, then default
    const adminPortalUrl = process.env.ADMIN_URL || "http://localhost:3003";
    const inviteUrl = `${adminPortalUrl}/callback?invitation=${token}&role=${data.roleDescription}`;

    return { inviteUrl, token };
  }

  /**
   * Invite admin user (sends email if email provided)
   */
  async inviteAdmin(
    _req: Request,
    data: InviteAdminInput,
    invitedBy: string
  ): Promise<{ inviteUrl: string; messageId?: string; emailSent: boolean; emailError?: string }> {
    const inviter = await this.repository.getUserById(invitedBy);
    if (!inviter) {
      throw new AppError(404, "NOT_FOUND", "Inviter not found");
    }

    // Generate invitation URL (creates invitation record if needed)
    const { inviteUrl } = await this.generateInvitationUrl(data, invitedBy);

    // Send email via SES only if email is provided
    let messageId: string | undefined;
    let emailSent = false;
    let emailError: string | undefined;

    if (data.email) {
      try {
        const inviterName = `${inviter.first_name} ${inviter.last_name}`;
        const template = adminInvitationTemplate(inviteUrl, data.roleDescription, inviterName);

        const result = await sendEmail({
          to: data.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });

        messageId = result.messageId;
        emailSent = true;

        logger.info(
          {
            email: data.email,
            roleDescription: data.roleDescription,
            invitedBy,
            messageId,
          },
          "Admin invitation sent via email"
        );
      } catch (error) {
        // Log error but don't fail the request - invitation link is still valid
        emailSent = false;
        emailError = error instanceof Error ? error.message : String(error);

        logger.warn(
          {
            email: data.email,
            roleDescription: data.roleDescription,
            invitedBy,
            error: emailError,
          },
          "Failed to send admin invitation email, but invitation link is still valid"
        );
        // Continue without messageId - the invitation URL is still returned
      }
    } else {
      logger.info(
        {
          roleDescription: data.roleDescription,
          invitedBy,
        },
        "Admin invitation link generated (no email sent)"
      );
    }

    return { inviteUrl, messageId, emailSent, ...(emailError && { emailError }) };
  }

  /**
   * Accept admin invitation
   * For link-based invitations (no email), user must be provided (from authenticated session)
   * For email-based invitations, user is found by email
   */
  async acceptInvitation(
    req: Request,
    data: AcceptInvitationInput,
    authenticatedUser?: User
  ): Promise<{
    user: User;
    admin: { role_description: AdminRole; status: "ACTIVE" | "INACTIVE" };
  }> {
    const invitation = await this.repository.getAdminInvitationByToken(data.token);

    if (!invitation) {
      throw new AppError(404, "NOT_FOUND", "Invitation not found");
    }

    if (invitation.accepted) {
      throw new AppError(400, "VALIDATION_ERROR", "Invitation has already been accepted");
    }

    if (new Date() > invitation.expires_at) {
      throw new AppError(400, "VALIDATION_ERROR", "Invitation has expired");
    }

    // Find user - if invitation has a placeholder email, use authenticated user
    // Otherwise, find by invitation email
    let user: User | null = null;

    if (invitation.email.startsWith("invitation-") && invitation.email.includes("@cashsouk.com")) {
      // This is a link-based invitation - use authenticated user from OAuth callback
      if (!authenticatedUser) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Link-based invitations require authentication"
        );
      }
      user = authenticatedUser;
    } else {
      // Email-based invitation - find user by email
      user = await prisma.user.findUnique({
        where: { email: invitation.email },
      });

      if (!user) {
        throw new AppError(404, "NOT_FOUND", "User not found. Please sign up first.");
      }
    }

    // Add ADMIN role if not present
    const updatedRoles = [...user.roles];
    if (!updatedRoles.includes(UserRole.ADMIN)) {
      updatedRoles.push(UserRole.ADMIN);
      await this.repository.updateUserRoles(user.user_id, updatedRoles);
    }

    // Create or update Admin record
    let admin = await this.repository.getAdminByUserId(user.user_id);
    if (!admin) {
      admin = await this.repository.createAdmin(user.user_id, invitation.role_description);
    } else {
      // Update role description if different
      if (admin.role_description !== invitation.role_description) {
        admin = await this.repository.updateAdminRole(user.user_id, invitation.role_description);
      }
      // Ensure status is ACTIVE - CRITICAL: This reactivates deactivated admins
      if (admin.status !== "ACTIVE") {
        // Update status and use the returned updated admin object
        admin = await this.repository.updateAdminStatus(user.user_id, "ACTIVE");
      }
    }

    // Mark invitation as accepted
    await this.repository.acceptAdminInvitation(data.token);

    // Log ROLE_ADDED event
    const { ipAddress, userAgent, deviceInfo } = extractRequestMetadata(req);
    await this.repository.createSecurityLog({
      userId: user.user_id,
      eventType: "ROLE_ADDED",
      ipAddress,
      userAgent,
      deviceInfo,
      metadata: {
        addedRole: "ADMIN",
        roleDescription: invitation.role_description,
        invitationToken: data.token,
        invitationType: invitation.email.startsWith("invitation-") ? "link" : "email",
      },
    });

    // Refresh user to get updated roles
    const updatedUser = await this.repository.getUserById(user.user_id);
    // Refresh admin to ensure we have the latest status (especially after status update)
    const refreshedAdmin = await this.repository.getAdminByUserId(user.user_id);
    return {
      user: updatedUser!,
      admin: {
        role_description: refreshedAdmin?.role_description || admin.role_description,
        status: (refreshedAdmin?.status || admin.status) as "ACTIVE" | "INACTIVE",
      },
    };
  }

  /**
   * Get security logs
   */
  async getSecurityLogs(params: GetSecurityLogsQuery): Promise<{
    logs: Array<{
      id: string;
      user_id: string;
      event_type: string;
      ip_address: string | null;
      user_agent: string | null;
      device_info: string | null;
      metadata: unknown;
      created_at: Date;
      user: { first_name: string; last_name: string; email: string; roles: UserRole[] };
    }>;
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const { logs, total } = await this.repository.getSecurityLogs(params);
    const totalPages = Math.ceil(total / params.pageSize);

    return {
      logs,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount: total,
        totalPages,
      },
    };
  }

  /**
   * Export security logs
   */
  async exportSecurityLogs(params: Omit<GetSecurityLogsQuery, "page" | "pageSize">): Promise<
    (SecurityLog & {
      user: { first_name: string; last_name: string; email: string; roles: UserRole[] };
    })[]
  > {
    return this.repository.getAllSecurityLogsForExport(params);
  }

  /**
   * Get pending admin invitations
   */
  async getPendingInvitations(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    roleDescription?: AdminRole;
  }): Promise<{
    invitations: Array<{
      id: string;
      email: string;
      role_description: AdminRole;
      token: string;
      expires_at: Date;
      created_at: Date;
      invited_by: { first_name: string; last_name: string; email: string };
    }>;
    pagination: {
      currentPage: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    return this.repository.getPendingInvitations(params);
  }

  /**
   * Resend admin invitation email (by invitation ID)
   */
  async resendInvitation(
    _req: Request,
    invitationId: string,
    invitedBy: string
  ): Promise<{ messageId?: string; emailSent: boolean; emailError?: string }> {
    const invitation = await this.repository.getAdminInvitationById(invitationId);

    if (!invitation) {
      throw new AppError(404, "NOT_FOUND", "Invitation not found");
    }

    if (invitation.accepted) {
      throw new AppError(400, "VALIDATION_ERROR", "Invitation has already been accepted");
    }

    if (new Date() > invitation.expires_at) {
      throw new AppError(400, "VALIDATION_ERROR", "Invitation has expired");
    }

    // Only send email if invitation has a real email (not placeholder)
    if (!invitation.email || invitation.email.startsWith("invitation-")) {
      throw new AppError(400, "VALIDATION_ERROR", "Cannot resend link-based invitation via email");
    }

    const inviter = await this.repository.getUserById(invitedBy);
    if (!inviter) {
      throw new AppError(404, "NOT_FOUND", "Inviter not found");
    }

    // Generate invitation URL
    const adminPortalUrl = process.env.ADMIN_URL || "http://localhost:3003";
    const inviteUrl = `${adminPortalUrl}/callback?invitation=${invitation.token}&role=${invitation.role_description}`;

    let messageId: string | undefined;
    let emailSent = false;
    let emailError: string | undefined;

    try {
      const inviterName = `${inviter.first_name} ${inviter.last_name}`;
      const template = adminInvitationTemplate(inviteUrl, invitation.role_description, inviterName);

      const result = await sendEmail({
        to: invitation.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      messageId = result.messageId;
      emailSent = true;

      logger.info(
        {
          email: invitation.email,
          roleDescription: invitation.role_description,
          invitedBy,
          messageId,
        },
        "Admin invitation resent via email"
      );
    } catch (error) {
      emailSent = false;
      emailError = error instanceof Error ? error.message : String(error);

      logger.warn(
        {
          email: invitation.email,
          roleDescription: invitation.role_description,
          invitedBy,
          error: emailError,
        },
        "Failed to resend admin invitation email"
      );
    }

    return { messageId, emailSent, ...(emailError && { emailError }) };
  }

  /**
   * Revoke/delete a pending admin invitation
   */
  async revokeInvitation(req: Request, invitationId: string, revokedBy: string): Promise<void> {
    const invitation = await this.repository.getAdminInvitationById(invitationId);

    if (!invitation) {
      throw new AppError(404, "NOT_FOUND", "Invitation not found");
    }

    if (invitation.accepted) {
      throw new AppError(400, "VALIDATION_ERROR", "Cannot revoke an accepted invitation");
    }

    // Delete the invitation
    await this.repository.deleteAdminInvitation(invitationId);

    // Log the action
    await this.repository.createSecurityLog({
      userId: revokedBy,
      eventType: "INVITATION_REVOKED",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        invitationId,
        email: invitation.email,
        roleDescription: invitation.role_description,
      },
    });

    logger.info(
      {
        invitationId,
        email: invitation.email,
        roleDescription: invitation.role_description,
        revokedBy,
      },
      "Admin invitation revoked"
    );
  }

  /**
   * List onboarding logs with pagination and filters
   */
  async listOnboardingLogs(params: GetOnboardingLogsQuery): Promise<{
    logs: (OnboardingLog & {
      user: { first_name: string; last_name: string; email: string; roles: UserRole[] };
      organizationName?: string | null;
      organizationType?: OrganizationType | null;
    })[];
    total: number;
  }> {
    const { logs, total } = await this.repository.getOnboardingLogs(params);
    return { logs, total };
  }

  /**
   * Get onboarding log by ID
   */
  async getOnboardingLogById(logId: string): Promise<(OnboardingLog & { user: User }) | null> {
    return this.repository.getOnboardingLogById(logId);
  }

  /**
   * Export onboarding logs
   */
  async exportOnboardingLogs(params: Omit<GetOnboardingLogsQuery, "page" | "pageSize">): Promise<
    (OnboardingLog & {
      user: { first_name: string; last_name: string; email: string; roles: UserRole[] };
      organizationName?: string | null;
      organizationType?: OrganizationType | null;
    })[]
  > {
    return this.repository.getAllOnboardingLogsForExport(params);
  }

  /**
   * Reset onboarding for a user (admin only - temporary feature for testing)
   */
  async resetOnboarding(
    req: Request,
    userId: string,
    data: ResetOnboardingInput,
    adminUserId: string
  ): Promise<User> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const updateData: { investorOnboarded?: boolean; issuerOnboarded?: boolean } = {};

    if (data.portal === "investor") {
      if (user.investor_account.length === 0) {
        throw new AppError(400, "BAD_REQUEST", "User has not completed investor onboarding");
      }
      updateData.investorOnboarded = false;
    } else if (data.portal === "issuer") {
      if (user.issuer_account.length === 0) {
        throw new AppError(400, "BAD_REQUEST", "User has not completed issuer onboarding");
      }
      updateData.issuerOnboarded = false;
    }

    const updatedUser = await this.repository.updateUserOnboarding(userId, updateData);

    // Fetch the latest organization for logging
    const latestOrg =
      data.portal === "investor"
        ? (
          await prisma.investorOrganization.findMany({
            where: { owner_user_id: userId },
            orderBy: { updated_at: "desc" },
            take: 1,
          })
        )[0]
        : (
          await prisma.issuerOrganization.findMany({
            where: { owner_user_id: userId },
            orderBy: { updated_at: "desc" },
            take: 1,
          })
        )[0];

    // Create onboarding log
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);
    await this.repository.createOnboardingLog({
      userId: userId,
      role: data.portal === "investor" ? UserRole.INVESTOR : UserRole.ISSUER,
      eventType: "ONBOARDING_RESET",
      portal: data.portal,
      ipAddress,
      userAgent,
      deviceInfo,
      deviceType,
      organizationName: latestOrg?.name || undefined,
      investorOrganizationId: data.portal === "investor" ? latestOrg?.id : undefined,
      issuerOrganizationId: data.portal === "issuer" ? latestOrg?.id : undefined,
      metadata: {
        resetBy: adminUserId,
        previousStatus: true,
        newStatus: false,
        adminAction: true,
      },
    });

    // Create access log for admin action
    await this.repository.createAccessLog({
      userId: adminUserId,
      eventType: "ONBOARDING_RESET",
      portal: "admin",
      ipAddress,
      userAgent,
      deviceInfo,
      deviceType,
      success: true,
      metadata: {
        targetUserId: userId,
        targetUserEmail: user.email,
        portal: data.portal,
      },
    });

    logger.info(
      {
        userId,
        portal: data.portal,
        resetBy: adminUserId,
      },
      "Onboarding reset by admin"
    );

    return updatedUser;
  }

  /**
   * Get all organizations (investor + issuer) with pagination and filters
   */
  async getOrganizations(params: {
    page: number;
    pageSize: number;
    search?: string;
    portal?: "investor" | "issuer";
    type?: "PERSONAL" | "COMPANY";
    onboardingStatus?:
    | "PENDING"
    | "IN_PROGRESS"
    | "PENDING_APPROVAL"
    | "PENDING_AML"
    | "PENDING_SSM_REVIEW"
    | "PENDING_FINAL_APPROVAL"
    | "COMPLETED"
    | "REJECTED";
  }): Promise<{
    organizations: {
      id: string;
      portal: "investor" | "issuer";
      type: "PERSONAL" | "COMPANY";
      name: string | null;
      registrationNumber: string | null;
      onboardingStatus:
      | "PENDING"
      | "IN_PROGRESS"
      | "PENDING_APPROVAL"
      | "PENDING_AML"
      | "PENDING_SSM_REVIEW"
      | "PENDING_FINAL_APPROVAL"
      | "COMPLETED"
      | "REJECTED";
      onboardedAt: string | null;
      owner: {
        userId: string;
        email: string;
        firstName: string;
        lastName: string;
      };
      memberCount: number;
      isSophisticatedInvestor: boolean;
      depositReceived: boolean;
      createdAt: string;
      updatedAt: string;
    }[];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const result = await this.repository.getOrganizations(params);

    return {
      organizations: result.organizations.map((org) => ({
        ...org,
        onboardedAt: org.onboardedAt?.toISOString() ?? null,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
      })),
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount: result.total,
        totalPages: Math.ceil(result.total / params.pageSize),
      },
    };
  }

  /**
   * Get organization detail by portal and ID
   */
  async getOrganizationDetail(
    portal: "investor" | "issuer",
    id: string
  ): Promise<{
    id: string;
    portal: "investor" | "issuer";
    type: "PERSONAL" | "COMPANY";
    name: string | null;
    registrationNumber: string | null;
    onboardingStatus: string;
    onboardedAt: string | null;
    createdAt: string;
    updatedAt: string;
    owner: {
      userId: string;
      email: string;
      firstName: string;
      lastName: string;
    };
    firstName: string | null;
    lastName: string | null;
    middleName: string | null;
    nationality: string | null;
    country: string | null;
    idIssuingCountry: string | null;
    gender: string | null;
    address: string | null;
    dateOfBirth: string | null;
    phoneNumber: string | null;
    documentType: string | null;
    documentNumber: string | null;
    kycId: string | null;
    bankAccountDetails: Record<string, unknown> | null;
    wealthDeclaration: Record<string, unknown> | null;
    complianceDeclaration: Record<string, unknown> | null;
    documentInfo: Record<string, unknown> | null;
    livenessCheckInfo: Record<string, unknown> | null;
    kycResponse: Record<string, unknown> | null;
    members: {
      id: string;
      userId: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      createdAt: string;
    }[];
    isSophisticatedInvestor: boolean;
    sophisticatedInvestorReason: string | null;
    regtankPortalUrl: string | null;
    regtankRequestId: string | null;
    codRequestId: string | null;
    applications?: {
      id: string;
      status: string;
      productVersion: number;
      lastCompletedStep: number;
      submittedAt: string | null;
      createdAt: string;
      updatedAt: string;
      contractId: string | null;
    }[];
    corporateOnboardingData?: {
      basicInfo?: {
        tinNumber?: string;
        industry?: string;
        entityType?: string;
        businessName?: string;
        numberOfEmployees?: number;
        ssmRegisterNumber?: string;
        annualRevenue?: string;
        website?: string;
        phoneNumber?: string;
      };
      addresses?: {
        business?: {
          line1?: string | null;
          line2?: string | null;
          city?: string | null;
          postalCode?: string | null;
          state?: string | null;
          country?: string | null;
        };
        registered?: {
          line1?: string | null;
          line2?: string | null;
          city?: string | null;
          postalCode?: string | null;
          state?: string | null;
          country?: string | null;
        };
      };
      personInCharge?: {
        name?: string | null;
        position?: string | null;
        email?: string | null;
        contactNumber?: string | null;
      };
    };
    corporateEntities?: Record<string, unknown> | null;
    corporateRequiredDocuments?: Record<string, unknown>[] | null;
    directorAmlStatus?: Record<string, unknown> | null;
    directorKycStatus?: Record<string, unknown> | null;
    businessAmlStatus?: Record<string, unknown> | null;
  } | null> {
    const org = await this.repository.getOrganizationById(portal, id);

    if (!org) {
      return null;
    }

    let codRequestId: string | null = null;
    if (org.type === "COMPANY") {
      const onboarding = await this.regTankRepository.findByOrganizationId(org.id, portal);
      codRequestId = onboarding?.request_id ?? null;
    }

    return {
      id: org.id,
      portal,
      type: org.type as "PERSONAL" | "COMPANY",
      name: org.name,
      registrationNumber: org.registration_number,
      onboardingStatus: org.onboarding_status,
      onboardedAt: org.onboarded_at?.toISOString() ?? null,
      createdAt: org.created_at.toISOString(),
      updatedAt: org.updated_at.toISOString(),
      owner: {
        userId: org.owner.user_id,
        email: org.owner.email,
        firstName: org.owner.first_name,
        lastName: org.owner.last_name,
      },
      firstName: org.first_name,
      lastName: org.last_name,
      middleName: org.middle_name,
      nationality: org.nationality,
      country: org.country,
      idIssuingCountry: org.id_issuing_country,
      gender: org.gender,
      address: org.address,
      dateOfBirth: org.date_of_birth?.toISOString() ?? null,
      phoneNumber: org.phone_number,
      documentType: org.document_type,
      documentNumber: org.document_number,
      kycId: org.kyc_id,
      bankAccountDetails: org.bank_account_details as Record<string, unknown> | null,
      wealthDeclaration: org.wealth_declaration as Record<string, unknown> | null,
      complianceDeclaration: org.compliance_declaration as Record<string, unknown> | null,
      documentInfo: org.document_info as Record<string, unknown> | null,
      livenessCheckInfo: org.liveness_check_info as Record<string, unknown> | null,
      kycResponse: org.kyc_response as Record<string, unknown> | null,
      corporateOnboardingData: (() => {
        if (!org.corporate_onboarding_data || org.type !== "COMPANY") return undefined;
        const data = org.corporate_onboarding_data as {
          basicInfo?: {
            tin?: string;
            tinNumber?: string;
            industry?: string;
            entityType?: string;
            businessName?: string;
            numberOfEmployees?: number | string;
            ssmRegistrationNumber?: string;
            ssmRegisterNumber?: string;
            annualRevenue?: string;
            website?: string;
            phoneNumber?: string;
          };
          addresses?: {
            business?: {
              line1?: string | null;
              line2?: string | null;
              city?: string | null;
              postalCode?: string | null;
              state?: string | null;
              country?: string | null;
            };
            registered?: {
              line1?: string | null;
              line2?: string | null;
              city?: string | null;
              postalCode?: string | null;
              state?: string | null;
              country?: string | null;
            };
            businessAddress?: string;
            registeredAddress?: string;
          };
          personInCharge?: {
            name?: string | null;
            position?: string | null;
            email?: string | null;
            contactNumber?: string | null;
          };
        };

        return {
          basicInfo: data.basicInfo
            ? {
              tinNumber: data.basicInfo.tinNumber || data.basicInfo.tin || undefined,
              industry: data.basicInfo.industry,
              entityType: data.basicInfo.entityType,
              businessName: data.basicInfo.businessName,
              numberOfEmployees:
                typeof data.basicInfo.numberOfEmployees === "string"
                  ? parseInt(data.basicInfo.numberOfEmployees, 10) || undefined
                  : data.basicInfo.numberOfEmployees,
              ssmRegisterNumber:
                data.basicInfo.ssmRegisterNumber ||
                data.basicInfo.ssmRegistrationNumber ||
                undefined,
              annualRevenue: data.basicInfo.annualRevenue || undefined,
              website: data.basicInfo.website || undefined,
              phoneNumber: data.basicInfo.phoneNumber || undefined,
            }
            : undefined,
          addresses: data.addresses
            ? {
              business: data.addresses.business || undefined,
              registered: data.addresses.registered || undefined,
            }
            : undefined,
          personInCharge: data.personInCharge
            ? {
              name: data.personInCharge.name || undefined,
              position: data.personInCharge.position || undefined,
              email: data.personInCharge.email || undefined,
              contactNumber: data.personInCharge.contactNumber || undefined,
            }
            : undefined,
        };
      })(),
      corporateEntities: org.type === "COMPANY" ? (org.corporate_entities as Record<string, unknown> | null) : undefined,
      corporateRequiredDocuments: org.type === "COMPANY" ? (org.corporate_required_documents as Record<string, unknown>[] | null) : undefined,
      directorAmlStatus: org.type === "COMPANY" ? (org.director_aml_status as Record<string, unknown> | null) : undefined,
      directorKycStatus: org.type === "COMPANY" ? (org.director_kyc_status as Record<string, unknown> | null) : undefined,
      businessAmlStatus: org.type === "COMPANY" ? (org.business_aml_status as Record<string, unknown> | null) : undefined,
      members: org.members.map((m) => ({
        id: m.id,
        userId: m.user_id,
        firstName: m.user.first_name,
        lastName: m.user.last_name,
        email: m.user.email,
        role: m.role,
        createdAt: m.created_at.toISOString(),
      })),
      // Sophisticated investor status (only for investor portal, false for issuer)
      isSophisticatedInvestor:
        portal === "investor" ? (org.is_sophisticated_investor ?? false) : false,
      sophisticatedInvestorReason:
        portal === "investor" ? (org.sophisticated_investor_reason ?? null) : null,
      // Build RegTank portal URL from latest onboarding record
      regtankRequestId: org.regtank_onboarding?.[0]?.request_id ?? null,
      codRequestId,
      regtankPortalUrl: (() => {
        const requestId = org.regtank_onboarding?.[0]?.request_id;
        if (!requestId) return null;
        const baseUrl = getRegTankConfig().adminPortalUrl;
        if (org.type === "COMPANY" && requestId.startsWith("COD")) {
          return `${baseUrl}/app/onboardingCorporate/${requestId}?archived=false`;
        }
        return `${baseUrl}/app/liveness/${requestId}?archived=false`;
      })(),
      // Applications (issuer only)
      applications: (portal === "issuer" && org.applications)
        ? org.applications.map((app: { id: string; status: string; product_version: number; last_completed_step: number; submitted_at: Date | null; created_at: Date; updated_at: Date; contract_id: string | null }) => ({
          id: app.id,
          status: app.status,
          productVersion: app.product_version,
          lastCompletedStep: app.last_completed_step,
          submittedAt: app.submitted_at?.toISOString() ?? null,
          createdAt: app.created_at.toISOString(),
          updatedAt: app.updated_at.toISOString(),
          contractId: app.contract_id,
        }))
        : undefined,
    };
  }

  /**
   * Refresh corporate entities from RegTank for a company organization.
   * Fetches latest COD details and updates corporate_entities in the database.
   */
  async refreshOrganizationCorporateEntities(
    organizationId: string,
    portal: PortalType
  ): Promise<{ success: boolean; message: string }> {
    const org = await this.repository.getOrganizationById(portal, organizationId);
    if (!org || org.type !== "COMPANY") {
      throw new AppError(404, "NOT_FOUND", "Organization not found or not a company");
    }

    const onboarding = await this.regTankRepository.findByOrganizationId(organizationId, portal);
    if (!onboarding?.request_id) {
      throw new AppError(404, "NOT_FOUND", "No RegTank onboarding found for this organization");
    }

    const codDetails = await this.regTankApiClient.getCorporateOnboardingDetails(onboarding.request_id);
    const corporateEntities = extractCorporateEntities(codDetails);

    if (portal === "investor") {
      await prisma.investorOrganization.update({
        where: { id: organizationId },
        data: { corporate_entities: corporateEntities as Prisma.InputJsonValue },
      });
    } else {
      await prisma.issuerOrganization.update({
        where: { id: organizationId },
        data: { corporate_entities: corporateEntities as Prisma.InputJsonValue },
      });
    }

    logger.info(
      { organizationId, portal, codRequestId: onboarding.request_id },
      "Corporate entities refreshed successfully"
    );

    return { success: true, message: "Corporate entities refreshed successfully" };
  }

  /**
   * Update sophisticated investor status for an investor organization
   * Only applicable for investor portal organizations
   */
  async updateSophisticatedStatus(
    organizationId: string,
    isSophisticatedInvestor: boolean,
    reason: string,
    adminUserId?: string
  ): Promise<{ success: boolean }> {
    const org = await prisma.investorOrganization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        owner_user_id: true,
        is_sophisticated_investor: true,
        sophisticated_investor_reason: true,
      },
    });

    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Investor organization not found");
    }

    await prisma.investorOrganization.update({
      where: { id: organizationId },
      data: {
        is_sophisticated_investor: isSophisticatedInvestor,
        sophisticated_investor_reason: reason,
      },
    });

    // Log the sophisticated status update event
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
          newStatus: isSophisticatedInvestor,
          newReason: reason,
          updatedBy: adminUserId || "admin",
          action: isSophisticatedInvestor ? "granted" : "revoked",
        },
      },
    });

    logger.info(
      {
        organizationId,
        previousStatus: org.is_sophisticated_investor,
        newStatus: isSophisticatedInvestor,
        reason,
        updatedBy: adminUserId,
      },
      "Updated sophisticated investor status"
    );

    return { success: true };
  }

  /**
   * List onboarding applications for admin approval queue
   * Combines data from regtank_onboarding with investor/issuer organizations
   * Maps RegTank statuses to admin-friendly approval statuses
   *
   * When status filter is applied, we fetch all records and filter/paginate in memory
   * because the status is derived from multiple fields and cannot be filtered at DB level
   */
  async listOnboardingApplications(params: GetOnboardingApplicationsQuery): Promise<{
    applications: OnboardingApplicationResponse[];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const pendingAllStatuses: OnboardingApprovalStatus[] = [
      "PENDING_SSM_REVIEW",
      "PENDING_APPROVAL",
      "PENDING_AML",
      "PENDING_FINAL_APPROVAL",
    ];

    // When status filter is applied, fetch all records for in-memory filtering/pagination
    const needsInMemoryFiltering = !!params.status;

    if (needsInMemoryFiltering) {
      // Fetch all records (up to 1000) for filtering
      const { applications } = await this.regTankRepository.listOnboardingApplications({
        page: 1,
        pageSize: 1000,
        search: params.search,
        portal: params.portal as "investor" | "issuer" | undefined,
        type: params.type as OrganizationType | undefined,
      });

      // Map applications to response format with derived approval status
      const mappedApplications = applications.map((app) =>
        this.mapToOnboardingApplicationResponse(app)
      );

      // Filter by status
      let filteredApplications: OnboardingApplicationResponse[];
      if (params.status === "PENDING_ALL") {
        filteredApplications = mappedApplications.filter((app) =>
          pendingAllStatuses.includes(app.status)
        );
      } else {
        filteredApplications = mappedApplications.filter((app) => app.status === params.status);
      }

      // Apply pagination in memory
      const totalCount = filteredApplications.length;
      const startIndex = (params.page - 1) * params.pageSize;
      const paginatedApplications = filteredApplications.slice(
        startIndex,
        startIndex + params.pageSize
      );

      return {
        applications: paginatedApplications,
        pagination: {
          page: params.page,
          pageSize: params.pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / params.pageSize),
        },
      };
    }

    // No status filter - use database pagination directly
    const { applications, totalCount } = await this.regTankRepository.listOnboardingApplications({
      page: params.page,
      pageSize: params.pageSize,
      search: params.search,
      portal: params.portal as "investor" | "issuer" | undefined,
      type: params.type as OrganizationType | undefined,
    });

    const mappedApplications = applications.map((app) =>
      this.mapToOnboardingApplicationResponse(app)
    );

    return {
      applications: mappedApplications,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / params.pageSize),
      },
    };
  }

  /**
   * Get a single onboarding application by ID
   */
  async getOnboardingApplicationById(id: string): Promise<OnboardingApplicationResponse | null> {
    const application = await this.regTankRepository.getOnboardingApplicationById(id);
    if (!application) {
      return null;
    }
    return this.mapToOnboardingApplicationResponse(application);
  }

  /**
   * Get count of onboarding applications requiring admin action
   * Includes: PENDING_SSM_REVIEW, PENDING_APPROVAL, PENDING_AML, PENDING_FINAL_APPROVAL
   * Excludes: PENDING_ONBOARDING (user action, not admin)
   */
  async getPendingApprovalCount(): Promise<{ count: number }> {
    // Get all applications (without pagination) to derive statuses
    const { applications } = await this.regTankRepository.listOnboardingApplications({
      page: 1,
      pageSize: 1000, // Get all records for counting
    });

    // Map and filter for admin-actionable statuses
    const pendingStatuses: OnboardingApprovalStatus[] = [
      "PENDING_SSM_REVIEW",
      "PENDING_APPROVAL",
      "PENDING_AML",
      "PENDING_FINAL_APPROVAL",
    ];

    const count = applications
      .map((app) => this.mapToOnboardingApplicationResponse(app))
      .filter((app) => pendingStatuses.includes(app.status)).length;

    return { count };
  }

  /**
   * Map a RegTank onboarding record to the admin-friendly response format
   * Derives the approval status based on RegTank status and organization status
   */
  private mapToOnboardingApplicationResponse(
    record: OnboardingApplicationRecord
  ): OnboardingApplicationResponse {
    const isInvestor = record.portal_type === "investor";
    const org = isInvestor ? record.investor_organization : record.issuer_organization;
    const orgOnboardingStatus = org?.onboarding_status || "PENDING";

    // Derive admin-friendly status
    const status = this.deriveApprovalStatus(
      record.status,
      record.organization_type,
      record.portal_type,
      orgOnboardingStatus
    );

    // Build user name
    const userName = `${record.user.first_name} ${record.user.last_name}`.trim();

    // Build RegTank portal URL for direct linking to the onboarding record
    const regtankConfig = getRegTankConfig();
    // For corporate onboarding, use onboardingCorporate endpoint; for individual, use liveness endpoint
    const regtankPortalUrl = record.request_id
      ? record.onboarding_type === "CORPORATE"
        ? `${regtankConfig.adminPortalUrl}/app/onboardingCorporate/${record.request_id}?archived=false`
        : `${regtankConfig.adminPortalUrl}/app/liveness/${record.request_id}?archived=false`
      : null;

    // Build KYC portal URL for individual AML review (uses kyc_id from organization)
    const kycId = isInvestor
      ? record.investor_organization?.kyc_id
      : record.issuer_organization?.kyc_id;
    const kycPortalUrl = kycId
      ? `${regtankConfig.adminPortalUrl}/app/screen-kyc/result/${kycId}`
      : null;

    // Build KYB portal URL for corporate AML review (extract kybId from COD/KYB webhook payloads)
    let kybId: string | null = null;
    if (record.onboarding_type === "CORPORATE" && record.webhook_payloads) {
      // Find kybId from webhook payloads (check both COD webhooks with kybRequestDto and KYB webhooks)
      for (const payload of record.webhook_payloads) {
        if (payload && typeof payload === "object" && !Array.isArray(payload)) {
          const payloadObj = payload as Record<string, unknown>;
          // Check if this is a COD webhook with kybId directly
          if (payloadObj.kybId && typeof payloadObj.kybId === "string") {
            kybId = payloadObj.kybId;
            break;
          }
          // Check if this is a COD webhook with kybRequestDto containing kybId
          const kybRequestDto = payloadObj.kybRequestDto;
          if (
            kybRequestDto &&
            typeof kybRequestDto === "object" &&
            !Array.isArray(kybRequestDto)
          ) {
            const kybDto = kybRequestDto as Record<string, unknown>;
            if (kybDto.kybId && typeof kybDto.kybId === "string") {
              kybId = kybDto.kybId;
              break;
            }
          }
          // Check if this is a KYB webhook with requestId as kybId
          if (payloadObj.requestId && typeof payloadObj.requestId === "string") {
            // KYB webhook has requestId that matches the kybId pattern (e.g., KYB00006)
            const requestId = payloadObj.requestId as string;
            if (requestId.startsWith("KYB")) {
              kybId = requestId;
              break;
            }
          }
        }
      }
    }

    const kybPortalUrl = kybId
      ? `${regtankConfig.adminPortalUrl}/app/screen-kyb/result/${kybId}`
      : null;

    // Get approval flags based on portal type
    const isInvestorOrg = record.portal_type === "investor";
    const investorOrg = record.investor_organization;
    const issuerOrg = record.issuer_organization;

    // For investors, use investor_organization fields; for issuers, use issuer_organization fields
    const onboardingApproved = isInvestorOrg
      ? (investorOrg?.onboarding_approved ?? false)
      : (issuerOrg?.onboarding_approved ?? false);
    const amlApproved = isInvestorOrg
      ? (investorOrg?.aml_approved ?? false)
      : (issuerOrg?.aml_approved ?? false);
    const tncAccepted = isInvestorOrg
      ? (investorOrg?.tnc_accepted ?? false)
      : (issuerOrg?.tnc_accepted ?? false);
    // SSM approval: for investors use ssm_approved, for issuers use ssm_checked
    const ssmApproved = isInvestorOrg
      ? (investorOrg?.ssm_approved ?? false)
      : (issuerOrg?.ssm_checked ?? false);

    const isCompleted = orgOnboardingStatus === "COMPLETED";

    // Use onboarded_at from organization table for completedAt (more accurate than regtank completed_at)
    const onboardedAt = org?.onboarded_at;

    // Extract submittedAt from webhook payloads - look for WAIT_FOR_APPROVAL status timestamp
    // This represents when the user actually submitted their onboarding for approval
    let submittedAt: string | null = null;
    if (record.webhook_payloads && Array.isArray(record.webhook_payloads)) {
      for (const payload of record.webhook_payloads) {
        if (payload && typeof payload === "object" && !Array.isArray(payload)) {
          const payloadObj = payload as Record<string, unknown>;
          const payloadStatus = (payloadObj.status as string)?.toUpperCase();
          if (payloadStatus === "WAIT_FOR_APPROVAL" && payloadObj.timestamp) {
            submittedAt = payloadObj.timestamp as string;
            break; // Use the first WAIT_FOR_APPROVAL timestamp found
          }
        }
      }
    }
    // Fallback to completed_at if no WAIT_FOR_APPROVAL webhook found
    if (!submittedAt && record.completed_at) {
      submittedAt = record.completed_at.toISOString();
    }

    // Sophisticated investor status (only for investor portal)
    const isSophisticatedInvestor = isInvestorOrg
      ? (investorOrg?.is_sophisticated_investor ?? false)
      : undefined;
    const sophisticatedInvestorReason = isInvestorOrg
      ? (investorOrg?.sophisticated_investor_reason ?? null)
      : undefined;

    // Director KYC status (only for corporate onboarding)
    const directorKycStatusRaw =
      record.organization_type === "COMPANY"
        ? isInvestorOrg
          ? (investorOrg as { director_kyc_status?: unknown })?.director_kyc_status
          : (issuerOrg as { director_kyc_status?: unknown })?.director_kyc_status
        : undefined;

    const directorKycStatus:
      | {
        corpIndvDirectorCount: number;
        corpIndvShareholderCount: number;
        corpBizShareholderCount: number;
        directors: Array<{
          eodRequestId: string;
          name: string;
          email: string;
          role: string;
          kycStatus:
          | "PENDING"
          | "LIVENESS_STARTED"
          | "WAIT_FOR_APPROVAL"
          | "APPROVED"
          | "REJECTED";
          kycId?: string;
          lastUpdated: string;
        }>;
        lastSyncedAt: string;
      }
      | undefined = directorKycStatusRaw
        ? {
          ...(directorKycStatusRaw as {
            corpIndvDirectorCount: number;
            corpIndvShareholderCount: number;
            corpBizShareholderCount: number;
            directors: Array<{
              eodRequestId: string;
              name: string;
              email: string;
              role: string;
              kycStatus: string;
              kycId?: string;
              lastUpdated: string;
            }>;
            lastSyncedAt: string;
          }),
          directors: (
            (
              directorKycStatusRaw as {
                directors: Array<{
                  eodRequestId: string;
                  name: string;
                  email: string;
                  role: string;
                  kycStatus: string;
                  kycId?: string;
                  lastUpdated: string;
                }>;
              }
            ).directors || []
          ).map((d) => ({
            ...d,
            kycStatus: d.kycStatus as
              | "PENDING"
              | "LIVENESS_STARTED"
              | "WAIT_FOR_APPROVAL"
              | "APPROVED"
              | "REJECTED",
          })),
        }
        : undefined;

    // Director AML status (only for corporate onboarding)
    const directorAmlStatusRaw =
      record.organization_type === "COMPANY"
        ? isInvestorOrg
          ? (investorOrg as { director_aml_status?: unknown })?.director_aml_status
          : (issuerOrg as { director_aml_status?: unknown })?.director_aml_status
        : undefined;

    const directorAmlStatus:
      | {
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
      | undefined = directorAmlStatusRaw
        ? {
          ...(directorAmlStatusRaw as {
            directors: Array<{
              kycId: string;
              name: string;
              email: string;
              role: string;
              amlStatus: string;
              amlMessageStatus: string;
              amlRiskScore: number | null;
              amlRiskLevel: string | null;
              lastUpdated: string;
            }>;
            businessShareholders?: Array<{
              codRequestId: string;
              kybId: string;
              businessName: string;
              sharePercentage?: number | null;
              amlStatus: string;
              amlMessageStatus: string;
              amlRiskScore: number | null;
              amlRiskLevel: string | null;
              lastUpdated: string;
            }>;
            lastSyncedAt: string;
          }),
          directors: (
            (
              directorAmlStatusRaw as {
                directors: Array<{
                  kycId: string;
                  name: string;
                  email: string;
                  role: string;
                  amlStatus: string;
                  amlMessageStatus: string;
                  amlRiskScore: number | null;
                  amlRiskLevel: string | null;
                  lastUpdated: string;
                }>;
              }
            ).directors || []
          ).map((d) => ({
            ...d,
            amlStatus: d.amlStatus as "Unresolved" | "Approved" | "Rejected" | "Pending",
            amlMessageStatus: d.amlMessageStatus as "DONE" | "PENDING" | "ERROR",
          })),
          businessShareholders: (
            (
              directorAmlStatusRaw as {
                businessShareholders?: Array<{
                  codRequestId: string;
                  kybId: string;
                  businessName: string;
                  sharePercentage?: number | null;
                  amlStatus: string;
                  amlMessageStatus: string;
                  amlRiskScore: number | null;
                  amlRiskLevel: string | null;
                  lastUpdated: string;
                }>;
              }
            ).businessShareholders || []
          ).map((b) => ({
            ...b,
            amlStatus: b.amlStatus as "Unresolved" | "Approved" | "Rejected" | "Pending",
            amlMessageStatus: b.amlMessageStatus as "DONE" | "PENDING" | "ERROR",
          })),
        }
        : undefined;

    // Corporate entities (only for corporate onboarding)
    const corporateEntitiesRaw =
      record.organization_type === "COMPANY"
        ? isInvestorOrg
          ? (investorOrg as { corporate_entities?: unknown })?.corporate_entities
          : (issuerOrg as { corporate_entities?: unknown })?.corporate_entities
        : undefined;

    const corporateEntities = corporateEntitiesRaw
      ? (corporateEntitiesRaw as {
        directors?: Array<Record<string, unknown>>;
        shareholders?: Array<Record<string, unknown>>;
        corporateShareholders?: Array<Record<string, unknown>>;
      })
      : undefined;

    // Derive organization name and SSM from top-level or corporate_onboarding_data.basicInfo
    const corporateData = org
      ? (org as { corporate_onboarding_data?: { basicInfo?: { businessName?: string; ssmRegistrationNumber?: string; ssmRegisterNumber?: string } } }).corporate_onboarding_data
      : undefined;
    const basicInfo = corporateData?.basicInfo;
    const organizationName =
      org?.name ?? basicInfo?.businessName ?? null;
    const registrationNumber =
      org?.registration_number ?? basicInfo?.ssmRegistrationNumber ?? basicInfo?.ssmRegisterNumber ?? null;

    return {
      id: record.id,
      userId: record.user.user_id,
      userName: userName || record.user.email,
      userEmail: record.user.email,
      type: record.organization_type as "PERSONAL" | "COMPANY",
      portal: record.portal_type as "investor" | "issuer",
      organizationId: org?.id || "",
      organizationName,
      registrationNumber,
      regtankRequestId: record.request_id,
      regtankStatus: record.status,
      regtankSubstatus: record.substatus,
      regtankPortalUrl,
      kycPortalUrl,
      kybPortalUrl,
      status,
      ssmVerified: false, // Will be implemented when SSM verification is added
      ssmVerifiedAt: null,
      ssmVerifiedBy: null,
      submittedAt,
      completedAt: onboardedAt?.toISOString() || null,
      onboardingApproved,
      amlApproved,
      tncAccepted,
      ssmApproved,
      isCompleted,
      isSophisticatedInvestor,
      sophisticatedInvestorReason,
      directorKycStatus,
      directorAmlStatus,
      corporateEntities,
    };
  }

  /**
   * Derive the admin-friendly approval status from RegTank status and organization status
   *
   * Status mapping:
   * - PENDING_ONBOARDING: User is in the process of completing RegTank onboarding
   * - PENDING_APPROVAL: Completed RegTank onboarding, awaiting admin approval of identity
   * - PENDING_AML: Identity approved, awaiting AML screening approval
   * - PENDING_SSM_REVIEW: AML approved (company only), awaiting SSM verification
   * - PENDING_FINAL_APPROVAL: All checks done, awaiting final approval to activate account
   * - COMPLETED: Fully onboarded
   * - REJECTED: Rejected at any stage
   * - EXPIRED: RegTank link expired
   * - CANCELLED: Onboarding was cancelled/restarted
   */
  private deriveApprovalStatus(
    regtankStatus: string,
    _orgType: OrganizationType,
    _portalType: string,
    orgOnboardingStatus: string
  ): OnboardingApprovalStatus {
    // Check for final states first (these are specific to the regtank_onboarding record)
    if (regtankStatus === "REJECTED") {
      return "REJECTED";
    }

    if (regtankStatus === "EXPIRED") {
      return "EXPIRED";
    }

    // CANCELLED must be checked before organization status because cancelled records
    // still point to the same organization which may have a different status from
    // a new/restarted onboarding flow
    if (regtankStatus === "CANCELLED") {
      return "CANCELLED";
    }

    // Check organization onboarding status - these are the definitive states
    if (orgOnboardingStatus === "COMPLETED") {
      return "COMPLETED";
    }

    if (orgOnboardingStatus === "PENDING_FINAL_APPROVAL") {
      return "PENDING_FINAL_APPROVAL";
    }

    if (orgOnboardingStatus === "PENDING_SSM_REVIEW") {
      return "PENDING_SSM_REVIEW";
    }

    if (orgOnboardingStatus === "PENDING_AML") {
      return "PENDING_AML";
    }

    // RegTank in-progress statuses
    const inProgressStatuses = [
      "URL_GENERATED",
      "PROCESSING",
      "ID_UPLOADED",
      "ID_UPLOADED_FAILED",
      "LIVENESS_STARTED",
      "CAMERA_FAILED",
      "FORM_FILLING",
      "IN_PROGRESS",
      "PENDING",
    ];

    if (inProgressStatuses.includes(regtankStatus)) {
      return "PENDING_ONBOARDING";
    }

    // RegTank pending approval statuses
    const pendingApprovalStatuses = ["WAIT_FOR_APPROVAL", "LIVENESS_PASSED", "PENDING_APPROVAL"];

    if (pendingApprovalStatuses.includes(regtankStatus)) {
      return "PENDING_APPROVAL";
    }

    // Default to pending onboarding for unknown statuses
    return "PENDING_ONBOARDING";
  }

  /**
   * Restart a user's onboarding via RegTank restart API
   * This calls the RegTank restart endpoint which creates a new record with a new requestId,
   * marks the old record as CANCELLED, creates a new record in our DB, and resets org status.
   *
   * @see https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/2.-onboarding/2.4-individual-onboarding-endpoint-json-restart-onboarding
   */
  async restartOnboarding(
    req: Request,
    onboardingId: string,
    adminUserId: string
  ): Promise<{ success: boolean; message: string; verifyLink?: string; newRequestId?: string }> {
    // Find the onboarding record
    const onboarding = await this.regTankRepository.findById(onboardingId);
    if (!onboarding) {
      throw new AppError(404, "NOT_FOUND", "Onboarding record not found");
    }

    // Define statuses that can be restarted
    const restartableStatuses = [
      "REJECTED",
      "EXPIRED",
      "PENDING_APPROVAL",
      "PENDING_AML",
      "LIVENESS_PASSED",
      "WAIT_FOR_APPROVAL",
      "APPROVED",
      "COMPLETED",
      "IN_PROGRESS",
      "PENDING",
    ];

    if (!restartableStatuses.includes(onboarding.status)) {
      throw new AppError(
        400,
        "INVALID_STATE",
        `Cannot restart onboarding in status: ${onboarding.status}`
      );
    }

    // Call RegTank restart API - this returns a NEW requestId
    const regTankResponse = await this.regTankApiClient.restartOnboarding(onboarding.request_id);

    const cancelReason = `Restarted by admin ${adminUserId}. New requestId: ${regTankResponse.requestId}`;

    // Mark the old onboarding record as cancelled
    await this.regTankRepository.cancelOnboarding(onboardingId, cancelReason);

    // Extract request metadata for logging
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);
    const isInvestorPortal = onboarding.portal_type === "investor";
    const role = isInvestorPortal ? UserRole.INVESTOR : UserRole.ISSUER;

    // Determine organization ID
    const organizationId = isInvestorPortal
      ? onboarding.investor_organization_id
      : onboarding.issuer_organization_id;

    // Create new onboarding record with the new requestId from RegTank
    const expiresIn = regTankResponse.expiredIn || 86400;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Create new onboarding record with PENDING status
    // Status will be set to IN_PROGRESS when user clicks "Yes, Restart Onboarding"
    await this.regTankRepository.createOnboarding({
      userId: onboarding.user_id,
      organizationId: organizationId || undefined,
      organizationType: onboarding.organization_type,
      portalType: onboarding.portal_type,
      requestId: regTankResponse.requestId,
      referenceId: `${organizationId}-restart-${Date.now()}`,
      onboardingType: onboarding.onboarding_type,
      verifyLink: regTankResponse.verifyLink,
      verifyLinkExpiresAt: expiresAt,
      status: "PENDING",
      regtankResponse: regTankResponse as Prisma.InputJsonValue,
    });

    // Reset the organization's onboarding status to PENDING and clear all approval-related fields
    // User will need to click "Yes, Restart Onboarding" to set it to IN_PROGRESS
    if (isInvestorPortal && onboarding.investor_organization_id) {
      await prisma.investorOrganization.update({
        where: { id: onboarding.investor_organization_id },
        data: {
          onboarding_status: "PENDING",
          is_sophisticated_investor: false,
          onboarding_approved: false,
          aml_approved: false,
          tnc_accepted: false,
          deposit_received: false,
          ssm_approved: false,
          admin_approved_at: null,
          onboarded_at: null,
        },
      });
    } else if (onboarding.issuer_organization_id) {
      await prisma.issuerOrganization.update({
        where: { id: onboarding.issuer_organization_id },
        data: {
          onboarding_status: "PENDING",
          onboarding_approved: false,
          aml_approved: false,
          tnc_accepted: false,
          ssm_checked: false,
          admin_approved_at: null,
          onboarded_at: null,
        },
      });
    }

    // Log the cancellation/restart event
    await this.repository.createOnboardingLog({
      userId: onboarding.user_id,
      role,
      eventType: "ONBOARDING_CANCELLED",
      portal: onboarding.portal_type,
      ipAddress,
      userAgent,
      deviceInfo,
      deviceType,
      organizationName: onboarding.investor_organization?.name || onboarding.issuer_organization?.name || undefined,
      investorOrganizationId: onboarding.investor_organization_id || undefined,
      issuerOrganizationId: onboarding.issuer_organization_id || undefined,
      metadata: {
        cancelledOnboardingId: onboardingId,
        cancelledRequestId: onboarding.request_id,
        newRequestId: regTankResponse.requestId,
        previousStatus: onboarding.status,
        cancelledBy: adminUserId,
        reason: "Restart requested by admin",
        organizationType: onboarding.organization_type,
        organizationId,
      },
    });

    logger.info(
      {
        oldOnboardingId: onboardingId,
        oldRequestId: onboarding.request_id,
        newRequestId: regTankResponse.requestId,
        userId: onboarding.user_id,
        previousStatus: onboarding.status,
        adminUserId,
        portalType: onboarding.portal_type,
      },
      "Onboarding restarted by admin via RegTank restart API"
    );

    return {
      success: true,
      message: "Onboarding has been restarted. User will receive a new verification link.",
      verifyLink: regTankResponse.verifyLink,
      newRequestId: regTankResponse.requestId,
    };
  }

  /**
   * Complete final approval for an onboarding application
   * This marks the organization as fully onboarded after all prerequisite checks are complete
   *
   * Requirements:
   * - Personal (Investor): onboarding_approved, aml_approved, tnc_accepted
   * - Company (Investor/Issuer): onboarding_approved, aml_approved, tnc_accepted, ssm_approved/ssm_checked
   */
  async completeFinalApproval(
    req: Request,
    onboardingId: string,
    adminUserId: string
  ): Promise<{ success: true; message: string }> {
    // Get the onboarding record
    const onboarding = await prisma.regTankOnboarding.findUnique({
      where: { id: onboardingId },
      include: {
        investor_organization: true,
        issuer_organization: true,
        user: {
          select: {
            user_id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!onboarding) {
      throw new AppError(404, "NOT_FOUND", "Onboarding record not found");
    }

    const isInvestor = onboarding.portal_type === "investor";
    const org = isInvestor ? onboarding.investor_organization : onboarding.issuer_organization;

    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    // Check if already completed
    if (org.onboarding_status === "COMPLETED") {
      throw new AppError(400, "ALREADY_COMPLETED", "Onboarding is already completed");
    }

    // Get approval flags based on organization type
    const isCompany = onboarding.organization_type === "COMPANY";

    if (isInvestor && onboarding.investor_organization) {
      const investorOrg = onboarding.investor_organization;

      // Check required flags for personal investor
      if (!investorOrg.onboarding_approved) {
        throw new AppError(400, "VALIDATION_ERROR", "Onboarding approval is required");
      }
      if (!investorOrg.aml_approved) {
        throw new AppError(400, "VALIDATION_ERROR", "AML approval is required");
      }
      if (!investorOrg.tnc_accepted) {
        throw new AppError(400, "VALIDATION_ERROR", "Terms and conditions acceptance is required");
      }

      // For company accounts, also check SSM approval and director KYC completion
      if (isCompany) {
        if (!investorOrg.ssm_approved) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "SSM approval is required for company accounts"
          );
        }

        // Check if all directors have completed KYC
        if (investorOrg.director_kyc_status) {
          const directorKycStatus = investorOrg.director_kyc_status as {
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

          const pendingDirectors = directorKycStatus.directors.filter(
            (director) => director.kycStatus !== "APPROVED"
          );

          if (pendingDirectors.length > 0) {
            throw new AppError(
              400,
              "VALIDATION_ERROR",
              `All directors/shareholders must complete KYC verification before final approval. ${pendingDirectors.length} director(s) still pending: ${pendingDirectors.map((d) => d.name).join(", ")}`
            );
          }
        }
      }

      // Update investor organization
      await prisma.investorOrganization.update({
        where: { id: org.id },
        data: {
          onboarding_status: "COMPLETED",
          onboarded_at: new Date(),
          admin_approved_at: new Date(),
        },
      });
    } else if (!isInvestor && onboarding.issuer_organization) {
      const issuerOrg = onboarding.issuer_organization;

      // Check required flags for issuer (always company)
      if (!issuerOrg.onboarding_approved) {
        throw new AppError(400, "VALIDATION_ERROR", "Onboarding approval is required");
      }
      if (!issuerOrg.aml_approved) {
        throw new AppError(400, "VALIDATION_ERROR", "AML approval is required");
      }
      if (!issuerOrg.tnc_accepted) {
        throw new AppError(400, "VALIDATION_ERROR", "Terms and conditions acceptance is required");
      }
      if (!issuerOrg.ssm_checked) {
        throw new AppError(400, "VALIDATION_ERROR", "SSM check is required for issuer accounts");
      }

      // Check if all directors have completed KYC
      if (issuerOrg.director_kyc_status) {
        const directorKycStatus = issuerOrg.director_kyc_status as {
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

        const pendingDirectors = directorKycStatus.directors.filter(
          (director) => director.kycStatus !== "APPROVED"
        );

        if (pendingDirectors.length > 0) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            `All directors/shareholders must complete KYC verification before final approval. ${pendingDirectors.length} director(s) still pending: ${pendingDirectors.map((d) => d.name).join(", ")}`
          );
        }
      }

      // Update issuer organization
      await prisma.issuerOrganization.update({
        where: { id: org.id },
        data: {
          onboarding_status: "COMPLETED",
          onboarded_at: new Date(),
          admin_approved_at: new Date(),
        },
      });
    }

    // Update RegTank onboarding status to COMPLETED
    // Status flow: IN_PROGRESS → PENDING_APPROVAL → PENDING_AML → COMPLETED
    // Final approval means all checks (including AML) are done
    const previousRegTankStatus = onboarding.status;

    logger.info(
      {
        onboardingId,
        regtankRequestId: onboarding.request_id,
        organizationId: org.id,
        previousRegTankStatus,
        organizationOnboardingStatus: org.onboarding_status,
        amlApproved: isInvestor
          ? onboarding.investor_organization?.aml_approved
          : onboarding.issuer_organization?.aml_approved,
        note: "About to update regtank_onboarding.status to COMPLETED after final approval",
      },
      "[Final Approval] Current regtank_onboarding status before update"
    );

    await this.regTankRepository.updateStatus(onboarding.request_id, {
      status: "COMPLETED",
      completedAt: new Date(),
    });

    // Refresh corporate entities for company organizations with latest data from RegTank
    if (isCompany && onboarding.request_id) {
      try {
        const codDetails = await this.regTankApiClient.getCorporateOnboardingDetails(onboarding.request_id);
        const corporateEntities = extractCorporateEntities(codDetails);

        if (isInvestor) {
          await prisma.investorOrganization.update({
            where: { id: org.id },
            data: { corporate_entities: corporateEntities as Prisma.InputJsonValue },
          });
        } else {
          await prisma.issuerOrganization.update({
            where: { id: org.id },
            data: { corporate_entities: corporateEntities as Prisma.InputJsonValue },
          });
        }

        logger.info(
          { organizationId: org.id, codRequestId: onboarding.request_id },
          "Corporate entities refreshed after final approval"
        );
      } catch (refreshError) {
        logger.error(
          {
            error: refreshError instanceof Error ? refreshError.message : String(refreshError),
            organizationId: org.id,
          },
          "Failed to refresh corporate entities after final approval (non-blocking)"
        );
      }
    }

    // Verify the update by fetching the record again
    const updatedOnboarding = await this.regTankRepository.findByRequestId(onboarding.request_id);

    logger.info(
      {
        onboardingId,
        regtankRequestId: onboarding.request_id,
        organizationId: org.id,
        previousRegTankStatus,
        newRegTankStatus: updatedOnboarding?.status || "NOT_FOUND",
        organizationOnboardingStatus: "COMPLETED",
        amlApproved: isInvestor
          ? onboarding.investor_organization?.aml_approved
          : onboarding.issuer_organization?.aml_approved,
        completedAt: updatedOnboarding?.completed_at,
      },
      "[Final Approval] ✓ Successfully updated regtank_onboarding.status to COMPLETED"
    );

    // Create onboarding log entries
    // Create FINAL_APPROVAL_COMPLETED log (replaces USER_COMPLETED)
    // Use FINAL_APPROVAL_COMPLETED for both corporate and personal onboarding
    const isCorporateOnboarding = onboarding.onboarding_type === "CORPORATE";
    const eventType = "FINAL_APPROVAL_COMPLETED";
    await prisma.onboardingLog.create({
      data: {
        user_id: onboarding.user_id,
        event_type: eventType,
        role: isInvestor ? "INVESTOR" : "ISSUER",
        portal: onboarding.portal_type,
        ip_address:
          (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null,
        user_agent: req.headers["user-agent"] || null,
        device_info: null,
        device_type: null,
        organization_name: onboarding.investor_organization?.name || onboarding.issuer_organization?.name || undefined,
        investor_organization_id: onboarding.investor_organization_id || undefined,
        issuer_organization_id: onboarding.issuer_organization_id || undefined,
        metadata: {
          organizationId: org.id,
          organizationType: onboarding.organization_type,
          portalType: onboarding.portal_type,
          approvedBy: adminUserId,
          regtankRequestId: onboarding.request_id,
          isCorporateOnboarding,
        },
      },
    });

    logger.info(
      {
        onboardingId,
        organizationId: org.id,
        userId: onboarding.user_id,
        adminUserId,
        portalType: onboarding.portal_type,
        organizationType: onboarding.organization_type,
      },
      "Final approval completed by admin"
    );

    // Send notification to the user
    try {
      await this.notificationService.sendTyped(
        onboarding.user_id,
        NotificationTypeIds.ONBOARDING_APPROVED,
        {
          onboardingType: onboarding.onboarding_type,
          orgName: onboarding.investor_organization?.name || onboarding.issuer_organization?.name || "your organization",
          portalType: onboarding.portal_type as 'investor' | 'issuer',
        }
      );
    } catch (notificationError) {
      logger.error(
        { error: notificationError, userId: onboarding.user_id },
        "Failed to send onboarding completion notification"
      );
      // Don't throw error here to not fail the onboarding completion process
    }

    return {
      success: true,
      message: "Onboarding has been completed successfully. The user is now fully onboarded.",
    };
  }

  /**
   * Approve AML screening for an onboarding application
   * Sets aml_approved = true and updates regtank_onboarding.status to APPROVED for corporate
   */
  async approveAmlScreening(
    req: Request,
    onboardingId: string,
    adminUserId: string
  ): Promise<{ success: true; message: string }> {
    // Get the onboarding record
    const onboarding = await prisma.regTankOnboarding.findUnique({
      where: { id: onboardingId },
      include: {
        investor_organization: true,
        issuer_organization: true,
        user: {
          select: {
            user_id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!onboarding) {
      throw new AppError(404, "NOT_FOUND", "Onboarding record not found");
    }

    const isInvestor = onboarding.portal_type === "investor";
    const org = isInvestor ? onboarding.investor_organization : onboarding.issuer_organization;

    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    // Check if AML is already approved
    const isAmlApproved = isInvestor
      ? onboarding.investor_organization?.aml_approved
      : onboarding.issuer_organization?.aml_approved;

    if (isAmlApproved) {
      throw new AppError(400, "ALREADY_APPROVED", "AML screening is already approved");
    }

    // Update the organization's aml_approved flag
    const now = new Date();
    if (isInvestor && onboarding.investor_organization) {
      await prisma.investorOrganization.update({
        where: { id: org.id },
        data: {
          aml_approved: true,
          onboarding_status: OnboardingStatus.PENDING_SSM_REVIEW,
        },
      });
    } else if (!isInvestor && onboarding.issuer_organization) {
      await prisma.issuerOrganization.update({
        where: { id: org.id },
        data: {
          aml_approved: true,
          onboarding_status: OnboardingStatus.PENDING_SSM_REVIEW,
        },
      });
    }

    // For corporate onboarding, update regtank_onboarding.status to APPROVED
    const isCorporateOnboarding = onboarding.onboarding_type === "CORPORATE";
    if (isCorporateOnboarding) {
      await this.regTankRepository.updateStatus(onboarding.request_id, {
        status: "APPROVED",
      });

      logger.info(
        {
          onboardingId,
          regtankRequestId: onboarding.request_id,
          organizationId: org.id,
          organizationType: onboarding.organization_type,
          previousRegTankStatus: onboarding.status,
          newRegTankStatus: "APPROVED",
          adminUserId,
        },
        "[AML Approval] Updated regtank_onboarding.status to APPROVED for corporate onboarding"
      );
    }

    // Create onboarding log entry
    await prisma.onboardingLog.create({
      data: {
        user_id: onboarding.user_id,
        event_type: "AML_APPROVED",
        role: isInvestor ? "INVESTOR" : "ISSUER",
        portal: onboarding.portal_type,
        ip_address:
          (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null,
        user_agent: req.headers["user-agent"] || null,
        device_info: null,
        device_type: null,
        organization_name: onboarding.investor_organization?.name || onboarding.issuer_organization?.name || undefined,
        investor_organization_id: onboarding.investor_organization_id || undefined,
        issuer_organization_id: onboarding.issuer_organization_id || undefined,
        metadata: {
          organizationId: org.id,
          organizationType: onboarding.organization_type,
          portalType: onboarding.portal_type,
          onboardingRequestId: onboarding.request_id,
          isCorporateOnboarding,
          previousStatus: org.onboarding_status,
          newStatus: OnboardingStatus.PENDING_SSM_REVIEW,
          approvedBy: adminUserId,
          approvedAt: now.toISOString(),
        },
      },
    });

    logger.info(
      {
        onboardingId,
        organizationId: org.id,
        userId: onboarding.user_id,
        adminUserId,
        portalType: onboarding.portal_type,
        organizationType: onboarding.organization_type,
        isCorporateOnboarding,
      },
      "AML screening approved by admin"
    );

    return {
      success: true,
      message: isCorporateOnboarding
        ? "AML screening approved. RegTank onboarding status updated to APPROVED. Organization moved to SSM review."
        : "AML screening approved. Organization moved to SSM review.",
    };
  }

  /**
   * Approve SSM verification for a company organization
   * Sets ssm_approved = true for the organization
   */
  async approveSsmVerification(
    req: Request,
    onboardingId: string,
    adminUserId: string
  ): Promise<{ success: true; message: string }> {
    // Get the onboarding record
    const onboarding = await prisma.regTankOnboarding.findUnique({
      where: { id: onboardingId },
      include: {
        investor_organization: true,
        issuer_organization: true,
        user: {
          select: {
            user_id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!onboarding) {
      throw new AppError(404, "NOT_FOUND", "Onboarding record not found");
    }

    // SSM verification only applies to company type
    if (onboarding.organization_type !== "COMPANY") {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "SSM verification is only applicable for company accounts"
      );
    }

    const isInvestor = onboarding.portal_type === "investor";
    const org = isInvestor ? onboarding.investor_organization : onboarding.issuer_organization;

    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    // Update the organization's ssm_approved flag and transition to PENDING_FINAL_APPROVAL
    // For company accounts, SSM approval is required before final approval step
    const now = new Date();
    if (isInvestor && onboarding.investor_organization) {
      await prisma.investorOrganization.update({
        where: { id: org.id },
        data: {
          ssm_approved: true,
          onboarding_status: OnboardingStatus.PENDING_FINAL_APPROVAL,
        },
      });
    } else if (!isInvestor && onboarding.issuer_organization) {
      await prisma.issuerOrganization.update({
        where: { id: org.id },
        data: {
          ssm_checked: true,
          onboarding_status: OnboardingStatus.PENDING_FINAL_APPROVAL,
        },
      });
    }

    // Create onboarding log entry with dedicated SSM_APPROVED event type
    await prisma.onboardingLog.create({
      data: {
        user_id: onboarding.user_id,
        event_type: "SSM_APPROVED",
        role: isInvestor ? "INVESTOR" : "ISSUER",
        portal: onboarding.portal_type,
        ip_address:
          (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null,
        user_agent: req.headers["user-agent"] || null,
        device_info: null,
        device_type: null,
        organization_name: onboarding.investor_organization?.name || onboarding.issuer_organization?.name || undefined,
        investor_organization_id: onboarding.investor_organization_id || undefined,
        issuer_organization_id: onboarding.issuer_organization_id || undefined,
        metadata: {
          organizationId: org.id,
          organizationType: onboarding.organization_type,
          portalType: onboarding.portal_type,
          approvedBy: adminUserId,
          regtankRequestId: onboarding.request_id,
          adminApprovedAt: now.toISOString(),
        },
      },
    });

    // SSM_APPROVED log already created above, no need for additional ONBOARDING_STATUS_UPDATED log

    logger.info(
      {
        onboardingId,
        organizationId: org.id,
        userId: onboarding.user_id,
        adminUserId,
        portalType: onboarding.portal_type,
      },
      "SSM verification approved by admin"
    );

    return {
      success: true,
      message: "SSM verification has been approved successfully.",
    };
  }

  /**
   * Refresh corporate onboarding status by fetching latest director KYC statuses from RegTank
   * Fetches COD details and EOD details for each director to update their KYC statuses
   */
  async refreshCorporateOnboardingStatus(
    _req: Request,
    onboardingId: string,
    adminUserId: string
  ): Promise<{ success: true; message: string; directorsUpdated: number }> {
    // Get the onboarding record
    const onboarding = await prisma.regTankOnboarding.findUnique({
      where: { id: onboardingId },
      include: {
        investor_organization: true,
        issuer_organization: true,
        user: {
          select: {
            user_id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!onboarding) {
      throw new AppError(404, "NOT_FOUND", "Onboarding record not found");
    }

    // Only applicable for corporate onboarding
    if (onboarding.onboarding_type !== "CORPORATE") {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Refresh corporate status is only applicable for corporate onboarding"
      );
    }

    const isInvestor = onboarding.portal_type === "investor";
    const org = isInvestor ? onboarding.investor_organization : onboarding.issuer_organization;

    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    const codRequestId = onboarding.request_id;

    try {
      // Fetch COD details from RegTank API
      logger.info(
        { codRequestId, organizationId: org.id, adminUserId },
        "Fetching COD details to refresh director KYC statuses"
      );

      const codDetails = await this.regTankApiClient.getCorporateOnboardingDetails(codRequestId);

      // Helper function to normalize name+email for duplicate detection
      const normalizeKey = (name: string, email: string): string => {
        return `${(name || "").toLowerCase().trim()}|${(email || "").toLowerCase().trim()}`;
      };

      // Extract and update director information
      // Use a Map to deduplicate by normalized name+email and merge roles for people who are both directors and shareholders
      const directorsMap = new Map<string, {
        eodRequestId: string; // Keep director EOD ID as primary
        shareholderEodRequestId?: string; // Track shareholder EOD ID if different
        name: string;
        email: string;
        role: string;
        kycStatus: string;
        kycId?: string;
        governmentIdNumber?: string;
        lastUpdated: string;
      }>();

      // Process individual directors
      if (codDetails.corpIndvDirectors && Array.isArray(codDetails.corpIndvDirectors)) {
        for (const director of codDetails.corpIndvDirectors) {
          const eodRequestId = director.corporateIndividualRequest?.requestId || "";
          const userInfo = director.corporateUserRequestInfo;
          const formContent = userInfo?.formContent?.content || [];

          // Extract name, email, role from formContent
          type FormField = { fieldName: string; fieldValue: string };
          const typedFormContent = formContent as FormField[];
          const firstName =
            typedFormContent.find((f) => f.fieldName === "First Name")?.fieldValue || "";
          const lastName =
            typedFormContent.find((f) => f.fieldName === "Last Name")?.fieldValue || "";
          const designation =
            typedFormContent.find((f) => f.fieldName === "Designation")?.fieldValue || "";
          const email =
            typedFormContent.find((f) => f.fieldName === "Email Address")?.fieldValue ||
            userInfo?.email ||
            "";
          const name = `${firstName} ${lastName}`.trim() || userInfo?.fullName || "";
          const governmentIdNumber =
            extractGovernmentIdFromCorporateUserInfo(userInfo as Record<string, unknown>) || undefined;

          const mapKey = normalizeKey(name, email);

          // Fetch EOD details to get latest KYC status
          let kycStatus = director.corporateIndividualRequest?.status || "PENDING";
          let kycId = director.kycRequestInfo?.kycId;

          if (eodRequestId) {
            try {
              const eodDetails =
                await this.regTankApiClient.getEntityOnboardingDetails(eodRequestId);
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
                  codRequestId,
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
            governmentIdNumber,
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

          type FormField = { fieldName: string; fieldValue: string };
          const typedFormContent = formContent as FormField[];
          const firstName =
            typedFormContent.find((f) => f.fieldName === "First Name")?.fieldValue || "";
          const lastName =
            typedFormContent.find((f) => f.fieldName === "Last Name")?.fieldValue || "";
          const email =
            typedFormContent.find((f) => f.fieldName === "Email Address")?.fieldValue ||
            userInfo?.email ||
            "";
          const sharePercent =
            typedFormContent.find((f) => f.fieldName === "% of Shares")?.fieldValue || "";
          const name = `${firstName} ${lastName}`.trim() || userInfo?.fullName || "";
          const shareholderGovernmentId =
            extractGovernmentIdFromCorporateUserInfo(userInfo as Record<string, unknown>) || undefined;

          const mapKey = normalizeKey(name, email);
          const existingDirector = directorsMap.get(mapKey);
          const shareholderRole = `Shareholder${sharePercent ? ` (${sharePercent}%)` : ""}`;

          // Fetch EOD details to get latest KYC status
          let kycStatus = shareholder.corporateIndividualRequest?.status || "PENDING";
          let kycId = shareholder.kycRequestInfo?.kycId;

          if (shareholderEodRequestId) {
            try {
              const eodDetails =
                await this.regTankApiClient.getEntityOnboardingDetails(shareholderEodRequestId);
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
                  codRequestId,
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
                const directorEodDetails = await this.regTankApiClient.getEntityOnboardingDetails(existingDirector.eodRequestId);
                directorKycId = directorEodDetails.kycRequestInfo?.kycId;
              } catch (eodError) {
                logger.warn(
                  {
                    error: eodError instanceof Error ? eodError.message : String(eodError),
                    eodRequestId: existingDirector.eodRequestId,
                    codRequestId,
                  },
                  "Failed to fetch director EOD details for kycId check (non-blocking)"
                );
              }
            }

            // Fetch shareholder EOD details
            if (shareholderEodRequestId) {
              try {
                const shareholderEodDetails = await this.regTankApiClient.getEntityOnboardingDetails(shareholderEodRequestId);
                shareholderKycId = shareholderEodDetails.kycRequestInfo?.kycId;
              } catch (eodError) {
                logger.warn(
                  {
                    error: eodError instanceof Error ? eodError.message : String(eodError),
                    eodRequestId: shareholderEodRequestId,
                    codRequestId,
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
              if (kycId && !existingDirector.kycId) {
                existingDirector.kycId = kycId;
              }
            }

            // Update KYC status if shareholder has a more recent or different status
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

            if (!existingDirector.governmentIdNumber && shareholderGovernmentId) {
              existingDirector.governmentIdNumber = shareholderGovernmentId;
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
              governmentIdNumber: shareholderGovernmentId,
              lastUpdated: new Date().toISOString(),
            });
          }
        }
      }

      // Convert Map to Array
      const directors = Array.from(directorsMap.values());

      // Update organization with refreshed director KYC statuses
      const directorKycStatus = {
        corpIndvDirectorCount: codDetails.corpIndvDirectorCount || 0,
        corpIndvShareholderCount: codDetails.corpIndvShareholderCount || 0,
        corpBizShareholderCount: codDetails.corpBizShareholderCount || 0,
        directors,
        lastSyncedAt: new Date().toISOString(),
      };

      // Refresh corporate shareholders status from COD details
      let corporateEntitiesUpdated = false;
      let updatedCorporateEntities: Record<string, unknown> | null = null;
      const existingOrg = isInvestor
        ? await prisma.investorOrganization.findUnique({
          where: { id: org.id },
          select: { corporate_entities: true },
        })
        : await prisma.issuerOrganization.findUnique({
          where: { id: org.id },
          select: { corporate_entities: true },
        });

      if (existingOrg && codDetails.corpBizShareholders) {
        const corporateEntities = (existingOrg.corporate_entities as Record<string, unknown>) || {
          directors: [],
          shareholders: [],
          corporateShareholders: [],
        };
        let updated = false;

        // Update corporate shareholders with latest status from COD details
        if (corporateEntities.corporateShareholders && Array.isArray(corporateEntities.corporateShareholders)) {
          const codCorpShareholders = codDetails.corpBizShareholders as Record<string, unknown>[];

          // Create a map of existing corporate shareholders by COD requestId or company name
          const existingMap = new Map<string, Record<string, unknown>>();
          for (const existing of corporateEntities.corporateShareholders) {
            const key =
              existing.corporateOnboardingRequest?.requestId ||
              existing.requestId ||
              existing.name ||
              "";
            if (key) {
              existingMap.set(key, existing);
            }
          }

          // Update existing corporate shareholders with latest status from COD details
          for (const codShareholder of codCorpShareholders) {
            const codCorpReq = codShareholder.corporateOnboardingRequest as Record<string, unknown> | undefined;
            const codRequestId =
              (codCorpReq?.requestId as string) ||
              (codShareholder.requestId as string) ||
              "";
            const codName = (codShareholder.name as string) || (codShareholder.businessName as string) || "";
            const key = codRequestId || codName;

            if (key) {
              const existing = existingMap.get(key);
              if (existing) {
                // Update status and other fields from COD details
                const updatedShareholder = {
                  ...existing,
                  ...codShareholder,
                  // Preserve fields we want to keep from existing
                  lastUpdated: new Date().toISOString(),
                };

                // Replace in array
                const index = (corporateEntities.corporateShareholders as Record<string, unknown>[]).findIndex(
                  (s: Record<string, unknown>) =>
                    (((s.corporateOnboardingRequest as Record<string, unknown>)?.requestId as string) || (s.requestId as string) || (s.name as string) || "") === key
                );
                if (index !== -1) {
                  (corporateEntities.corporateShareholders as Record<string, unknown>[])[index] = updatedShareholder;
                  updated = true;
                  logger.debug(
                    {
                      codRequestId,
                      name: codName,
                      status:
                        (codShareholder.status as string) ||
                        (codCorpReq?.status as string),
                    },
                    "[Admin Refresh] Updated corporate shareholder status from COD details"
                  );
                }
              } else {
                // New corporate shareholder - add it
                (corporateEntities.corporateShareholders as Record<string, unknown>[]).push({
                  ...codShareholder,
                  lastUpdated: new Date().toISOString(),
                });
                updated = true;
                logger.debug(
                  {
                    codRequestId,
                    name: codName,
                  },
                  "[Admin Refresh] Added new corporate shareholder from COD details"
                );
              }
            }
          }
        } else if (
          codDetails.corpBizShareholders &&
          Array.isArray(codDetails.corpBizShareholders) &&
          codDetails.corpBizShareholders.length > 0
        ) {
          // No existing corporate shareholders, but COD has them - initialize the array
          corporateEntities.corporateShareholders = (codDetails.corpBizShareholders as Record<string, unknown>[]).map(
            (corpShareholder: Record<string, unknown>) => ({
              ...corpShareholder,
              lastUpdated: new Date().toISOString(),
            })
          );
          updated = true;
          logger.debug(
            {
              count: codDetails.corpBizShareholders.length,
            },
            "[Admin Refresh] Initialized corporate shareholders array from COD details"
          );
        }

        if (updated) {
          corporateEntitiesUpdated = true;
          updatedCorporateEntities = corporateEntities;
        }

        // If organization is in PENDING_AML stage, fetch/refresh all AML statuses using AMLFetcherService
        if (org.onboarding_status === "PENDING_AML") {
          try {
            logger.info(
              { codRequestId, organizationId: org.id },
              "[Admin Refresh] Fetching all AML statuses using AMLFetcherService"
            );

            const amlFetcher = new AMLFetcherService();
            await amlFetcher.fetchAllAMLStatuses(codRequestId, org.id, onboarding.portal_type as PortalType);

            logger.info(
              { codRequestId, organizationId: org.id },
              "[Admin Refresh] ✓ Completed fetching all AML statuses"
            );
          } catch (amlError) {
            logger.warn(
              {
                error: amlError instanceof Error ? amlError.message : String(amlError),
                codRequestId,
                organizationId: org.id,
              },
              "[Admin Refresh] Failed to fetch AML statuses (non-blocking)"
            );
          }
        }
      }

      // Update organization with refreshed director KYC statuses and corporate entities
      const updateData: {
        director_kyc_status: Prisma.InputJsonValue;
        corporate_entities?: Prisma.InputJsonValue;
      } = {
        director_kyc_status: directorKycStatus as Prisma.InputJsonValue,
      };

      if (corporateEntitiesUpdated && updatedCorporateEntities) {
        updateData.corporate_entities = updatedCorporateEntities as Prisma.InputJsonValue;
      }

      if (isInvestor) {
        await prisma.investorOrganization.update({
          where: { id: org.id },
          data: updateData,
        });
      } else {
        await prisma.issuerOrganization.update({
          where: { id: org.id },
          data: updateData,
        });
      }

      logger.info(
        {
          onboardingId,
          codRequestId,
          organizationId: org.id,
          adminUserId,
          directorsUpdated: directors.length,
          corporateShareholdersUpdated: corporateEntitiesUpdated,
        },
        "Refreshed corporate onboarding director KYC statuses and corporate shareholders"
      );

      return {
        success: true,
        message: `Successfully refreshed ${directors.length} director KYC status${directors.length !== 1 ? "es" : ""}${corporateEntitiesUpdated ? " and corporate shareholders status" : ""}.`,
        directorsUpdated: directors.length,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          onboardingId,
          codRequestId,
          organizationId: org.id,
          adminUserId,
        },
        "Failed to refresh corporate onboarding status"
      );
      throw new AppError(
        500,
        "REFRESH_FAILED",
        `Failed to refresh corporate onboarding status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Refresh corporate AML status for all directors, shareholders, and business shareholders
   * Uses AMLFetcherService to fetch latest AML statuses from RegTank
   */
  async refreshCorporateAmlStatus(
    _req: Request,
    onboardingId: string,
    adminUserId: string
  ): Promise<{ success: true; message: string; directorsUpdated: number }> {
    // Get the onboarding record
    const onboarding = await prisma.regTankOnboarding.findUnique({
      where: { id: onboardingId },
      include: {
        investor_organization: true,
        issuer_organization: true,
        user: {
          select: {
            user_id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!onboarding) {
      throw new AppError(404, "NOT_FOUND", "Onboarding record not found");
    }

    // Only applicable for corporate onboarding
    if (onboarding.onboarding_type !== "CORPORATE") {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Refresh corporate AML status is only applicable for corporate onboarding"
      );
    }

    const isInvestor = onboarding.portal_type === "investor";
    const org = isInvestor ? onboarding.investor_organization : onboarding.issuer_organization;

    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    const codRequestId = onboarding.request_id;
    const portalType = onboarding.portal_type as PortalType;

    try {
      logger.info(
        { onboardingId, organizationId: org.id, adminUserId, codRequestId },
        "Refreshing corporate AML statuses using AMLFetcherService"
      );

      // Use AMLFetcherService to fetch all AML statuses
      const amlFetcher = new AMLFetcherService();
      await amlFetcher.fetchAllAMLStatuses(codRequestId, org.id, portalType);

      // Get updated director_aml_status to count directors
      const updatedOrg = isInvestor
        ? await prisma.investorOrganization.findUnique({
          where: { id: org.id },
          select: { director_aml_status: true },
        })
        : await prisma.issuerOrganization.findUnique({
          where: { id: org.id },
          select: { director_aml_status: true },
        });

      const directorAmlStatus = (updatedOrg?.director_aml_status as Record<string, unknown>) || { directors: [] };
      const directorsCount = Array.isArray(directorAmlStatus.directors) ? directorAmlStatus.directors.length : 0;

      logger.info(
        {
          onboardingId,
          organizationId: org.id,
          adminUserId,
          directorsUpdated: directorsCount,
        },
        "Refreshed corporate AML statuses"
      );

      return {
        success: true,
        message: `Successfully refreshed ${directorsCount} director AML status${directorsCount !== 1 ? "es" : ""}.`,
        directorsUpdated: directorsCount,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          onboardingId,
          organizationId: org.id,
          adminUserId,
        },
        "Failed to refresh corporate AML status"
      );
      throw new AppError(
        500,
        "REFRESH_FAILED",
        `Failed to refresh corporate AML status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * List all financing applications with pagination and filters
   */
  async listApplications(params: GetAdminApplicationsQuery): Promise<{
    applications: {
      id: string;
      issuerOrganizationName: string | null;
      financingTypeLabel: string;
      requestedAmount: number;
      status: string;
      submittedAt: Date | null;
      updatedAt: Date;
    }[];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const repository = new AdminRepository();
    const { applications, total } = await repository.getApplications(params);

    return {
      applications,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount: total,
        totalPages: Math.ceil(total / params.pageSize),
      },
    };
  }

  /**
   * List all contracts with pagination and filters
   */
  async listContracts(params: GetAdminContractsQuery): Promise<{
    contracts: {
      id: string;
      contractNumber: string | null;
      title: string | null;
      issuerOrganizationName: string | null;
      contractValue: number;
      status: string;
      updatedAt: Date;
    }[];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const repository = new AdminRepository();
    const { contracts, total } = await repository.getContracts(params);

    return {
      contracts,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount: total,
        totalPages: Math.ceil(total / params.pageSize),
      },
    };
  }

  async getContractDetail(id: string) {
    const repository = new AdminRepository();
    const contract = await repository.getContractById(id);
    if (!contract) {
      throw new AppError(404, "NOT_FOUND", "Contract not found");
    }
    return contract;
  }

  /**
   * Get financing application detail by ID
   */
  async getApplicationDetail(id: string) {
    const repository = new AdminRepository();
    const application = await repository.getApplicationById(id);
    if (!application) {
      throw new AppError(404, "NOT_FOUND", "Application not found");
    }
    const sectionPolicy = await this.getReviewSectionPolicy(application);
    const orderedRequiredSections = REVIEW_SECTION_ORDER.filter((section) =>
      sectionPolicy.requiredSections.has(section)
    );
    const orderedVisibleSections = REVIEW_SECTION_ORDER.filter((section) =>
      sectionPolicy.visibleSections.has(section)
    );
    return {
      ...application,
      required_review_sections: orderedRequiredSections,
      visible_review_sections: orderedVisibleSections,
      review_section_prerequisites: sectionPolicy.prerequisitesBySection,
    };
  }

  /**
   * Full JSON snapshots for before/after resubmit comparison (admin).
   * `reviewCycle` is the cycle stored on APPLICATION_RESUBMITTED logs (the new cycle after resubmit).
   */
  async getResubmitComparisonSnapshots(applicationId: string, nextReviewCycle: number) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });
    if (!application) {
      throw new AppError(404, "NOT_FOUND", "Application not found");
    }

    const prevCycle = nextReviewCycle - 1;

    const [nextRev, prevRev] = await Promise.all([
      prisma.applicationRevision.findFirst({
        where: { application_id: applicationId, review_cycle: nextReviewCycle },
      }),
      prisma.applicationRevision.findFirst({
        where: { application_id: applicationId, review_cycle: prevCycle },
      }),
    ]);

    if (!nextRev) {
      throw new AppError(
        404,
        "NOT_FOUND",
        "Revision snapshot not found for this review cycle"
      );
    }
    if (!prevRev) {
      throw new AppError(404, "NOT_FOUND", "Previous revision snapshot not found");
    }

    console.log("[admin] getResubmitComparisonSnapshots", {
      applicationId,
      previous_review_cycle: prevCycle,
      next_review_cycle: nextReviewCycle,
    });

    const resubmitLog = await prisma.applicationLog.findFirst({
      where: {
        application_id: applicationId,
        event_type: "APPLICATION_RESUBMITTED",
        review_cycle: nextReviewCycle,
      },
      orderBy: { created_at: "desc" },
      select: { metadata: true },
    });

    const meta = resubmitLog?.metadata;
    let amendment_remarks: ResubmitComparisonAmendmentRemark[] | undefined;
    if (isPlainObjectRecord(meta)) {
      const raw = meta.amendment_remarks;
      if (Array.isArray(raw)) {
        const parsed: ResubmitComparisonAmendmentRemark[] = [];
        for (const item of raw) {
          if (!isPlainObjectRecord(item)) continue;
          const remark = typeof item.remark === "string" ? item.remark : "";
          if (remark.length === 0) continue;
          parsed.push({
            scope: typeof item.scope === "string" ? item.scope : "",
            scope_key: typeof item.scope_key === "string" ? item.scope_key : "",
            remark,
            author_user_id: typeof item.author_user_id === "string" ? item.author_user_id : "",
            submitted_at:
              item.submitted_at === null
                ? null
                : typeof item.submitted_at === "string"
                  ? item.submitted_at
                  : null,
          });
        }
        amendment_remarks = parsed.length > 0 ? parsed : undefined;
      }
    }

    return {
      previous_review_cycle: prevCycle,
      next_review_cycle: nextReviewCycle,
      previous_snapshot: prevRev.snapshot as Prisma.JsonValue,
      next_snapshot: nextRev.snapshot as Prisma.JsonValue,
      previous_submitted_at: prevRev.submitted_at.toISOString(),
      next_submitted_at: nextRev.submitted_at.toISOString(),
      amendment_remarks,
    };
  }

  private assertSignedOfferLetterS3KeyFromJson(offerSigning: unknown): string {
    if (!offerSigning || typeof offerSigning !== "object" || Array.isArray(offerSigning)) {
      throw new AppError(400, "INVALID_STATE", "No signed offer letter on file");
    }
    const os = offerSigning as Record<string, unknown>;
    if (os.status !== "signed") {
      throw new AppError(400, "INVALID_STATE", "Offer letter is not signed yet");
    }
    const key = os.signed_offer_letter_s3_key;
    if (typeof key !== "string" || !key.trim()) {
      throw new AppError(400, "INVALID_STATE", "Signed offer letter is not available");
    }
    return key.trim();
  }

  /**
   * Signed invoice offer letter PDF (admin). Does not require issuer org membership.
   */
  async getSignedInvoiceOfferLetterPdfForAdmin(applicationId: string, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, application_id: applicationId },
      select: { id: true, offer_signing: true },
    });
    if (!invoice) {
      throw new AppError(404, "NOT_FOUND", "Invoice not found");
    }
    const s3Key = this.assertSignedOfferLetterS3KeyFromJson(invoice.offer_signing);
    const buffer = await getS3ObjectBuffer(s3Key);
    return { buffer, filename: `signed-invoice-offer-${invoice.id}.pdf` };
  }

  /**
   * Signed contract offer letter PDF (admin). Does not require issuer org membership.
   */
  async getSignedContractOfferLetterPdfForAdmin(applicationId: string) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { contract_id: true },
    });
    if (!application?.contract_id) {
      throw new AppError(400, "INVALID_STATE", "Application has no contract");
    }
    const contract = await prisma.contract.findUnique({
      where: { id: application.contract_id },
      select: { id: true, offer_signing: true },
    });
    if (!contract) {
      throw new AppError(404, "NOT_FOUND", "Contract not found");
    }
    const s3Key = this.assertSignedOfferLetterS3KeyFromJson(contract.offer_signing);
    const buffer = await getS3ObjectBuffer(s3Key);
    return { buffer, filename: `signed-contract-offer-${contract.id}.pdf` };
  }

  /**
   * Update AR financing application status.
   * Restricts transitions to explicit admin review actions.
   */
  async updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
    userId: string,
    logContext?: AdminLogContext
  ) {
    const repository = new AdminRepository();
    const application = await repository.getApplicationById(id);
    if (!application) {
      throw new AppError(404, "NOT_FOUND", "Application not found");
    }

    const currentStatus = application.status as ApplicationStatus;
    const allowedTargets = new Set<ApplicationStatus>([
      ApplicationStatus.UNDER_REVIEW,
      ApplicationStatus.APPROVED,
      ApplicationStatus.REJECTED,
    ]);
    if (!allowedTargets.has(status)) {
      throw new AppError(
        400,
        "INVALID_STATE",
        `Unsupported admin status transition target: ${status}`
      );
    }

    if (status === ApplicationStatus.APPROVED || status === ApplicationStatus.REJECTED) {
      if (!this.isFinalizable(currentStatus)) {
        throw new AppError(
          400,
          "INVALID_STATE",
          "Application must be in an active review state before final decision"
        );
      }
    }

    if (status === ApplicationStatus.UNDER_REVIEW) {
      if (currentStatus !== ApplicationStatus.AMENDMENT_REQUESTED) {
        const correctionGuidance =
          currentStatus === ApplicationStatus.APPROVED || currentStatus === ApplicationStatus.REJECTED
            ? ` ${this.getCorrectionFlowGuidance()}`
            : "";
        throw new AppError(
          400,
          "INVALID_STATE",
          `Reset to UNDER_REVIEW is only allowed from AMENDMENT_REQUESTED.${correctionGuidance}`
        );
      }
    }

    if (status === ApplicationStatus.APPROVED) {
      const reviews = (application.application_reviews ?? []) as { section: string; status: string }[];
      const sectionPolicy = await this.getReviewSectionPolicy(application);
      const reviewStatusBySection = new Map<string, string>();
      for (const review of reviews) {
        reviewStatusBySection.set(review.section, review.status);
      }
      const notApprovedSections = Array.from(sectionPolicy.requiredSections).filter(
        (section) => reviewStatusBySection.get(section) !== "APPROVED"
      );
      if (notApprovedSections.length > 0) {
        throw new AppError(
          400,
          "INVALID_STATE",
          `All required review sections must be approved before final approval. Pending: ${notApprovedSections.join(", ")}`
        );
      }
    }

    const updatedApplication = await repository.updateApplicationStatus(id, status);

    if (status === ApplicationStatus.UNDER_REVIEW) {
      await logApplicationActivity({
        userId,
        applicationId: id,
        portal: ActivityPortal.ADMIN,
        eventType: "APPLICATION_RESET_TO_UNDER_REVIEW",
        metadata: { previous_status: currentStatus },
        ipAddress: logContext?.ipAddress ?? undefined,
        userAgent: logContext?.userAgent ?? undefined,
        deviceInfo: logContext?.deviceInfo ?? undefined,
      });
    } else if (status === ApplicationStatus.APPROVED) {
      await logApplicationActivity({
        userId,
        applicationId: id,
        portal: ActivityPortal.ADMIN,
        eventType: "APPLICATION_APPROVED",
        ipAddress: logContext?.ipAddress ?? undefined,
        userAgent: logContext?.userAgent ?? undefined,
        deviceInfo: logContext?.deviceInfo ?? undefined,
      });
    } else if (status === ApplicationStatus.REJECTED) {
      await logApplicationActivity({
        userId,
        applicationId: id,
        portal: ActivityPortal.ADMIN,
        eventType: "APPLICATION_REJECTED",
        ipAddress: logContext?.ipAddress ?? undefined,
        userAgent: logContext?.userAgent ?? undefined,
        deviceInfo: logContext?.deviceInfo ?? undefined,
      });
    }

    if (status === ApplicationStatus.APPROVED || status === ApplicationStatus.REJECTED) {
      try {
        const typeId =
          status === ApplicationStatus.APPROVED
            ? NotificationTypeIds.APPLICATION_APPROVED
            : NotificationTypeIds.APPLICATION_REJECTED;
        await this.sendIssuerNotification(
          id,
          typeId,
          { applicationId: id },
          `${status.toLowerCase()}`
        );
      } catch (notificationError) {
        logger.error(
          { error: notificationError, applicationId: id, status },
          "Failed to send issuer application status notification"
        );
      }
    }

    logger.info(
      { applicationId: id, newStatus: status },
      "AR financing application status updated by admin"
    );

    return updatedApplication;
  }

  private static readonly REVIEWABLE_STATUSES: ApplicationStatus[] = [
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.UNDER_REVIEW,
    ApplicationStatus.CONTRACT_PENDING,
    ApplicationStatus.CONTRACT_SENT,
    ApplicationStatus.CONTRACT_ACCEPTED,
    ApplicationStatus.INVOICE_PENDING,
    ApplicationStatus.INVOICES_SENT,
    ApplicationStatus.RESUBMITTED,
    ApplicationStatus.AMENDMENT_REQUESTED,
  ];

  private isReviewable(status: ApplicationStatus): boolean {
    return AdminService.REVIEWABLE_STATUSES.includes(status);
  }

  private isFinalizable(status: ApplicationStatus): boolean {
    return this.isReviewable(status);
  }

  private getCorrectionFlowGuidance(): string {
    return "Terminal corrections must use a dedicated audited correction flow";
  }

  /**
   * Transition application to UNDER_REVIEW on first review action (when SUBMITTED or RESUBMITTED)
   */
  private allInvoicesOfferableOrResolved(invoiceStatuses: string[]): boolean {
    if (invoiceStatuses.length === 0) return false;
    return invoiceStatuses.every((status) =>
      ["OFFER_SENT", "APPROVED", "WITHDRAWN", "REJECTED"].includes(status)
    );
  }

  private isContractTabUnlocked(
    application: { application_reviews?: { section: string; status: string }[] },
    sectionPolicy: { visibleSections: Set<ReviewSection>; prerequisitesBySection: Partial<Record<ReviewSection, ReviewSection[]>> }
  ): boolean {
    const prereqs = sectionPolicy.prerequisitesBySection.contract_details;
    if (!prereqs?.length) return true;
    const relevantPrereqs = prereqs.filter((p) => sectionPolicy.visibleSections.has(p));
    if (!relevantPrereqs.length) return true;
    const reviews = (application.application_reviews ?? []) as { section: string; status: string }[];
    const sectionStatusMap = new Map(reviews.map((r) => [r.section, r.status]));
    return relevantPrereqs.every((prereq) => sectionStatusMap.get(prereq) === "APPROVED");
  }

  private isInvoiceTabUnlocked(
    application: { application_reviews?: { section: string; status: string }[] },
    sectionPolicy: { visibleSections: Set<ReviewSection>; prerequisitesBySection: Partial<Record<ReviewSection, ReviewSection[]>> }
  ): boolean {
    const prereqs = sectionPolicy.prerequisitesBySection.invoice_details;
    if (!prereqs?.length) return true;
    const relevantPrereqs = prereqs.filter((p) => sectionPolicy.visibleSections.has(p));
    if (!relevantPrereqs.length) return true;
    const reviews = (application.application_reviews ?? []) as { section: string; status: string }[];
    const sectionStatusMap = new Map(reviews.map((r) => [r.section, r.status]));
    return relevantPrereqs.every((prereq) => sectionStatusMap.get(prereq) === "APPROVED");
  }

  private resolveAdminStageStatus(input: {
    contractId?: string | null;
    contractStatus?: string | null;
    invoiceStatuses: string[];
    isContractTabUnlocked?: boolean;
    isInvoiceTabUnlocked?: boolean;
    isInvoiceOnly?: boolean;
  }): ApplicationStatus {
    const {
      contractId,
      contractStatus,
      invoiceStatuses,
      isContractTabUnlocked,
      isInvoiceTabUnlocked,
      isInvoiceOnly,
    } = input;

    if (contractId && !isInvoiceOnly) {
      if (contractStatus === "OFFER_SENT") return ApplicationStatus.CONTRACT_SENT;
      if (contractStatus === "APPROVED") {
        if (invoiceStatuses.length === 0) return ApplicationStatus.COMPLETED;
        if (this.allInvoicesOfferableOrResolved(invoiceStatuses)) {
          return ApplicationStatus.INVOICES_SENT;
        }
        if (!isInvoiceTabUnlocked) return ApplicationStatus.CONTRACT_ACCEPTED;
        return ApplicationStatus.INVOICE_PENDING;
      }
      if (isContractTabUnlocked) return ApplicationStatus.CONTRACT_PENDING;
      return ApplicationStatus.UNDER_REVIEW;
    }

    if (this.allInvoicesOfferableOrResolved(invoiceStatuses)) {
      return ApplicationStatus.INVOICES_SENT;
    }
    if (!isInvoiceTabUnlocked) return ApplicationStatus.UNDER_REVIEW;
    return ApplicationStatus.INVOICE_PENDING;
  }

  private async ensureUnderReview(
    repository: AdminRepository,
    applicationId: string,
    appStatus: ApplicationStatus,
    application: {
      contract_id?: string | null;
      contract?: { status?: string } | null;
      invoices?: { status?: string }[];
      application_reviews?: { section: string; status: string }[];
      financing_type?: unknown;
      financing_structure?: unknown;
    }
  ) {
    if (appStatus === ApplicationStatus.SUBMITTED || appStatus === ApplicationStatus.RESUBMITTED) {
      const structure = application.financing_structure as { structure_type?: string } | null | undefined;
      const isInvoiceOnly = structure?.structure_type === "invoice_only";
      const sectionPolicy = await this.getReviewSectionPolicy(application);
      const isContractTabUnlocked =
        application.contract_id != null
          ? this.isContractTabUnlocked(application, sectionPolicy)
          : false;
      const isInvoiceTabUnlocked = this.isInvoiceTabUnlocked(application, sectionPolicy);
      const targetStatus = this.resolveAdminStageStatus({
        contractId: application.contract_id,
        contractStatus: application.contract?.status ?? null,
        invoiceStatuses: (application.invoices ?? []).map((inv) => (inv as { status?: string }).status ?? "DRAFT"),
        isContractTabUnlocked,
        isInvoiceTabUnlocked,
        isInvoiceOnly,
      });
      await repository.updateApplicationStatus(applicationId, targetStatus);
    }
  }

  /**
   * Resolve scope_key (e.g. invoice_details:0:INV-001) to the actual invoice database id.
   * Returns null if invalid.
   */
  private resolveInvoiceIdFromScopeKey(
    application: { invoices?: { id: string; details?: unknown }[] },
    itemId: string
  ): string | null {
    if (!itemId.startsWith("invoice_details:")) return null;
    const parts = itemId.split(":");
    if (parts.length < 3) return null;
    const idx = parseInt(parts[1], 10);
    if (!Number.isFinite(idx) || idx < 0) return null;
    const invoices = application.invoices ?? [];
    if (idx >= invoices.length) return null;
    const inv = invoices[idx];
    const details =
      inv?.details && typeof inv.details === "object"
        ? (inv.details as Record<string, unknown>)
        : null;
    const expectedNum = String(details?.number ?? idx + 1).replace(/:/g, "_");
    const keyNum = parts.slice(2).join(":").replace(/:/g, "_");
    if (expectedNum !== keyNum) return null;
    return inv?.id ?? null;
  }

  /**
   * Validate that an invoice item exists in the application.
   * Expects format invoice_details:<index>:<invoice_number>
   */
  private validateInvoiceExists(
    application: { invoices?: { id: string; details?: unknown }[] },
    itemId: string
  ): void {
    if (!this.resolveInvoiceIdFromScopeKey(application, itemId)) {
      throw new AppError(400, "INVALID_ITEM", `Invoice ${itemId} not found in this application`);
    }
  }

  /**
   * Validate that a document item exists in the application.
   * Expects format supporting_documents:<category>:<index>:<name>
   */
  private validateDocumentExists(
    application: { supporting_documents?: unknown },
    itemId: string
  ): void {
    const docs = application.supporting_documents;
    if (!docs || typeof docs !== "object") {
      throw new AppError(400, "INVALID_ITEM", "Application has no supporting documents");
    }
    if (!itemId.startsWith("supporting_documents:")) {
      throw new AppError(400, "INVALID_ITEM", `Invalid document item ID: ${itemId}`);
    }
    const docKeys = this.collectDocumentKeys(docs);
    if (!docKeys.has(itemId)) {
      throw new AppError(400, "INVALID_ITEM", `Document ${itemId} not found in this application`);
    }
  }

  /** Collect document keys from supporting_documents structure (matches frontend document-list). */
  private collectDocumentKeys(docs: unknown): Set<string> {
    const keys = new Set<string>();
    const raw = (docs as Record<string, unknown>)?.supporting_documents ?? docs;
    if (Array.isArray(raw)) {
      raw.forEach((d: Record<string, unknown>, i: number) => {
        const name = String(d?.name ?? d?.title ?? "document");
        const slug = name.replace(/[^a-z0-9]/gi, "_").slice(0, 32) || "doc";
        keys.add(`supporting_documents:others:${i}:${slug}`);
      });
      return keys;
    }
    if (typeof raw !== "object" || raw === null) return keys;
    const obj = raw as Record<string, unknown>;
    const categoryKeys = ["financial_docs", "legal_docs", "compliance_docs", "others"];
    for (const catKey of categoryKeys) {
      const val = obj[catKey];
      if (val == null) continue;
      const arr = Array.isArray(val) ? val : [val];
      arr.forEach((d: Record<string, unknown>, i: number) => {
        const name = String(d?.name ?? d?.title ?? "doc");
        const slug = name.replace(/[^a-z0-9]/gi, "_").slice(0, 32) || "doc";
        keys.add(`supporting_documents:${catKey}:${i}:${slug}`);
      });
    }
    const cats = obj.categories;
    const labelToKey: Record<string, string> = {
      "Financial Docs": "financial_docs",
      "Legal Docs": "legal_docs",
      "Compliance Docs": "compliance_docs",
      Others: "others",
    };
    if (Array.isArray(cats)) {
      cats.forEach((cat: Record<string, unknown>, catIndex: number) => {
        const categoryLabel = String(cat?.name ?? `Category ${catIndex + 1}`);
        const categoryKey = labelToKey[categoryLabel] ?? `cat_${catIndex}`;
        const docList = Array.isArray(cat?.documents) ? cat.documents : [];
        docList.forEach((d: Record<string, unknown>, docIndex: number) => {
          const files = Array.isArray(d?.files) ? (d.files as Array<{ file_name?: string }>) : [];
          const file = (d?.file as { file_name?: string } | undefined) ?? files[0];
          const label =
            String(d?.title ?? file?.file_name ?? d?.name ?? "").trim() || `Document ${docIndex + 1}`;
          const slug = label.replace(/[^a-z0-9]/gi, "_").slice(0, 32) || "doc";
          keys.add(`supporting_documents:${categoryKey}:${docIndex}:${slug}`);
        });
      });
    }
    return keys;
  }

  /**
   * Validate that a review item exists in the application
   */
  private validateReviewItemExists(
    application: { invoices?: { id: string }[]; supporting_documents?: unknown },
    itemType: "invoice" | "document",
    itemId: string
  ): void {
    if (itemType === "invoice") {
      this.validateInvoiceExists(application as { invoices: { id: string }[] }, itemId);
    } else {
      this.validateDocumentExists(application as { supporting_documents?: unknown }, itemId);
    }
  }

  /**
   * Updates supporting_documents section row from document item rows and logs SECTION_* when it changes.
   */
  private async syncSupportingDocumentsSectionFromItems(
    repository: AdminRepository,
    applicationId: string,
    application: {
      supporting_documents?: unknown;
      application_reviews?: { section: string; status: string }[];
      application_review_items?: { item_type: string; item_id: string; status: string }[];
    },
    reviewerUserId: string,
    logContext?: AdminLogContext
  ): Promise<void> {
    const docs = application.supporting_documents;
    if (!docs || typeof docs !== "object") {
      return;
    }
    const docKeys = [...this.collectDocumentKeys(docs)];
    if (docKeys.length === 0) {
      return;
    }

    const documentRows =
      application.application_review_items?.filter((r) => r.item_type === "document") ?? [];
    const target = computeSupportingDocumentsSectionStatus(
      docKeys,
      documentRows.map((r) => ({ item_id: r.item_id, status: r.status }))
    );

    const existing = application.application_reviews?.find((r) => r.section === "supporting_documents");
    const current = existing?.status ?? "PENDING";

    if (target === current) {
      return;
    }

    await repository.ensureApplicationReviewSection(applicationId, "supporting_documents");
    await repository.updateSectionReviewStatus(
      applicationId,
      "supporting_documents",
      target,
      reviewerUserId
    );

    await this.logReviewActivity(
      applicationId,
      "section",
      "supporting_documents",
      current,
      target,
      reviewerUserId,
      null,
      logContext
    );

    if (target === "APPROVED") {
      await repository.removeDraftAmendment(applicationId, "section", "supporting_documents");
    }
  }

  private collectInvoiceScopeKeys(application: {
    invoices?: { id: string; details?: unknown }[];
  }): string[] {
    const invoices = application.invoices ?? [];
    return invoices.map((invoice, idx) => {
      const details = invoice.details as { number?: string | number } | null | undefined;
      const invoiceNo = details?.number ?? idx + 1;
      const sanitized = String(invoiceNo).replace(/:/g, "_");
      return `invoice_details:${idx}:${sanitized}`;
    });
  }

  /**
   * Updates invoice_details section row from per-invoice review items and logs SECTION_* when it changes.
   */
  private async syncInvoiceDetailsSectionFromItems(
    repository: AdminRepository,
    applicationId: string,
    application: {
      invoices?: { id: string; details?: unknown }[];
      application_reviews?: { section: string; status: string }[];
      application_review_items?: { item_type: string; item_id: string; status: string }[];
    },
    reviewerUserId: string,
    logContext?: AdminLogContext
  ): Promise<void> {
    const invoiceKeys = this.collectInvoiceScopeKeys(application);
    if (invoiceKeys.length === 0) {
      return;
    }

    const invoiceRows =
      application.application_review_items?.filter((r) => r.item_type === "invoice") ?? [];
    const target = computeInvoiceDetailsSectionStatus(
      invoiceKeys,
      invoiceRows.map((r) => ({ item_id: r.item_id, status: r.status }))
    );

    const existing = application.application_reviews?.find((r) => r.section === "invoice_details");
    const current = existing?.status ?? "PENDING";

    if (target === current) {
      return;
    }

    await repository.ensureApplicationReviewSection(applicationId, "invoice_details");
    await repository.updateSectionReviewStatus(
      applicationId,
      "invoice_details",
      target,
      reviewerUserId
    );

    await this.logReviewActivity(
      applicationId,
      "section",
      "invoice_details",
      current,
      target,
      reviewerUserId,
      null,
      logContext
    );

    if (target === "APPROVED") {
      await repository.removeDraftAmendment(applicationId, "section", "invoice_details");
    }
  }

  private async logReviewActivity(
    applicationId: string,
    scope: "section" | "item",
    scopeKey: string,
    oldStatus: string | null,
    newStatus: string,
    reviewerUserId: string | null,
    remark: string | null,
    logContext?: AdminLogContext
  ): Promise<void> {
    if (!reviewerUserId) return;
    const isSection = scope === "section";
    const eventType = isSection ? `SECTION_REVIEWED_${newStatus}` : `ITEM_REVIEWED_${newStatus}`;

    await logApplicationActivity({
      userId: reviewerUserId,
      applicationId,
      eventType,
      remark: remark ?? undefined,
      entityId: isSection ? undefined : scopeKey,
      portal: ActivityPortal.ADMIN,
      metadata: { old_status: oldStatus, new_status: newStatus, scope, scope_key: scopeKey },
      ipAddress: logContext?.ipAddress ?? undefined,
      userAgent: logContext?.userAgent ?? undefined,
      deviceInfo: logContext?.deviceInfo ?? undefined,
    });
  }

  /**
   * Load application and validate it is in a reviewable state. Shared by all review actions.
   */
  private async prepareForReviewAction(applicationId: string): Promise<{
    repository: AdminRepository;
    application: NonNullable<Awaited<ReturnType<AdminRepository["getApplicationById"]>>>;
  }> {
    const repository = new AdminRepository();
    const application = await repository.getApplicationById(applicationId);
    if (!application) {
      throw new AppError(404, "NOT_FOUND", "Application not found");
    }
    if (!this.isReviewable(application.status as ApplicationStatus)) {
      throw new AppError(400, "INVALID_STATE", "Application is not in a reviewable state");
    }
    return { repository, application };
  }

  /**
   * Load application for comment actions. Comments are allowed in any state (not just reviewable).
   */
  private async loadApplicationForComment(applicationId: string): Promise<{
    repository: AdminRepository;
    application: NonNullable<Awaited<ReturnType<AdminRepository["getApplicationById"]>>>;
  }> {
    const repository = new AdminRepository();
    const application = await repository.getApplicationById(applicationId);
    if (!application) {
      throw new AppError(404, "NOT_FOUND", "Application not found");
    }
    return { repository, application };
  }

  private resolveInvoiceScopeKeyById(
    application: { invoices?: { id: string; details?: { number?: string | number } }[] },
    invoiceId: string
  ): string | null {
    const invoices = application.invoices ?? [];
    const idx = invoices.findIndex((invoice) => invoice.id === invoiceId);
    if (idx < 0) return null;
    const invoiceNo = invoices[idx]?.details?.number ?? idx + 1;
    const sanitized = String(invoiceNo).replace(/:/g, "_");
    return `invoice_details:${idx}:${sanitized}`;
  }

  async sendContractOffer(
    applicationId: string,
    offeredFacility: number,
    expiresAt: string | null,
    reviewerUserId: string,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application
    );
    this.ensureContractOfferActionAllowed(application);

    if (!application.contract_id) {
      throw new AppError(400, "INVALID_STATE", "Application has no contract to offer");
    }

    const contractId = application.contract_id;
    const contractOfferMeta = await prisma.$transaction(async (tx) => {
      const lockedApplications = await tx.$queryRaw<{ status: string }[]>`
        SELECT status
        FROM applications
        WHERE id = ${applicationId}
        FOR UPDATE
      `;
      const lockedApplication = lockedApplications[0];
      if (!lockedApplication) {
        throw new AppError(404, "NOT_FOUND", "Application not found");
      }
      if (!this.isReviewable(lockedApplication.status as ApplicationStatus)) {
        throw new AppError(400, "INVALID_STATE", "Application is not in a reviewable state");
      }

      const lockedContracts = await tx.$queryRaw<
        { status: string; contract_details: Prisma.JsonValue | null; offer_details: Prisma.JsonValue | null; updated_at: Date }[]
      >`
        SELECT status, contract_details, offer_details, updated_at
        FROM contracts
        WHERE id = ${contractId}
        FOR UPDATE
      `;
      const lockedContract = lockedContracts[0];
      if (!lockedContract) {
        throw new AppError(404, "NOT_FOUND", "Contract not found");
      }
      if (lockedContract.status === "APPROVED") {
        throw new AppError(
          400,
          "OFFER_FINALIZED",
          "Contract offer was finalized by issuer and cannot be modified"
        );
      }

      const contractDetails = (lockedContract.contract_details as Record<string, unknown> | null) ?? null;
      const requestedFacility = resolveRequestedFacility(contractDetails);
      if (!Number.isFinite(requestedFacility) || requestedFacility <= 0) {
        throw new AppError(400, "INVALID_STATE", "Contract requested facility is invalid");
      }
      if (offeredFacility > requestedFacility) {
        throw new AppError(
          400,
          "INVALID_INPUT",
          "Offered facility cannot be greater than requested facility"
        );
      }

      const previousOffer = (lockedContract.offer_details as Record<string, unknown> | null) ?? null;
      const previousVersion =
        typeof previousOffer?.version === "number" && Number.isFinite(previousOffer.version)
          ? previousOffer.version
          : 0;
      const now = new Date().toISOString();
      const offerDetails = {
        requested_facility: requestedFacility,
        offered_facility: offeredFacility,
        expires_at: expiresAt,
        sent_at: now,
        responded_at: null,
        sent_by_user_id: reviewerUserId,
        responded_by_user_id: null,
        version: previousVersion + 1,
      };

      const updateResult = await tx.contract.updateMany({
        where: { id: contractId, updated_at: lockedContract.updated_at },
        data: {
          status: "OFFER_SENT",
          offer_details: offerDetails,
        },
      });
      if (updateResult.count !== 1) {
        throw new AppError(
          409,
          "CONFLICT",
          "Contract was modified concurrently. Refresh and retry sending offer."
        );
      }

      await tx.applicationReview.upsert({
        where: {
          application_id_section: {
            application_id: applicationId,
            section: "contract_details",
          },
        },
        create: {
          application_id: applicationId,
          section: "contract_details",
          status: ReviewStepStatus.OFFER_SENT,
          reviewer_user_id: reviewerUserId,
          reviewed_at: new Date(),
        },
        update: {
          status: ReviewStepStatus.OFFER_SENT,
          reviewer_user_id: reviewerUserId,
          reviewed_at: new Date(),
        },
      });

      await tx.applicationReviewEvent.create({
        data: {
          application_id: applicationId,
          event_type: "CONTRACT_OFFER_SENT",
          scope: "section",
          scope_key: "contract_details",
          new_status: "OFFER_SENT",
          reviewer_user_id: reviewerUserId,
          remark: `Contract offer sent: ${offeredFacility}`,
        },
      });
      await tx.application.update({
        where: { id: applicationId },
        data: { status: ApplicationStatus.CONTRACT_SENT },
      });

      return {
        requestedFacility,
        previousVersion,
      };
    });

    await logApplicationActivity({
      userId: reviewerUserId,
      applicationId,
      portal: ActivityPortal.ADMIN,
      eventType: "CONTRACT_OFFER_SENT",
      metadata: {
        requested_facility: contractOfferMeta.requestedFacility,
        offered_facility: offeredFacility,
        expires_at: expiresAt,
        version: contractOfferMeta.previousVersion + 1,
      },
      ipAddress: logContext?.ipAddress ?? undefined,
      userAgent: logContext?.userAgent ?? undefined,
      deviceInfo: logContext?.deviceInfo ?? undefined,
    });

    try {
      await this.sendIssuerNotification(
        applicationId,
        NotificationTypeIds.CONTRACT_OFFER_SENT,
        {
          applicationId,
          offeredFacility,
          expiresAt,
        },
        `contract-offer-sent:${contractOfferMeta.previousVersion + 1}`
      );
    } catch (notificationError) {
      logger.error(
        { error: notificationError, applicationId, contractId },
        "Failed to send contract offer notification to issuer"
      );
    }

    return repository.getApplicationById(applicationId);
  }

  async sendInvoiceOffer(
    applicationId: string,
    invoiceId: string,
    offeredAmount: number,
    offeredRatioPercent: number | null,
    offeredProfitRatePercent: number | null,
    expiresAt: string | null,
    reviewerUserId: string,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application
    );

    const invoice = (application.invoices as { id: string; details?: Record<string, unknown> }[] | undefined)?.find(
      (row) => row.id === invoiceId
    );
    if (!invoice) {
      throw new AppError(404, "NOT_FOUND", "Invoice not found in this application");
    }

    const scopeKey = this.resolveInvoiceScopeKeyById(
      application as { invoices?: { id: string; details?: { number?: string | number } }[] },
      invoiceId
    );
    if (!scopeKey) {
      throw new AppError(400, "INVALID_STATE", "Unable to resolve invoice scope key");
    }
    await this.ensureInvoiceOfferItemActionAllowed(applicationId, scopeKey, application);

    const invoiceForSend = await prisma.invoice.findUnique({
      where: { id: invoiceId, application_id: applicationId },
      select: { status: true },
    });
    if (invoiceForSend?.status === "REJECTED") {
      throw new AppError(
        400,
        "INVALID_STATE",
        "Invoice was rejected; reset review to pending before sending an offer"
      );
    }

    const invoiceDetailsForMaturity = (invoice.details as Record<string, unknown> | null) ?? {};
    const productIdForMaturity = (application.financing_type as { product_id?: string } | null)?.product_id;
    if (productIdForMaturity) {
      const productForMaturity = await this.productRepository.findById(productIdForMaturity);
      if (productForMaturity?.workflow) {
        assertMaturityForSendInvoiceOffer(productForMaturity.workflow, invoiceDetailsForMaturity);
      }
    }

    const invoiceOfferMeta = await prisma.$transaction(async (tx) => {
      const lockedApplications = await tx.$queryRaw<{ status: string }[]>`
        SELECT status
        FROM applications
        WHERE id = ${applicationId}
        FOR UPDATE
      `;
      const lockedApplication = lockedApplications[0];
      if (!lockedApplication) {
        throw new AppError(404, "NOT_FOUND", "Application not found");
      }
      if (!this.isReviewable(lockedApplication.status as ApplicationStatus)) {
        throw new AppError(400, "INVALID_STATE", "Application is not in a reviewable state");
      }

      const lockedInvoices = await tx.$queryRaw<
        { status: string; details: Prisma.JsonValue | null; offer_details: Prisma.JsonValue | null; updated_at: Date }[]
      >`
        SELECT status, details, offer_details, updated_at
        FROM invoices
        WHERE id = ${invoiceId} AND application_id = ${applicationId}
        FOR UPDATE
      `;
      const lockedInvoice = lockedInvoices[0];
      if (!lockedInvoice) {
        throw new AppError(404, "NOT_FOUND", "Invoice not found");
      }
      if (lockedInvoice.status === "APPROVED") {
        throw new AppError(
          400,
          "OFFER_FINALIZED",
          "Invoice offer was finalized by issuer and cannot be modified"
        );
      }

      const details = (lockedInvoice.details as Record<string, unknown> | null) ?? {};
      const invoiceValue = Number(details.value);
      const requestedRatioPercent =
        typeof details.financing_ratio_percent === "number"
          ? details.financing_ratio_percent
          : Number(details.financing_ratio_percent ?? 0);
      if (!Number.isFinite(invoiceValue) || invoiceValue <= 0) {
        throw new AppError(400, "INVALID_STATE", "Invoice value is invalid");
      }
      if (!Number.isFinite(requestedRatioPercent) || requestedRatioPercent <= 0) {
        throw new AppError(400, "INVALID_STATE", "Invoice requested financing ratio is invalid");
      }

      const requestedAmount = (invoiceValue * requestedRatioPercent) / 100;
      if (offeredAmount > requestedAmount) {
        throw new AppError(
          400,
          "INVALID_INPUT",
          "Offered amount cannot be greater than requested amount"
        );
      }

      const previousOffer = (lockedInvoice.offer_details as Record<string, unknown> | null) ?? null;
      const previousVersion =
        typeof previousOffer?.version === "number" && Number.isFinite(previousOffer.version)
          ? previousOffer.version
          : 0;
      const now = new Date().toISOString();
      const offerDetails = {
        requested_amount: requestedAmount,
        offered_amount: offeredAmount,
        requested_ratio_percent: requestedRatioPercent,
        offered_ratio_percent: offeredRatioPercent,
        offered_profit_rate_percent: offeredProfitRatePercent,
        expires_at: expiresAt,
        sent_at: now,
        responded_at: null,
        sent_by_user_id: reviewerUserId,
        responded_by_user_id: null,
        version: previousVersion + 1,
      };

      const updateResult = await tx.invoice.updateMany({
        where: {
          id: invoiceId,
          application_id: applicationId,
          updated_at: lockedInvoice.updated_at,
        },
        data: {
          status: "OFFER_SENT",
          offer_details: offerDetails,
        },
      });
      if (updateResult.count !== 1) {
        throw new AppError(
          409,
          "CONFLICT",
          "Invoice was modified concurrently. Refresh and retry sending offer."
        );
      }

      await tx.applicationReviewItem.upsert({
        where: {
          application_id_item_type_item_id: {
            application_id: applicationId,
            item_type: "invoice",
            item_id: scopeKey,
          },
        },
        create: {
          application_id: applicationId,
          item_type: "invoice",
          item_id: scopeKey,
          status: ReviewStepStatus.OFFER_SENT,
          reviewer_user_id: reviewerUserId,
          reviewed_at: new Date(),
        },
        update: {
          status: ReviewStepStatus.OFFER_SENT,
          reviewer_user_id: reviewerUserId,
          reviewed_at: new Date(),
        },
      });

      if (application.contract_id) {
        const contract = await tx.contract.findUnique({
          where: { id: application.contract_id },
          include: { invoices: true },
        });
        if (contract) {
          const contractDetails = contract.contract_details as Record<string, unknown> | null;
          const { approvedFacility, utilizedFacility, availableFacility } =
            computeContractFacilitySnapshot(
              contract.status,
              contractDetails,
              contract.invoices.map((linkedInvoice) => ({
                status: linkedInvoice.status,
                details: (linkedInvoice.details as Record<string, unknown> | null) ?? null,
                offer_details: (linkedInvoice.offer_details as Record<string, unknown> | null) ?? null,
              }))
            );
          await tx.contract.update({
            where: { id: application.contract_id },
            data: {
              contract_details: {
                ...(contractDetails && typeof contractDetails === "object" ? contractDetails : {}),
                approved_facility: approvedFacility,
                utilized_facility: utilizedFacility,
                available_facility: availableFacility,
              },
            },
          });
        }
      }

      await tx.applicationReviewEvent.create({
        data: {
          application_id: applicationId,
          event_type: "INVOICE_OFFER_SENT",
          scope: "item",
          scope_key: scopeKey,
          new_status: "OFFER_SENT",
          reviewer_user_id: reviewerUserId,
        },
      });
      const invoiceStatuses = (
        await tx.invoice.findMany({
          where: { application_id: applicationId },
          select: { status: true },
        })
      ).map((row) => row.status);
      const nextApplicationStatus = this.allInvoicesOfferableOrResolved(invoiceStatuses)
        ? ApplicationStatus.INVOICES_SENT
        : ApplicationStatus.INVOICE_PENDING;
      await tx.application.update({
        where: { id: applicationId },
        data: { status: nextApplicationStatus },
      });

      const invoiceNumber =
        details.number != null && details.number !== ""
          ? String(details.number).trim()
          : null;
      return {
        invoiceNumber,
        requestedAmount,
        previousVersion,
      };
    });

    await logApplicationActivity({
      userId: reviewerUserId,
      applicationId,
      entityId: scopeKey,
      portal: ActivityPortal.ADMIN,
      eventType: "INVOICE_OFFER_SENT",
      metadata: {
        invoice_number: invoiceOfferMeta.invoiceNumber,
        requested_amount: invoiceOfferMeta.requestedAmount,
        offered_amount: offeredAmount,
        offered_ratio_percent: offeredRatioPercent,
        offered_profit_rate_percent: offeredProfitRatePercent,
        expires_at: expiresAt,
        version: invoiceOfferMeta.previousVersion + 1,
      },
      ipAddress: logContext?.ipAddress ?? undefined,
      userAgent: logContext?.userAgent ?? undefined,
      deviceInfo: logContext?.deviceInfo ?? undefined,
    });

    try {
      await this.sendIssuerNotification(
        applicationId,
        NotificationTypeIds.INVOICE_OFFER_SENT,
        {
          applicationId,
          invoiceId,
          invoiceNumber: invoiceOfferMeta.invoiceNumber,
          offeredAmount,
          expiresAt,
        },
        `invoice-offer-sent:${invoiceId}:${invoiceOfferMeta.previousVersion + 1}`
      );
    } catch (notificationError) {
      logger.error(
        { error: notificationError, applicationId, invoiceId },
        "Failed to send invoice offer notification to issuer"
      );
    }

    let nextApp = await repository.getApplicationById(applicationId);
    if (nextApp) {
      await this.syncInvoiceDetailsSectionFromItems(
        repository,
        applicationId,
        nextApp,
        reviewerUserId,
        logContext
      );
      nextApp = await repository.getApplicationById(applicationId);
    }
    return nextApp ?? repository.getApplicationById(applicationId);
  }

  /**
   * Clear pending item amendment drafts for the given item.
   * itemId is the scope_key (e.g. supporting_documents:..., invoice_details:...).
   */
  private async clearItemDraftAmendments(
    repository: AdminRepository,
    applicationId: string,
    _itemType: "invoice" | "document",
    itemId: string
  ): Promise<void> {
    const scopeKeys = new Set<string>([itemId]);
    await Promise.all(
      Array.from(scopeKeys).map((scopeKey) =>
        repository.removeDraftAmendment(applicationId, "item", scopeKey)
      )
    );
  }

  /**
   * Clear item remark entries for both canonical and legacy scope_key formats.
   * Used by reset-to-pending to fully clear the item's current remark entry.
   */
  private async clearItemRemarks(
    repository: AdminRepository,
    applicationId: string,
    _itemType: "invoice" | "document",
    itemId: string
  ): Promise<void> {
    const scopeKeys = new Set<string>([itemId]);
    await Promise.all(
      Array.from(scopeKeys).map((scopeKey) =>
        repository.removeReviewRemark(applicationId, "item", scopeKey)
      )
    );
  }

  /**
   * Approve a review section
   */
  async approveReviewSection(
    applicationId: string,
    section: ReviewSection,
    reviewerUserId: string,
    remark?: string | null,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application
    );
    if (section === "supporting_documents") {
      throw new AppError(
        400,
        "INVALID_ACTION",
        "Documents section status is derived from per-document reviews; approve each document instead"
      );
    }
    if (section === "contract_details" || section === "invoice_details") {
      const structure = application.financing_structure as { structure_type?: string } | null | undefined;
      const isInvoiceOnly = structure?.structure_type === "invoice_only";
      const contractApprovalAllowed = section === "contract_details" && isInvoiceOnly;
      if (!contractApprovalAllowed) {
        throw new AppError(
          400,
          "INVALID_ACTION",
          "Contract and invoice approvals must be finalized by issuer offer response"
        );
      }
    }
    await repository.ensureApplicationReviewSection(applicationId, section);

    const existing = application.application_reviews?.find(
      (r: { section: string; status: string }) => r.section === section
    );
    const oldStatus = existing?.status ?? "PENDING";

    await repository.updateSectionReviewStatus(
      applicationId,
      section,
      ReviewStepStatus.APPROVED,
      reviewerUserId
    );
    const remarkValue = remark?.trim() || null;
    if (remarkValue) {
      await repository.upsertReviewRemark(
        applicationId,
        "section",
        section,
        "APPROVE",
        remarkValue,
        reviewerUserId
      );
    }
    await this.logReviewActivity(
      applicationId,
      "section",
      section,
      oldStatus,
      "APPROVED",
      reviewerUserId,
      remarkValue,
      logContext
    );

    await repository.removeDraftAmendment(applicationId, "section", section);

    return repository.getApplicationById(applicationId);
  }

  /**
   * Reset a review section to PENDING (undoes approve/reject/amendment for that section).
   */
  async resetSectionReviewToPending(
    applicationId: string,
    section: ReviewSection,
    reviewerUserId: string,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application
    );
    if (section === "contract_details") {
      this.ensureContractOfferActionAllowed(application);
    }
    if (section === "invoice_details") {
      await this.ensureInvoiceSectionActionAllowed(applicationId);
    }

    if (section === "supporting_documents") {
      const docKeys = [...this.collectDocumentKeys(application.supporting_documents)];
      if (docKeys.length > 0) {
        for (const itemId of docKeys) {
          await this.resetItemReviewToPending(applicationId, "document", itemId, reviewerUserId, logContext, {
            skipSupportingDocumentsSectionSync: true,
            skipItemActivityLog: true,
          });
        }
        let nextApp = await repository.getApplicationById(applicationId);
        if (nextApp) {
          await this.syncSupportingDocumentsSectionFromItems(
            repository,
            applicationId,
            nextApp,
            reviewerUserId,
            logContext
          );
          nextApp = await repository.getApplicationById(applicationId);
        }
        await repository.removeDraftAmendment(applicationId, "section", section);
        logger.info({ applicationId, section, reviewerUserId }, "Review section reset to pending");
        return nextApp ?? repository.getApplicationById(applicationId);
      }
    }

    if (section === "invoice_details") {
      const invoices = application.invoices ?? [];
      if (invoices.length > 0) {
        for (const inv of invoices) {
          const scopeKey = this.resolveInvoiceScopeKeyById(
            application as { invoices?: { id: string; details?: { number?: string | number } }[] },
            inv.id
          );
          if (!scopeKey) continue;
          await this.resetItemReviewToPending(applicationId, "invoice", scopeKey, reviewerUserId, logContext, {
            skipInvoiceDetailsSectionSync: true,
            skipItemActivityLog: true,
          });
        }
        let nextApp = await repository.getApplicationById(applicationId);
        if (nextApp) {
          await this.syncInvoiceDetailsSectionFromItems(
            repository,
            applicationId,
            nextApp,
            reviewerUserId,
            logContext
          );
          nextApp = await repository.getApplicationById(applicationId);
        }
        await repository.removeDraftAmendment(applicationId, "section", section);
        await repository.updateApplicationStatus(applicationId, ApplicationStatus.INVOICE_PENDING);
        logger.info({ applicationId, section, reviewerUserId }, "Review section reset to pending");
        return nextApp ?? repository.getApplicationById(applicationId);
      }
    }

    const existing = application.application_reviews?.find(
      (r: { section: string; status: string }) => r.section === section
    );
    const oldStatus = existing?.status ?? "PENDING";
    let didRetractContractOffer = false;

    await repository.resetSectionReviewToPending(applicationId, section);
    if (section === "contract_details" && application.contract_id) {
      const contract = await prisma.contract.findUnique({
        where: { id: application.contract_id },
        select: { status: true, contract_details: true },
      });
      const cd = contract?.contract_details as Record<string, unknown> | null;
      const mergedDetails = {
        ...(cd && typeof cd === "object" ? cd : {}),
        approved_facility: 0,
        utilized_facility: 0,
        available_facility: 0,
      };
      const updateData: Prisma.ContractUpdateInput = {
        status: "SUBMITTED",
        contract_details: mergedDetails as Prisma.InputJsonValue,
      };
      didRetractContractOffer = oldStatus === "OFFER_SENT" || contract?.status === "OFFER_SENT";
      if (didRetractContractOffer) {
        updateData.offer_details = Prisma.JsonNull;
      }
      await prisma.contract.update({
        where: { id: application.contract_id },
        data: updateData,
      });
    }
    if (didRetractContractOffer && section === "contract_details") {
      await logApplicationActivity({
        userId: reviewerUserId,
        applicationId,
        portal: ActivityPortal.ADMIN,
        eventType: "CONTRACT_OFFER_RETRACTED",
        ipAddress: logContext?.ipAddress ?? undefined,
        userAgent: logContext?.userAgent ?? undefined,
        deviceInfo: logContext?.deviceInfo ?? undefined,
      });
      try {
        await this.sendIssuerNotification(
          applicationId,
          NotificationTypeIds.OFFER_RETRACTED_OR_RESET,
          {
            applicationId,
            offerType: "contract",
          },
          `contract-offer-retracted:${section}`
        );
      } catch (notificationError) {
        logger.error(
          { error: notificationError, applicationId, section },
          "Failed to send contract offer retracted/reset notification to issuer"
        );
      }
    }
    await this.logReviewActivity(
      applicationId,
      "section",
      section,
      oldStatus,
      "PENDING",
      reviewerUserId,
      null,
      logContext
    );
    await repository.removeDraftAmendment(applicationId, "section", section);
    if (section === "contract_details") {
      const structure = application.financing_structure as { structure_type?: string } | null | undefined;
      const isInvoiceOnly = structure?.structure_type === "invoice_only";
      await repository.updateApplicationStatus(
        applicationId,
        isInvoiceOnly ? ApplicationStatus.UNDER_REVIEW : ApplicationStatus.CONTRACT_PENDING
      );
    } else if (section === "invoice_details") {
      await repository.updateApplicationStatus(applicationId, ApplicationStatus.INVOICE_PENDING);
    }

    logger.info({ applicationId, section, reviewerUserId }, "Review section reset to pending");
    return repository.getApplicationById(applicationId);
  }

  /**
   * Reset a review item to PENDING (undoes approve/reject/amendment for that item).
   */
  async resetItemReviewToPending(
    applicationId: string,
    itemType: "invoice" | "document",
    itemId: string,
    reviewerUserId: string,
    logContext?: AdminLogContext,
    options?: {
      skipSupportingDocumentsSectionSync?: boolean;
      skipInvoiceDetailsSectionSync?: boolean;
      skipItemActivityLog?: boolean;
    }
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    this.validateReviewItemExists(application, itemType, itemId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application
    );
    if (itemType === "invoice") {
      await this.ensureInvoiceOfferItemActionAllowed(applicationId, itemId, application);
    }

    const existing = application.application_review_items?.find(
      (r: { item_type: string; item_id: string; status: string }) =>
        r.item_type === itemType && r.item_id === itemId
    );
    const oldStatus = existing?.status ?? "PENDING";
    let didRetractInvoiceOffer = false;

    await repository.resetItemReviewToPending(applicationId, itemType, itemId);
    if (itemType === "invoice") {
      const invoiceId = this.resolveInvoiceIdFromScopeKey(
        application as { invoices?: { id: string; details?: { number?: string | number } }[] },
        itemId
      );
      if (invoiceId) {
        const currentInvoice = await prisma.invoice.findUnique({
          where: { id: invoiceId, application_id: applicationId },
          select: { status: true },
        });
        const updateData: Prisma.InvoiceUpdateInput = {
          status: "SUBMITTED",
        };
        didRetractInvoiceOffer = oldStatus === "OFFER_SENT" || currentInvoice?.status === "OFFER_SENT";
        if (didRetractInvoiceOffer) {
          updateData.offer_details = Prisma.JsonNull;
        }
        await prisma.invoice.update({
          where: { id: invoiceId, application_id: applicationId },
          data: updateData,
        });
      }
      if (application.contract_id) {
        await this.refreshContractFacilityValues(application.contract_id);
      }
    }
    if (didRetractInvoiceOffer && itemType === "invoice") {
      await logApplicationActivity({
        userId: reviewerUserId,
        applicationId,
        entityId: itemId,
        portal: ActivityPortal.ADMIN,
        eventType: "INVOICE_OFFER_RETRACTED",
        ipAddress: logContext?.ipAddress ?? undefined,
        userAgent: logContext?.userAgent ?? undefined,
        deviceInfo: logContext?.deviceInfo ?? undefined,
      });
      try {
        const invoiceNumber = itemId.startsWith("invoice_details:")
          ? itemId.split(":").slice(2).join(":") || null
          : null;
        await this.sendIssuerNotification(
          applicationId,
          NotificationTypeIds.OFFER_RETRACTED_OR_RESET,
          {
            applicationId,
            offerType: "invoice",
            invoiceNumber,
          },
          `invoice-offer-retracted:${itemId}`
        );
      } catch (notificationError) {
        logger.error(
          { error: notificationError, applicationId, itemId },
          "Failed to send invoice offer retracted/reset notification to issuer"
        );
      }
    }
    if (!options?.skipItemActivityLog) {
      await this.logReviewActivity(
        applicationId,
        "item",
        itemId,
        oldStatus,
        "PENDING",
        reviewerUserId,
        null,
        logContext
      );
    }
    await this.clearItemDraftAmendments(repository, applicationId, itemType, itemId);
    await this.clearItemRemarks(repository, applicationId, itemType, itemId);
    if (itemType === "invoice") {
      await repository.updateApplicationStatus(applicationId, ApplicationStatus.INVOICE_PENDING);
    }

    logger.info({ applicationId, itemType, itemId, reviewerUserId }, "Review item reset to pending");
    let nextApp = await repository.getApplicationById(applicationId);
    if (
      itemType === "document" &&
      nextApp &&
      !options?.skipSupportingDocumentsSectionSync
    ) {
      await this.syncSupportingDocumentsSectionFromItems(
        repository,
        applicationId,
        nextApp,
        reviewerUserId,
        logContext
      );
      nextApp = await repository.getApplicationById(applicationId);
    }
    if (
      itemType === "invoice" &&
      nextApp &&
      !options?.skipInvoiceDetailsSectionSync
    ) {
      await this.syncInvoiceDetailsSectionFromItems(
        repository,
        applicationId,
        nextApp,
        reviewerUserId,
        logContext
      );
      nextApp = await repository.getApplicationById(applicationId);
    }
    return nextApp ?? repository.getApplicationById(applicationId);
  }

  /**
   * When one document is rejected: remove amendment drafts on all other document items and
   * reset any sibling in AMENDMENT_REQUESTED to PENDING (with activity logs). Section sync is left to caller.
   */
  private async clearSiblingDocumentAmendmentsAfterPeerReject(
    repository: AdminRepository,
    applicationId: string,
    application: {
      supporting_documents?: unknown;
      application_review_items?: { item_type: string; item_id: string; status: string }[];
    },
    rejectedItemId: string,
    reviewerUserId: string,
    logContext?: AdminLogContext
  ): Promise<void> {
    const docs = application.supporting_documents;
    if (!docs || typeof docs !== "object") {
      return;
    }
    const keys = [...this.collectDocumentKeys(docs)];
    for (const key of keys) {
      if (key === rejectedItemId) {
        continue;
      }
      await repository.removeDraftAmendment(applicationId, "item", key);
      const row = application.application_review_items?.find(
        (r) => r.item_type === "document" && r.item_id === key
      );
      if (row?.status === "AMENDMENT_REQUESTED") {
        await this.resetItemReviewToPending(
          applicationId,
          "document",
          key,
          reviewerUserId,
          logContext,
          { skipSupportingDocumentsSectionSync: true }
        );
      }
    }
  }

  /**
   * Reject a review section. Updates section status only; does not change application status.
   * Application-level Reject must be triggered separately when admin finalizes.
   */
  async rejectReviewSection(
    applicationId: string,
    section: ReviewSection,
    remark: string,
    reviewerUserId: string,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application
    );
    if (section === "supporting_documents") {
      throw new AppError(
        400,
        "INVALID_ACTION",
        "Documents section status is derived from per-document reviews; reject documents instead"
      );
    }
    if (section === "contract_details") {
      this.ensureContractOfferActionAllowed(application);
    }
    if (section === "invoice_details") {
      await this.ensureInvoiceSectionActionAllowed(applicationId);
    }
    await repository.ensureApplicationReviewSection(applicationId, section);

    const existing = application.application_reviews?.find(
      (r: { section: string; status: string }) => r.section === section
    );
    const oldStatus = existing?.status ?? "PENDING";

    await repository.updateSectionReviewStatus(
      applicationId,
      section,
      ReviewStepStatus.REJECTED,
      reviewerUserId
    );
    if (section === "contract_details" && application.contract_id) {
      await prisma.contract.update({
        where: { id: application.contract_id },
        data: { status: "REJECTED" },
      });
    }
    await repository.upsertReviewRemark(
      applicationId,
      "section",
      section,
      "REJECT",
      remark,
      reviewerUserId
    );
    await this.logReviewActivity(
      applicationId,
      "section",
      section,
      oldStatus,
      "REJECTED",
      reviewerUserId,
      remark,
      logContext
    );

    await repository.removeDraftAmendment(applicationId, "section", section);

    logger.info({ applicationId, section, reviewerUserId }, "Review section rejected");
    return repository.getApplicationById(applicationId);
  }

  /**
   * Request amendment for a review section. Updates section status only; does not change application status.
   * Application-level amendment submission must be triggered separately via submitPendingAmendments.
   */
  async requestAmendmentReviewSection(
    applicationId: string,
    section: ReviewSection,
    remark: string,
    reviewerUserId: string,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application
    );
    if (section === "supporting_documents") {
      throw new AppError(
        400,
        "INVALID_ACTION",
        "Documents section status is derived from per-document reviews; request amendments on documents instead"
      );
    }
    if (section === "contract_details") {
      this.ensureContractOfferActionAllowed(application);
    }
    if (section === "invoice_details") {
      await this.ensureInvoiceSectionActionAllowed(applicationId);
    }
    await repository.ensureApplicationReviewSection(applicationId, section);

    const existing = application.application_reviews?.find(
      (r: { section: string; status: string }) => r.section === section
    );
    const oldStatus = existing?.status ?? "PENDING";

    await repository.updateSectionReviewStatus(
      applicationId,
      section,
      ReviewStepStatus.AMENDMENT_REQUESTED,
      reviewerUserId
    );
    await repository.upsertReviewRemark(
      applicationId,
      "section",
      section,
      "REQUEST_AMENDMENT",
      remark,
      reviewerUserId
    );
    if (section === "contract_details" && application.contract_id) {
      await prisma.contract.update({
        where: { id: application.contract_id },
        data: { status: "AMENDMENT_REQUESTED" },
      });
    }
    await this.logReviewActivity(
      applicationId,
      "section",
      section,
      oldStatus,
      "AMENDMENT_REQUESTED",
      reviewerUserId,
      remark,
      logContext
    );

    await repository.removeDraftAmendment(applicationId, "section", section);

    logger.info({ applicationId, section, reviewerUserId }, "Amendment requested for review section");
    return repository.getApplicationById(applicationId);
  }

  async addSectionComment(
    applicationId: string,
    section: ReviewSection,
    comment: string,
    reviewerUserId: string
  ) {
    const { repository } = await this.loadApplicationForComment(applicationId);

    const commentId = `${Date.now()}-${reviewerUserId}`;
    await repository.createReviewRemark(
      applicationId,
      "comment",
      `${section}:${commentId}`,
      "COMMENT",
      comment.trim(),
      reviewerUserId
    );

    logger.info({ applicationId, section, reviewerUserId }, "Section comment added");
    return repository.getApplicationById(applicationId);
  }

  /**
   * Approve a review item (invoice or document)
   */
  async approveReviewItem(
    applicationId: string,
    itemType: "invoice" | "document",
    itemId: string,
    reviewerUserId: string,
    remark?: string | null,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    this.validateReviewItemExists(application, itemType, itemId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application
    );
    if (itemType === "invoice") {
      throw new AppError(
        400,
        "INVALID_ACTION",
        "Invoice approvals must be finalized by issuer offer response"
      );
    }
    const existing = application.application_review_items?.find(
      (r: { item_type: string; item_id: string; status: string }) =>
        r.item_type === itemType && r.item_id === itemId
    );
    const oldStatus = existing?.status ?? "PENDING";

    await repository.upsertItemReviewStatus(
      applicationId,
      itemType,
      itemId,
      ReviewStepStatus.APPROVED,
      reviewerUserId
    );
    const remarkValue = remark?.trim() || null;
    if (remarkValue) {
      await repository.upsertReviewRemark(
        applicationId,
        "item",
        itemId,
        "APPROVE",
        remarkValue,
        reviewerUserId
      );
    }
    await this.logReviewActivity(
      applicationId,
      "item",
      itemId,
      oldStatus,
      "APPROVED",
      reviewerUserId,
      remarkValue,
      logContext
    );

    await this.clearItemDraftAmendments(repository, applicationId, itemType, itemId);

    let nextApp = await repository.getApplicationById(applicationId);
    if (itemType === "document" && nextApp) {
      await this.syncSupportingDocumentsSectionFromItems(
        repository,
        applicationId,
        nextApp,
        reviewerUserId,
        logContext
      );
      nextApp = await repository.getApplicationById(applicationId);
    }
    return nextApp ?? repository.getApplicationById(applicationId);
  }

  /**
   * Reject a review item
   */
  async rejectReviewItem(
    applicationId: string,
    itemType: "invoice" | "document",
    itemId: string,
    remark: string,
    reviewerUserId: string,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    this.validateReviewItemExists(application, itemType, itemId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application
    );
    if (itemType === "invoice") {
      await this.ensureInvoiceOfferItemActionAllowed(applicationId, itemId, application);
    }
    const existing = application.application_review_items?.find(
      (r: { item_type: string; item_id: string; status: string }) =>
        r.item_type === itemType && r.item_id === itemId
    );
    const oldStatus = existing?.status ?? "PENDING";

    await repository.upsertItemReviewStatus(
      applicationId,
      itemType,
      itemId,
      ReviewStepStatus.REJECTED,
      reviewerUserId
    );
    await repository.upsertReviewRemark(
      applicationId,
      "item",
      itemId,
      "REJECT",
      remark,
      reviewerUserId
    );
    await this.logReviewActivity(
      applicationId,
      "item",
      itemId,
      oldStatus,
      "REJECTED",
      reviewerUserId,
      remark,
      logContext
    );

    await this.clearItemDraftAmendments(repository, applicationId, itemType, itemId);

    if (itemType === "document") {
      await this.clearSiblingDocumentAmendmentsAfterPeerReject(
        repository,
        applicationId,
        application,
        itemId,
        reviewerUserId,
        logContext
      );
    }

    if (itemType === "invoice") {
      const invoiceId = this.resolveInvoiceIdFromScopeKey(
        application as { invoices?: { id: string; details?: { number?: string | number } }[] },
        itemId
      );
      if (invoiceId) {
        await prisma.invoice.update({
          where: { id: invoiceId, application_id: applicationId },
          data: { status: "REJECTED" },
        });
      }
      if (application.contract_id) {
        await this.refreshContractFacilityValues(application.contract_id);
      }
    }

    let nextApp = await repository.getApplicationById(applicationId);
    if (itemType === "document" && nextApp) {
      await this.syncSupportingDocumentsSectionFromItems(
        repository,
        applicationId,
        nextApp,
        reviewerUserId,
        logContext
      );
      nextApp = await repository.getApplicationById(applicationId);
    }
    if (itemType === "invoice" && nextApp) {
      await this.syncInvoiceDetailsSectionFromItems(
        repository,
        applicationId,
        nextApp,
        reviewerUserId,
        logContext
      );
      nextApp = await repository.getApplicationById(applicationId);
    }
    return nextApp ?? repository.getApplicationById(applicationId);
  }

  /**
   * Request amendment for a review item
   */
  async requestAmendmentReviewItem(
    applicationId: string,
    itemType: "invoice" | "document",
    itemId: string,
    remark: string,
    reviewerUserId: string,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    this.validateReviewItemExists(application, itemType, itemId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application
    );
    if (itemType === "invoice") {
      await this.ensureInvoiceOfferItemActionAllowed(applicationId, itemId, application);
    }
    const existing = application.application_review_items?.find(
      (r: { item_type: string; item_id: string; status: string }) =>
        r.item_type === itemType && r.item_id === itemId
    );
    const oldStatus = existing?.status ?? "PENDING";

    await repository.upsertItemReviewStatus(
      applicationId,
      itemType,
      itemId,
      ReviewStepStatus.AMENDMENT_REQUESTED,
      reviewerUserId
    );
    await repository.upsertReviewRemark(
      applicationId,
      "item",
      itemId,
      "REQUEST_AMENDMENT",
      remark,
      reviewerUserId
    );
    await this.logReviewActivity(
      applicationId,
      "item",
      itemId,
      oldStatus,
      "AMENDMENT_REQUESTED",
      reviewerUserId,
      remark,
      logContext
    );

    await this.clearItemDraftAmendments(repository, applicationId, itemType, itemId);

    if (itemType === "invoice") {
      const invoiceId = this.resolveInvoiceIdFromScopeKey(
        application as { invoices?: { id: string; details?: { number?: string | number } }[] },
        itemId
      );
      if (invoiceId) {
        await prisma.invoice.update({
          where: { id: invoiceId, application_id: applicationId },
          data: { status: "AMENDMENT_REQUESTED" },
        });
      }
    }

    let nextApp = await repository.getApplicationById(applicationId);
    if (itemType === "document" && nextApp) {
      await this.syncSupportingDocumentsSectionFromItems(
        repository,
        applicationId,
        nextApp,
        reviewerUserId,
        logContext
      );
      nextApp = await repository.getApplicationById(applicationId);
    }
    if (itemType === "invoice" && nextApp) {
      await this.syncInvoiceDetailsSectionFromItems(
        repository,
        applicationId,
        nextApp,
        reviewerUserId,
        logContext
      );
      nextApp = await repository.getApplicationById(applicationId);
    }
    return nextApp ?? repository.getApplicationById(applicationId);
  }

  /**
   * Add or update a pending amendment (draft). Updates section/item status immediately and
   * creates ApplicationReviewRemark with submitted_at=null. Proceed sets submitted_at.
   */
  async addPendingAmendment(
    applicationId: string,
    scope: "section" | "item",
    scopeKey: string,
    remark: string,
    reviewerUserId: string,
    itemType?: "invoice" | "document",
    itemId?: string,
    logContext?: AdminLogContext
  ) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application
    );

    if (scope === "section") {
      const validSections = REVIEW_SECTION_ORDER;
      if (!validSections.includes(scopeKey as (typeof REVIEW_SECTION_ORDER)[number])) {
        throw new AppError(400, "INVALID_SCOPE", `Invalid section: ${scopeKey}`);
      }
      if (scopeKey === "supporting_documents") {
        throw new AppError(
          400,
          "INVALID_ACTION",
          "Documents section status is derived from per-document reviews; add drafts on document items instead"
        );
      }
      if (scopeKey === "contract_details") {
        this.ensureContractOfferActionAllowed(application);
      }
      if (scopeKey === "invoice_details") {
        await this.ensureInvoiceSectionActionAllowed(applicationId);
      }
      await repository.updateSectionReviewStatus(
        applicationId,
        scopeKey as ReviewSection,
        ReviewStepStatus.AMENDMENT_REQUESTED,
        reviewerUserId
      );
      if (scopeKey === "contract_details" && application.contract_id) {
        await prisma.contract.update({
          where: { id: application.contract_id },
          data: { status: "AMENDMENT_REQUESTED" },
        });
      }
    } else {
      if (!itemType || !itemId) {
        throw new AppError(400, "INVALID_INPUT", "itemType and itemId are required for item scope");
      }
      this.validateReviewItemExists(application, itemType, itemId);
      if (itemType === "invoice") {
        await this.ensureInvoiceOfferItemActionAllowed(applicationId, itemId, application);
      }
      if (itemType === "invoice") {
        const targetInvoiceId = this.resolveInvoiceIdFromScopeKey(application, itemId);
        if (targetInvoiceId) {
          const existingDrafts = await repository.listPendingAmendments(applicationId);
          for (const draft of existingDrafts) {
            if (draft.scope !== "item" || draft.scope_key === itemId) continue;
            const draftInvoiceId = this.resolveInvoiceIdFromScopeKey(application, draft.scope_key);
            if (draftInvoiceId && draftInvoiceId === targetInvoiceId) {
              await repository.removeDraftAmendment(applicationId, "item", draft.scope_key);
            }
          }
        }
      }
      await repository.upsertItemReviewStatus(
        applicationId,
        itemType,
        itemId,
        ReviewStepStatus.AMENDMENT_REQUESTED,
        reviewerUserId
      );
      if (itemType === "invoice") {
        const invoiceId = this.resolveInvoiceIdFromScopeKey(
          application as { invoices?: { id: string; details?: { number?: string | number } }[] },
          itemId
        );
        if (invoiceId) {
          await prisma.invoice.update({
            where: { id: invoiceId, application_id: applicationId },
            data: { status: "AMENDMENT_REQUESTED" },
          });
        }
      }
    }

    await repository.upsertDraftAmendment(applicationId, scope, scopeKey, remark, reviewerUserId);

    const existing =
      scope === "section"
        ? (application.application_reviews as { section: string; status: string }[] | undefined)?.find(
          (r) => r.section === scopeKey
        )?.status
        : (application.application_review_items as { item_type: string; item_id: string; status: string }[] | undefined)?.find(
          (r) => r.item_type === itemType && r.item_id === itemId
        )?.status;
    const oldStatus = existing ?? "PENDING";
    if (oldStatus !== "AMENDMENT_REQUESTED") {
      await this.logReviewActivity(
        applicationId,
        scope,
        scopeKey,
        oldStatus,
        "AMENDMENT_REQUESTED",
        reviewerUserId,
        remark,
        logContext
      );
    }

    logger.info({ applicationId, scope, scopeKey, reviewerUserId }, "Pending amendment added");
    let result = await repository.getApplicationById(applicationId);
    if (scope === "item" && itemType === "document" && result) {
      await this.syncSupportingDocumentsSectionFromItems(
        repository,
        applicationId,
        result,
        reviewerUserId,
        logContext
      );
      result = await repository.getApplicationById(applicationId);
    }
    if (scope === "item" && itemType === "invoice" && result) {
      await this.syncInvoiceDetailsSectionFromItems(
        repository,
        applicationId,
        result,
        reviewerUserId,
        logContext
      );
      result = await repository.getApplicationById(applicationId);
    }
    return result ?? repository.getApplicationById(applicationId);
  }

  /**
   * List pending amendments for an application (draft remarks with submitted_at=null)
   */
  async listPendingAmendments(applicationId: string) {
    const repository = new AdminRepository();
    const application = await repository.getApplicationById(applicationId);
    if (!application) {
      throw new AppError(404, "NOT_FOUND", "Application not found");
    }
    if (!this.isReviewable(application.status as ApplicationStatus)) {
      throw new AppError(400, "INVALID_STATE", "Application is not in a reviewable state");
    }
    const rows = await repository.listPendingAmendments(applicationId);
    const dedupedRows = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      // Keep one pending amendment per invoice, even if historical scope_key index changed.
      if (row.scope === "item" && row.scope_key.startsWith("invoice_details:")) {
        const invoiceId = this.resolveInvoiceIdFromScopeKey(
          application as { invoices?: { id: string; details?: { number?: string | number } }[] },
          row.scope_key
        );
        if (invoiceId) {
          dedupedRows.set(`invoice:${invoiceId}`, row);
          continue;
        }
      }
      dedupedRows.set(`scope:${row.scope}:${row.scope_key}`, row);
    }
    const normalizedRows = Array.from(dedupedRows.values());
    return normalizedRows.map((r) => {
      const base = {
        id: r.id,
        scope: r.scope,
        scope_key: r.scope_key,
        remark: r.remark,
        author: r.author ? { first_name: r.author.first_name, last_name: r.author.last_name } : undefined,
      };
      if (r.scope === "item") {
        const { itemType, itemId } = parseItemScopeKey(r.scope_key);
        return { ...base, item_type: itemType || null, item_id: itemId || null };
      }
      return { ...base, item_type: null, item_id: null };
    });
  }

  /**
   * Update a pending amendment remark
   */
  async updatePendingAmendment(
    applicationId: string,
    scope: string,
    scopeKey: string,
    remark: string,
    reviewerUserId: string
  ) {
    const { repository } = await this.prepareForReviewAction(applicationId);
    const result = await repository.updateDraftAmendment(
      applicationId,
      scope,
      scopeKey,
      remark,
      reviewerUserId
    );
    if (result.count === 0) {
      throw new AppError(404, "NOT_FOUND", "Pending amendment not found");
    }
    logger.info({ applicationId, scope, scopeKey }, "Pending amendment updated");
    return repository.listPendingAmendments(applicationId);
  }

  /**
   * Remove a pending amendment. If the affected section has no pending amendments left,
   * reverts the section status to PENDING.
   */
  async removePendingAmendment(
    applicationId: string,
    scope: string,
    scopeKey: string,
    reviewerUserId: string
  ) {
    const { repository } = await this.prepareForReviewAction(applicationId);
    const application = await repository.getApplicationById(applicationId);
    if (!application) {
      throw new AppError(404, "NOT_FOUND", "Application not found");
    }

    const affectedSection =
      scope === "section"
        ? scopeKey
        : getSectionForScopeKey(scopeKey);
    if (affectedSection === "contract_details") {
      this.ensureContractOfferActionAllowed(application);
    }
    if (affectedSection === "invoice_details") {
      await this.ensureInvoiceSectionActionAllowed(applicationId);
    }
    if (scope === "item") {
      const { itemType, itemId } = parseItemScopeKey(scopeKey);
      if (itemType === "invoice") {
        await this.ensureInvoiceOfferItemActionAllowed(applicationId, itemId, application);
      }
    }

    const result = await repository.removeDraftAmendment(applicationId, scope, scopeKey);
    if (result.count === 0) {
      throw new AppError(404, "NOT_FOUND", "Pending amendment not found");
    }
    logger.info({ applicationId, scope, scopeKey }, "Pending amendment removed");

    if (scope === "item") {
      const { itemType, itemId } = parseItemScopeKey(scopeKey);
      await repository.upsertItemReviewStatus(
        applicationId,
        itemType,
        itemId,
        ReviewStepStatus.PENDING,
        reviewerUserId
      );
      if (itemType === "invoice") {
        const application = await repository.getApplicationById(applicationId);
        const invoiceId = application
          ? this.resolveInvoiceIdFromScopeKey(
              application as { invoices?: { id: string; details?: { number?: string | number } }[] },
              itemId
            )
          : null;
        if (invoiceId) {
          await prisma.invoice.update({
            where: { id: invoiceId, application_id: applicationId },
            data: { status: "SUBMITTED" },
          });
          await repository.updateApplicationStatus(applicationId, ApplicationStatus.INVOICE_PENDING);
        }
      }
    }

    const remaining = await repository.listPendingAmendments(applicationId);
    const sectionStillHasAmendments = remaining.some((p) => {
      const s = getSectionForPendingAmendment(p.scope, p.scope_key);
      return s === affectedSection;
    });

    if (!sectionStillHasAmendments) {
      const validSections = REVIEW_SECTION_ORDER;
      if (validSections.includes(affectedSection as (typeof REVIEW_SECTION_ORDER)[number])) {
        await repository.updateSectionReviewStatus(
          applicationId,
          affectedSection as ReviewSection,
          ReviewStepStatus.PENDING,
          reviewerUserId
        );
      }
      if (affectedSection === "contract_details") {
        if (application.contract_id) {
          await prisma.contract.update({
            where: { id: application.contract_id },
            data: { status: "SUBMITTED" },
          });
          const structure = application.financing_structure as { structure_type?: string } | null | undefined;
          const isInvoiceOnly = structure?.structure_type === "invoice_only";
          await repository.updateApplicationStatus(
            applicationId,
            isInvoiceOnly ? ApplicationStatus.UNDER_REVIEW : ApplicationStatus.CONTRACT_PENDING
          );
        }
      }
    }

    if (affectedSection === "invoice_details") {
      const nextApp = await repository.getApplicationById(applicationId);
      if (nextApp) {
        await this.syncInvoiceDetailsSectionFromItems(
          repository,
          applicationId,
          nextApp,
          reviewerUserId,
          undefined
        );
      }
    }

    return repository.listPendingAmendments(applicationId);
  }

  /**
   * Submit all pending amendments. Marks draft remarks as submitted and updates application status.
   * Item/section status already set when adding to pending; remarks already exist.
   */
  async submitPendingAmendments(applicationId: string, reviewerUserId: string, logContext?: AdminLogContext) {
    const { repository, application } = await this.prepareForReviewAction(applicationId);
    await this.ensureUnderReview(
      repository,
      applicationId,
      application.status as ApplicationStatus,
      application
    );

    const pending = await repository.listPendingAmendments(applicationId);
    if (pending.length === 0) {
      throw new AppError(400, "EMPTY_LIST", "No pending amendments to submit");
    }

    const hasContractDetails = pending.some(
      (p) => p.scope === "section" && p.scope_key === "contract_details"
    );

    await prisma.$transaction(async (tx) => {
      await tx.applicationReviewRemark.updateMany({
        where: {
          application_id: applicationId,
          action_type: "REQUEST_AMENDMENT",
          submitted_at: null,
        },
        data: { submitted_at: new Date() },
      });

      if (hasContractDetails && application.contract_id) {
        await tx.contract.update({
          where: { id: application.contract_id },
          data: { status: "AMENDMENT_REQUESTED" },
        });
      }

      await tx.application.update({
        where: { id: applicationId },
        data: { status: ApplicationStatus.AMENDMENT_REQUESTED },
      });

      await tx.applicationReviewEvent.create({
        data: {
          application_id: applicationId,
          event_type: "AMENDMENTS_SUBMITTED",
          new_status: "AMENDMENT_REQUESTED",
          reviewer_user_id: reviewerUserId,
          remark: `${pending.length} amendment(s) sent to issuer`,
        },
      });
    });

    await logApplicationActivity({
      userId: reviewerUserId,
      applicationId,
      portal: ActivityPortal.ADMIN,
      eventType: "AMENDMENTS_SUBMITTED",
      remark: `${pending.length} amendment(s) sent to issuer`,
      metadata: { count: pending.length },
      ipAddress: logContext?.ipAddress ?? undefined,
      userAgent: logContext?.userAgent ?? undefined,
      deviceInfo: logContext?.deviceInfo ?? undefined,
    });

    try {
      await this.sendIssuerNotification(
        applicationId,
        NotificationTypeIds.APPLICATION_AMENDMENTS_REQUESTED,
        {
          applicationId,
          amendmentCount: pending.length,
        },
        `amendments-submitted:${application.review_cycle ?? 1}:${pending.length}`
      );
    } catch (notificationError) {
      logger.error(
        { error: notificationError, applicationId },
        "Failed to send amendment submitted notification to issuer"
      );
    }

    logger.info({ applicationId, count: pending.length, reviewerUserId }, "Pending amendments submitted");
    return repository.getApplicationById(applicationId);
  }
}
