import { AdminRepository } from "./repository";
import { User, AccessLog, UserRole, Prisma, AdminRole } from "@prisma/client";
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
  UpdateUserKycInput,
  UpdateUserOnboardingInput,
  UpdateUserProfileInput,
  GetAdminUsersQuery,
  UpdateAdminRoleInput,
  InviteAdminInput,
  AcceptInvitationInput,
  GetSecurityLogsQuery,
} from "./schemas";

export class AdminService {
  private repository: AdminRepository;

  constructor() {
    this.repository = new AdminRepository();
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

    // Validate that user has required roles for onboarding flags
    const hasInvestorRole = data.roles.includes(UserRole.INVESTOR);
    const hasIssuerRole = data.roles.includes(UserRole.ISSUER);

    // If removing INVESTOR role, reset investor onboarding
    // If removing ISSUER role, reset issuer onboarding
    const updateData: Prisma.UserUpdateInput = { roles: { set: data.roles } };
    if (!hasInvestorRole && user.investor_onboarding_completed) {
      updateData.investor_onboarding_completed = false;
    }
    if (!hasIssuerRole && user.issuer_onboarding_completed) {
      updateData.issuer_onboarding_completed = false;
    }

    const updatedUser = await this.repository.updateUserRoles(userId, data.roles);

    // Create access log for admin action
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);
    await this.repository.createAccessLog({
      userId: adminUserId,
      eventType: "ROLE_ADDED",
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
      },
    });

    return updatedUser;
  }

  /**
   * Update user KYC status
   */
  async updateUserKyc(
    req: Request,
    userId: string,
    data: UpdateUserKycInput,
    adminUserId: string
  ): Promise<User> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const updatedUser = await this.repository.updateUserKyc(userId, data.kycVerified);

    // Create access log for admin action
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);
    await this.repository.createAccessLog({
      userId: adminUserId,
      eventType: "KYC_STATUS_UPDATED",
      portal: "admin",
      ipAddress,
      userAgent,
      deviceInfo,
      deviceType,
      success: true,
      metadata: {
        targetUserId: userId,
        targetUserEmail: user.email,
        kycVerified: data.kycVerified,
        previousKycVerified: user.kyc_verified,
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

    // Create access log for admin action
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);
    await this.repository.createAccessLog({
      userId: adminUserId,
      eventType: "ONBOARDING_STATUS_UPDATED",
      portal: "admin",
      ipAddress,
      userAgent,
      deviceInfo,
      deviceType,
      success: true,
      metadata: {
        targetUserId: userId,
        targetUserEmail: user.email,
        investorOnboarded: data.investorOnboarded,
        issuerOnboarded: data.issuerOnboarded,
        previousInvestorOnboarded: user.investor_onboarding_completed,
        previousIssuerOnboarded: user.issuer_onboarding_completed,
        rolesRemoved: rolesChanged ? user.roles.filter((r) => !updatedRoles.includes(r)) : [],
        newRoles: rolesChanged ? updatedRoles : user.roles,
      },
    });

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
      },
    });

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
      investorsOnboarded: number;
      issuersOnboarded: number;
    }[];
  }> {
    const TREND_PERIOD_DAYS = 30;

    // Get all stats in parallel
    const [totalStats, currentPeriodStats, previousPeriodStats, signupTrends] = await Promise.all([
      this.repository.getUserStats(),
      this.repository.getCurrentPeriodStats(TREND_PERIOD_DAYS),
      this.repository.getPreviousPeriodStats(TREND_PERIOD_DAYS),
      this.repository.getSignupTrends(TREND_PERIOD_DAYS),
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
    };
  }

  /**
   * Update user's 5-letter ID (admin only)
   */
  async updateUserId(userId: string, newUserId: string): Promise<{ user_id: string }> {
    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    // Update user_id and let database unique constraint handle conflicts
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
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
    users: (User & { admin: { role_description: AdminRole; status: string; last_login: Date | null } | null })[];
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
   * Deactivate admin - keeps ADMIN role but sets status to INACTIVE
   * User will not be able to access admin portal until reactivated
   */
  async deactivateAdmin(
    req: Request,
    userId: string,
    deactivatedBy: string
  ): Promise<User> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const admin = await this.repository.getAdminByUserId(userId);
    if (!admin) {
      throw new AppError(404, "NOT_FOUND", "Admin record not found");
    }

    if (admin.status === "INACTIVE") {
      throw new AppError(400, "VALIDATION_ERROR", "Admin is already deactivated");
    }

    // Ensure user has ADMIN role (should already have it, but check to be safe)
    if (!user.roles.includes(UserRole.ADMIN)) {
      const updatedRoles = [...user.roles, UserRole.ADMIN];
      await this.repository.updateUserRoles(userId, updatedRoles);
    }

    // Update admin status to INACTIVE (keeps ADMIN role in user.roles)
    await this.repository.updateAdminStatus(userId, "INACTIVE");

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
   * Reactivate admin - sets status back to ACTIVE
   * User must already have ADMIN role (which is kept during deactivation)
   */
  async reactivateAdmin(
    req: Request,
    userId: string,
    reactivatedBy: string
  ): Promise<User> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const admin = await this.repository.getAdminByUserId(userId);
    if (!admin) {
      throw new AppError(404, "NOT_FOUND", "Admin record not found");
    }

    if (admin.status === "ACTIVE") {
      throw new AppError(400, "VALIDATION_ERROR", "Admin is already active");
    }

    // Ensure user has ADMIN role (should already have it from before deactivation)
    if (!user.roles.includes(UserRole.ADMIN)) {
      const updatedRoles = [...user.roles, UserRole.ADMIN];
      await this.repository.updateUserRoles(userId, updatedRoles);
    }

    // Update admin status to ACTIVE
    await this.repository.updateAdminStatus(userId, "ACTIVE");

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
  ): Promise<{ inviteUrl: string; messageId?: string }> {
    const inviter = await this.repository.getUserById(invitedBy);
    if (!inviter) {
      throw new AppError(404, "NOT_FOUND", "Inviter not found");
    }

    // Generate invitation URL (creates invitation record if needed)
    const { inviteUrl } = await this.generateInvitationUrl(data, invitedBy);

    // Send email via SES only if email is provided
    let messageId: string | undefined;
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
        logger.warn(
          {
            email: data.email,
            roleDescription: data.roleDescription,
            invitedBy,
            error: error instanceof Error ? error.message : String(error),
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

    return { inviteUrl, messageId };
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
  ): Promise<{ user: User; admin: { role_description: AdminRole; status: "ACTIVE" | "INACTIVE" } }> {
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
        throw new AppError(400, "VALIDATION_ERROR", "Link-based invitations require authentication");
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
    let updatedRoles = [...user.roles];
    if (!updatedRoles.includes(UserRole.ADMIN)) {
      updatedRoles.push(UserRole.ADMIN);
      await this.repository.updateUserRoles(user.id, updatedRoles);
    }

    // Create or update Admin record
    let admin = await this.repository.getAdminByUserId(user.id);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/85291801-5a79-4781-80fd-9a72660bf4b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin/service.ts:768',message:'Before admin record check',data:{userId:user.id,adminExists:!!admin,adminStatus:admin?.status || 'N/A'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    if (!admin) {
      admin = await this.repository.createAdmin(user.id, invitation.role_description);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/85291801-5a79-4781-80fd-9a72660bf4b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin/service.ts:771',message:'Created new admin record',data:{userId:user.id,adminStatus:admin.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
    } else {
      // Update role description if different
      if (admin.role_description !== invitation.role_description) {
        admin = await this.repository.updateAdminRole(user.id, invitation.role_description);
      }
      // Ensure status is ACTIVE - CRITICAL: This reactivates deactivated admins
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/85291801-5a79-4781-80fd-9a72660bf4b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin/service.ts:777',message:'Before status update check',data:{userId:user.id,currentStatus:admin.status,needsUpdate:admin.status !== 'ACTIVE'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      if (admin.status !== "ACTIVE") {
        // Update status and use the returned updated admin object
        admin = await this.repository.updateAdminStatus(user.id, "ACTIVE");
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/85291801-5a79-4781-80fd-9a72660bf4b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin/service.ts:779',message:'Updated admin status to ACTIVE',data:{userId:user.id,adminStatus:admin.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
      }
    }

    // Mark invitation as accepted
    await this.repository.acceptAdminInvitation(data.token);

    // Log ROLE_ADDED event
    const { ipAddress, userAgent, deviceInfo } = extractRequestMetadata(req);
    await this.repository.createSecurityLog({
      userId: user.id,
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
    const updatedUser = await this.repository.getUserById(user.id);
    // Refresh admin to ensure we have the latest status (especially after status update)
    const refreshedAdmin = await this.repository.getAdminByUserId(user.id);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/85291801-5a79-4781-80fd-9a72660bf4b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin/service.ts:814',message:'Returning from acceptInvitation',data:{userId:user.id,adminStatus:refreshedAdmin?.status || 'N/A',roleDescription:refreshedAdmin?.role_description || 'N/A'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
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
}
