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
      avgTimeChangePercent: number | null;
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
    onboardingStatus?: "PENDING" | "COMPLETED";
  }): Promise<{
    organizations: {
      id: string;
      portal: "investor" | "issuer";
      type: "PERSONAL" | "COMPANY";
      name: string | null;
      registrationNumber: string | null;
      onboardingStatus: "PENDING" | "COMPLETED";
      onboardedAt: string | null;
      owner: {
        userId: string;
        email: string;
        firstName: string;
        lastName: string;
      };
      memberCount: number;
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
   * List onboarding applications for admin approval queue
   * Combines data from regtank_onboarding with investor/issuer organizations
   * Maps RegTank statuses to admin-friendly approval statuses
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
    const { applications, totalCount } = await this.regTankRepository.listOnboardingApplications({
      page: params.page,
      pageSize: params.pageSize,
      search: params.search,
      portal: params.portal as "investor" | "issuer" | undefined,
      type: params.type as OrganizationType | undefined,
    });

    // Map applications to response format with derived approval status
    const mappedApplications = applications.map((app) =>
      this.mapToOnboardingApplicationResponse(app)
    );

    // Filter by status if specified (post-processing since status is derived)
    const filteredApplications = params.status
      ? mappedApplications.filter((app) => app.status === params.status)
      : mappedApplications;

    return {
      applications: filteredApplications,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount: params.status ? filteredApplications.length : totalCount,
        totalPages: Math.ceil(
          (params.status ? filteredApplications.length : totalCount) / params.pageSize
        ),
      },
    };
  }

  /**
   * Get count of onboarding applications requiring admin action
   * Includes: PENDING_SSM_REVIEW, PENDING_APPROVAL, PENDING_AML
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
    const regtankPortalUrl = record.request_id
      ? `${regtankConfig.adminPortalUrl}/app/liveness/${record.request_id}?archived=false`
      : null;

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
      status,
      ssmVerified: false, // Will be implemented when SSM verification is added
      ssmVerifiedAt: null,
      ssmVerifiedBy: null,
      submittedAt: record.created_at.toISOString(),
      completedAt: record.completed_at?.toISOString() || null,
    };
  }

  /**
   * Derive the admin-friendly approval status from RegTank status and organization status
   *
   * Status mapping:
   * - PENDING_SSM_REVIEW: Company in issuer portal without SSM verification
   * - PENDING_ONBOARDING: User is in the process of completing RegTank onboarding
   * - PENDING_APPROVAL: Completed RegTank onboarding, awaiting admin approval
   * - PENDING_AML: Onboarding approved, awaiting AML check
   * - APPROVED: Fully approved
   * - REJECTED: Rejected at any stage
   * - EXPIRED: RegTank link expired
   */
  private deriveApprovalStatus(
    regtankStatus: string,
    _orgType: OrganizationType,
    _portalType: string,
    orgOnboardingStatus: string
  ): OnboardingApprovalStatus {
    // Check for final states first
    if (regtankStatus === "REJECTED") {
      return "REJECTED";
    }

    if (regtankStatus === "EXPIRED") {
      return "EXPIRED";
    }

    // Check organization onboarding status
    if (orgOnboardingStatus === "COMPLETED") {
      return "APPROVED";
    }

    if (orgOnboardingStatus === "PENDING_AML") {
      return "PENDING_AML";
    }

    // For company issuers, check if SSM verification is needed
    // Currently SSM verification is not tracked in the database, so we skip this
    // When implemented, add: if (orgType === "COMPANY" && portalType === "issuer" && !ssmVerified) return "PENDING_SSM_REVIEW"

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

    // If RegTank shows APPROVED but org status is not COMPLETED yet, it's pending AML
    if (regtankStatus === "APPROVED" && orgOnboardingStatus !== "COMPLETED") {
      return "PENDING_AML";
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

    // Determine organization ID
    const isInvestor = onboarding.portal_type === "investor";
    const organizationId = isInvestor
      ? onboarding.investor_organization_id
      : onboarding.issuer_organization_id;

    // Create new onboarding record with the new requestId from RegTank
    const expiresIn = regTankResponse.expiredIn || 86400;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

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
      status: "IN_PROGRESS",
      regtankResponse: regTankResponse,
    });

    // Reset the organization's onboarding status
    if (isInvestor && onboarding.investor_organization_id) {
      await prisma.investorOrganization.update({
        where: { id: onboarding.investor_organization_id },
        data: { onboarding_status: "PENDING" },
      });
    } else if (onboarding.issuer_organization_id) {
      await prisma.issuerOrganization.update({
        where: { id: onboarding.issuer_organization_id },
        data: { onboarding_status: "PENDING" },
      });
    }

    // Log the onboarding restart request
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);
    const role = isInvestor ? UserRole.INVESTOR : UserRole.ISSUER;

    await this.repository.createOnboardingLog({
      userId: onboarding.user_id,
      role,
      eventType: "ONBOARDING_REDO_REQUESTED",
      portal: onboarding.portal_type,
      ipAddress,
      userAgent,
      deviceInfo,
      deviceType,
      metadata: {
        oldOnboardingId: onboardingId,
        oldRequestId: onboarding.request_id,
        newRequestId: regTankResponse.requestId,
        previousStatus: onboarding.status,
        requestedBy: adminUserId,
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
}
