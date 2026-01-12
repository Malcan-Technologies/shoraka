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
} from "./schemas";
import { RegTankRepository, OnboardingApplicationRecord } from "../regtank/repository";
import { RegTankAPIClient } from "../regtank/api-client";
import { getRegTankConfig } from "../../config/regtank";
import type { OnboardingApprovalStatus, OnboardingApplicationResponse } from "@cashsouk/types";

export class AdminService {
  private repository: AdminRepository;
  private regTankRepository: RegTankRepository;
  private regTankApiClient: RegTankAPIClient;

  constructor() {
    this.repository = new AdminRepository();
    this.regTankRepository = new RegTankRepository();
    this.regTankApiClient = new RegTankAPIClient();
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
    })[];
    total: number;
  }> {
    return this.repository.getOnboardingLogs(params);
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
  } | null> {
    const org = await this.repository.getOrganizationById(portal, id);

    if (!org) {
      return null;
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
      regtankPortalUrl: org.regtank_onboarding?.[0]?.request_id
        ? `${getRegTankConfig().adminPortalUrl}/app/liveness/${org.regtank_onboarding[0].request_id}?archived=false`
        : null,
    };
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

    return {
      id: record.id,
      userId: record.user.user_id,
      userName: userName || record.user.email,
      userEmail: record.user.email,
      type: record.organization_type as "PERSONAL" | "COMPANY",
      portal: record.portal_type as "investor" | "issuer",
      organizationId: org?.id || "",
      organizationName: org?.name || null,
      registrationNumber: org?.registration_number || null,
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
    // For corporate onboarding, use CORPORATE_ONBOARDING_COMPLETED
    const isCorporateOnboarding = onboarding.onboarding_type === "CORPORATE";
    const eventType = isCorporateOnboarding ? "CORPORATE_ONBOARDING_COMPLETED" : "FINAL_APPROVAL_COMPLETED";
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

      // Update organization with refreshed director KYC statuses
      const directorKycStatus = {
        corpIndvDirectorCount: codDetails.corpIndvDirectorCount || 0,
        corpIndvShareholderCount: codDetails.corpIndvShareholderCount || 0,
        corpBizShareholderCount: codDetails.corpBizShareholderCount || 0,
        directors,
        lastSyncedAt: new Date().toISOString(),
      };

      if (isInvestor) {
        await prisma.investorOrganization.update({
          where: { id: org.id },
          data: {
            director_kyc_status: directorKycStatus as Prisma.InputJsonValue,
          },
        });
      } else {
        await prisma.issuerOrganization.update({
          where: { id: org.id },
          data: {
            director_kyc_status: directorKycStatus as Prisma.InputJsonValue,
          },
        });
      }

      logger.info(
        {
          onboardingId,
          codRequestId,
          organizationId: org.id,
          adminUserId,
          directorsUpdated: directors.length,
        },
        "Refreshed corporate onboarding director KYC statuses"
      );

      return {
        success: true,
        message: `Successfully refreshed ${directors.length} director KYC status${directors.length !== 1 ? "es" : ""}.`,
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
   * Refresh corporate AML status for all directors
   * Fetches latest AML status from RegTank KYC query API for each director with a kycId
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

    // Get director_kyc_status to extract kycIds
    const directorKycStatus = org.director_kyc_status as any;
    if (!directorKycStatus || !directorKycStatus.directors || !Array.isArray(directorKycStatus.directors)) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Director KYC status not found. Please refresh corporate onboarding status first."
      );
    }

    try {
      logger.info(
        { onboardingId, organizationId: org.id, adminUserId },
        "Fetching AML status for all directors"
      );

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
      for (const director of directorKycStatus.directors) {
        if (!director.kycId) {
          logger.debug(
            { directorName: director.name, eodRequestId: director.eodRequestId },
            "Skipping director without kycId"
          );
          continue;
        }

        try {
          const kycStatusResponse = await this.regTankApiClient.queryKYCStatus(director.kycId);
          
          // RegTank returns an array with one object
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
              amlRiskScore,
              amlRiskLevel,
            },
            "Fetched AML status for director"
          );
        } catch (kycError) {
          logger.warn(
            {
              error: kycError instanceof Error ? kycError.message : String(kycError),
              kycId: director.kycId,
              directorName: director.name,
            },
            "Failed to fetch AML status for director (non-blocking)"
          );
          // Continue with other directors even if one fails
        }
      }

      // Update organization with refreshed director AML statuses
      const directorAmlStatus = {
        directors: directorsAmlStatus,
        lastSyncedAt: new Date().toISOString(),
      };

      if (isInvestor) {
        await prisma.investorOrganization.update({
          where: { id: org.id },
          data: {
            director_aml_status: directorAmlStatus as Prisma.InputJsonValue,
          },
        });
      } else {
        await prisma.issuerOrganization.update({
          where: { id: org.id },
          data: {
            director_aml_status: directorAmlStatus as Prisma.InputJsonValue,
          },
        });
      }

      logger.info(
        {
          onboardingId,
          organizationId: org.id,
          adminUserId,
          directorsUpdated: directorsAmlStatus.length,
        },
        "Refreshed corporate AML statuses"
      );

      return {
        success: true,
        message: `Successfully refreshed ${directorsAmlStatus.length} director AML status${directorsAmlStatus.length !== 1 ? "es" : ""}.`,
        directorsUpdated: directorsAmlStatus.length,
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
}
