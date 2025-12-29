import { prisma } from "../../lib/prisma";
import {
  Prisma,
  User,
  AccessLog,
  UserRole,
  Admin,
  AdminInvitation,
  SecurityLog,
  AdminRole,
  OnboardingLog,
  OrganizationType,
  OnboardingStatus,
} from "@prisma/client";
import type {
  GetUsersQuery,
  GetAccessLogsQuery,
  GetAdminUsersQuery,
  GetSecurityLogsQuery,
  GetOnboardingLogsQuery,
} from "./schemas";

export class AdminRepository {
  /**
   * Get users with pagination and filters
   */
  async getUsers(params: GetUsersQuery): Promise<{
    users: User[];
    total: number;
  }> {
    const { page, pageSize, search, role, investorOnboarded, issuerOnboarded } = params;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: "insensitive" } },
        { last_name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { user_id: { startsWith: search.toUpperCase(), mode: "insensitive" } },
      ];
    }

    if (role) {
      where.roles = { has: role };
    }

    // Filter by organization ownership (investor/issuer onboarded status)
    if (investorOnboarded !== undefined) {
      if (investorOnboarded) {
        where.investor_organizations = { some: {} };
      } else {
        where.investor_organizations = { none: {} };
      }
    }

    if (issuerOnboarded !== undefined) {
      if (issuerOnboarded) {
        where.issuer_organizations = { some: {} };
      } else {
        where.issuer_organizations = { none: {} };
      }
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { created_at: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    // Get organization counts for each user
    const userIds = users.map((u) => u.user_id);
    const [investorCounts, issuerCounts] = await Promise.all([
      prisma.investorOrganization.groupBy({
        by: ["owner_user_id"],
        where: {
          owner_user_id: { in: userIds },
        },
        _count: true,
      }),
      prisma.issuerOrganization.groupBy({
        by: ["owner_user_id"],
        where: {
          owner_user_id: { in: userIds },
        },
        _count: true,
      }),
    ]);

    // Create maps for quick lookup
    const investorCountMap = new Map(
      investorCounts.map((item) => [item.owner_user_id, item._count])
    );
    const issuerCountMap = new Map(issuerCounts.map((item) => [item.owner_user_id, item._count]));

    // Add organization counts to users
    const usersWithCounts = users.map((user) => ({
      ...user,
      investor_organization_count: investorCountMap.get(user.user_id) || 0,
      issuer_organization_count: issuerCountMap.get(user.user_id) || 0,
    }));

    return { users: usersWithCounts, total };
  }

  /**
   * Get user by ID with relations
   */
  async getUserById(userId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { user_id: userId },
      include: {
        _count: {
          select: {
            access_logs: true,
            investments: true,
            loans: true,
          },
        },
      },
    });
  }

  /**
   * Update user roles
   */
  async updateUserRoles(userId: string, roles: UserRole[]): Promise<User> {
    return prisma.user.update({
      where: { user_id: userId },
      data: { roles: { set: roles } },
    });
  }

  /**
   * Update user onboarding status
   */
  async updateUserOnboarding(
    userId: string,
    data: { investorOnboarded?: boolean; issuerOnboarded?: boolean },
    roles?: UserRole[]
  ): Promise<User> {
    const updateData: Prisma.UserUpdateInput = {};

    if (data.investorOnboarded !== undefined) {
      if (data.investorOnboarded) {
        // Set to ['temp'] if not already set (temporary placeholder)
        updateData.investor_account = { set: ["temp"] };
      } else {
        // Clear array
        updateData.investor_account = { set: [] };
      }
    }
    if (data.issuerOnboarded !== undefined) {
      if (data.issuerOnboarded) {
        // Set to ['temp'] if not already set (temporary placeholder)
        updateData.issuer_account = { set: ["temp"] };
      } else {
        // Clear array
        updateData.issuer_account = { set: [] };
      }
    }

    if (roles !== undefined) {
      updateData.roles = roles;
    }

    return prisma.user.update({
      where: { user_id: userId },
      data: updateData,
    });
  }

  /**
   * Update user profile (name, phone)
   */
  async updateUserProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; phone?: string | null }
  ): Promise<User> {
    const updateData: Prisma.UserUpdateInput = {};

    if (data.firstName !== undefined) {
      updateData.first_name = data.firstName;
    }
    if (data.lastName !== undefined) {
      updateData.last_name = data.lastName;
    }
    if (data.phone !== undefined) {
      updateData.phone = data.phone;
    }

    return prisma.user.update({
      where: { user_id: userId },
      data: updateData,
    });
  }

  /**
   * Get access logs with pagination and filters
   */
  async getAccessLogs(params: GetAccessLogsQuery): Promise<{
    logs: (AccessLog & {
      user: { first_name: string; last_name: string; email: string; roles: UserRole[] };
    })[];
    total: number;
  }> {
    const { page, pageSize, search, eventType, eventTypes, status, dateRange, userId } = params;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: Prisma.AccessLogWhereInput = {};

    if (userId) {
      where.user_id = userId;
    }

    // Support both single eventType and multiple eventTypes
    if (eventTypes && eventTypes.length > 0) {
      where.event_type = { in: eventTypes };
    } else if (eventType) {
      where.event_type = eventType;
    }

    if (status) {
      where.success = status === "success";
    }

    if (dateRange && dateRange !== "all") {
      const now = new Date();
      let cutoffDate: Date;

      switch (dateRange) {
        case "24h":
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0);
      }

      where.created_at = { gte: cutoffDate };
    }

    // If search is provided, filter by user name, email, or user_id
    if (search) {
      where.user = {
        OR: [
          { first_name: { contains: search, mode: "insensitive" } },
          { last_name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { user_id: { startsWith: search.toUpperCase(), mode: "insensitive" } },
        ],
      };
    }

    const [logs, total] = await Promise.all([
      prisma.accessLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { created_at: "desc" },
        include: {
          user: {
            select: {
              first_name: true,
              last_name: true,
              email: true,
              roles: true,
            },
          },
        },
      }),
      prisma.accessLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Get access log by ID
   */
  async getAccessLogById(logId: string): Promise<(AccessLog & { user: User }) | null> {
    return prisma.accessLog.findUnique({
      where: { id: logId },
      include: { user: true },
    });
  }

  /**
   * Get all access logs for export (no pagination)
   */
  async getAllAccessLogsForExport(params: Omit<GetAccessLogsQuery, "page" | "pageSize">): Promise<
    (AccessLog & {
      user: { first_name: string; last_name: string; email: string; roles: UserRole[] };
    })[]
  > {
    const { search, eventType, status, dateRange, userId } = params;

    const where: Prisma.AccessLogWhereInput = {};

    if (userId) {
      where.user_id = userId;
    }

    if (eventType) {
      where.event_type = eventType;
    }

    if (status) {
      where.success = status === "success";
    }

    if (dateRange && dateRange !== "all") {
      const now = new Date();
      let cutoffDate: Date;

      switch (dateRange) {
        case "24h":
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0);
      }

      where.created_at = { gte: cutoffDate };
    }

    if (search) {
      where.user = {
        OR: [
          { first_name: { contains: search, mode: "insensitive" } },
          { last_name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { user_id: { startsWith: search.toUpperCase(), mode: "insensitive" } },
        ],
      };
    }

    return prisma.accessLog.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
            email: true,
            roles: true,
          },
        },
      },
    });
  }

  /**
   * Create access log entry (for admin actions)
   */
  async createAccessLog(data: {
    userId: string;
    eventType: string;
    portal?: string;
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: string;
    deviceType?: string;
    success?: boolean;
    metadata?: object;
  }): Promise<AccessLog> {
    return prisma.accessLog.create({
      data: {
        user_id: data.userId,
        event_type: data.eventType,
        portal: data.portal,
        ip_address: data.ipAddress,
        user_agent: data.userAgent,
        device_info: data.deviceInfo,
        device_type: data.deviceType,
        success: data.success ?? true,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Get user statistics for dashboard
   */
  async getUserStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalUsers: number;
    investorsOnboarded: number;
    issuersOnboarded: number;
  }> {
    const where: Prisma.UserWhereInput = {};

    if (startDate && endDate) {
      where.created_at = {
        gte: startDate,
        lt: endDate,
      };
    }

    const [totalUsers, investorsOnboarded, issuersOnboarded] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.count({
        where: {
          ...where,
          investor_account: { isEmpty: false },
        },
      }),
      prisma.user.count({
        where: {
          ...where,
          issuer_account: { isEmpty: false },
        },
      }),
    ]);

    return { totalUsers, investorsOnboarded, issuersOnboarded };
  }

  /**
   * Get organization statistics for dashboard
   */
  async getOrganizationStats(): Promise<{
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
  }> {
    // Get all investor organization counts in parallel
    const [
      investorTotal,
      investorPersonalTotal,
      investorPersonalOnboarded,
      investorCompanyTotal,
      investorCompanyOnboarded,
      issuerTotal,
      issuerPersonalTotal,
      issuerPersonalOnboarded,
      issuerCompanyTotal,
      issuerCompanyOnboarded,
    ] = await Promise.all([
      // Investor organizations
      prisma.investorOrganization.count(),
      prisma.investorOrganization.count({
        where: { type: OrganizationType.PERSONAL },
      }),
      prisma.investorOrganization.count({
        where: { type: OrganizationType.PERSONAL, onboarding_status: OnboardingStatus.COMPLETED },
      }),
      prisma.investorOrganization.count({
        where: { type: OrganizationType.COMPANY },
      }),
      prisma.investorOrganization.count({
        where: { type: OrganizationType.COMPANY, onboarding_status: OnboardingStatus.COMPLETED },
      }),
      // Issuer organizations
      prisma.issuerOrganization.count(),
      prisma.issuerOrganization.count({
        where: { type: OrganizationType.PERSONAL },
      }),
      prisma.issuerOrganization.count({
        where: { type: OrganizationType.PERSONAL, onboarding_status: OnboardingStatus.COMPLETED },
      }),
      prisma.issuerOrganization.count({
        where: { type: OrganizationType.COMPANY },
      }),
      prisma.issuerOrganization.count({
        where: { type: OrganizationType.COMPANY, onboarding_status: OnboardingStatus.COMPLETED },
      }),
    ]);

    return {
      investor: {
        total: investorTotal,
        personal: {
          total: investorPersonalTotal,
          onboarded: investorPersonalOnboarded,
          pending: investorPersonalTotal - investorPersonalOnboarded,
        },
        company: {
          total: investorCompanyTotal,
          onboarded: investorCompanyOnboarded,
          pending: investorCompanyTotal - investorCompanyOnboarded,
        },
      },
      issuer: {
        total: issuerTotal,
        personal: {
          total: issuerPersonalTotal,
          onboarded: issuerPersonalOnboarded,
          pending: issuerPersonalTotal - issuerPersonalOnboarded,
        },
        company: {
          total: issuerCompanyTotal,
          onboarded: issuerCompanyOnboarded,
          pending: issuerCompanyTotal - issuerCompanyOnboarded,
        },
      },
    };
  }

  /**
   * Get daily signup trends for the specified number of days
   * Shows user signups and organization onboarding completions
   */
  async getSignupTrends(days: number): Promise<
    {
      date: string;
      totalSignups: number;
      investorOrgsOnboarded: number;
      issuerOrgsOnboarded: number;
    }[]
  > {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get all data in parallel
    const [users, investorOrgs, issuerOrgs] = await Promise.all([
      // User signups
      prisma.user.findMany({
        where: { created_at: { gte: startDate } },
        select: { created_at: true },
      }),
      // Investor organizations that completed onboarding
      prisma.investorOrganization.findMany({
        where: {
          onboarding_status: OnboardingStatus.COMPLETED,
          updated_at: { gte: startDate },
        },
        select: { updated_at: true },
      }),
      // Issuer organizations that completed onboarding
      prisma.issuerOrganization.findMany({
        where: {
          onboarding_status: OnboardingStatus.COMPLETED,
          updated_at: { gte: startDate },
        },
        select: { updated_at: true },
      }),
    ]);

    // Group by date
    const trendMap = new Map<
      string,
      {
        totalSignups: number;
        investorOrgsOnboarded: number;
        issuerOrgsOnboarded: number;
      }
    >();

    // Initialize all days in the range
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split("T")[0];
      trendMap.set(dateKey, {
        totalSignups: 0,
        investorOrgsOnboarded: 0,
        issuerOrgsOnboarded: 0,
      });
    }

    // Aggregate user signups
    for (const user of users) {
      const dateKey = user.created_at.toISOString().split("T")[0];
      const existing = trendMap.get(dateKey);
      if (existing) {
        existing.totalSignups++;
      }
    }

    // Aggregate investor org onboardings
    for (const org of investorOrgs) {
      const dateKey = org.updated_at.toISOString().split("T")[0];
      const existing = trendMap.get(dateKey);
      if (existing) {
        existing.investorOrgsOnboarded++;
      }
    }

    // Aggregate issuer org onboardings
    for (const org of issuerOrgs) {
      const dateKey = org.updated_at.toISOString().split("T")[0];
      const existing = trendMap.get(dateKey);
      if (existing) {
        existing.issuerOrgsOnboarded++;
      }
    }

    // Convert to array and sort by date ascending
    return Array.from(trendMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get user stats for a previous period (for trend calculation)
   */
  async getPreviousPeriodStats(days: number): Promise<{
    totalUsers: number;
    investorsOnboarded: number;
    issuersOnboarded: number;
  }> {
    const now = new Date();
    const currentPeriodStart = new Date();
    currentPeriodStart.setDate(now.getDate() - days);
    currentPeriodStart.setHours(0, 0, 0, 0);

    const previousPeriodStart = new Date(currentPeriodStart);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - days);

    return this.getUserStats(previousPeriodStart, currentPeriodStart);
  }

  /**
   * Get current period user stats (for trend calculation)
   */
  async getCurrentPeriodStats(days: number): Promise<{
    totalUsers: number;
    investorsOnboarded: number;
    issuersOnboarded: number;
  }> {
    const now = new Date();
    const currentPeriodStart = new Date();
    currentPeriodStart.setDate(now.getDate() - days);
    currentPeriodStart.setHours(0, 0, 0, 0);

    return this.getUserStats(currentPeriodStart, now);
  }

  /**
   * Get admin users with pagination and filters
   * Shows users who have an admin record (regardless of whether they currently have ADMIN role)
   */
  async getAdminUsers(params: GetAdminUsersQuery): Promise<{
    users: (User & { admin: Admin | null })[];
    total: number;
  }> {
    const { page, pageSize, search, roleDescription, status } = params;
    const skip = (page - 1) * pageSize;

    // Filter by users who have an admin record (not by ADMIN role)
    // This ensures deactivated admins still appear in the list
    const adminWhere: Prisma.AdminWhereInput = {};

    if (roleDescription) {
      adminWhere.role_description = roleDescription;
    }
    if (status) {
      adminWhere.status = status;
    }

    const where: Prisma.UserWhereInput = {
      admin: Object.keys(adminWhere).length > 0 ? adminWhere : { isNot: null },
    };

    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: "insensitive" } },
        { last_name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { user_id: { startsWith: search.toUpperCase(), mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { created_at: "desc" },
        include: {
          admin: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  /**
   * Get Admin record by user ID
   */
  async getAdminByUserId(userId: string): Promise<Admin | null> {
    return prisma.admin.findUnique({
      where: { user_id: userId },
    });
  }

  /**
   * Create Admin record
   */
  async createAdmin(userId: string, roleDescription: AdminRole): Promise<Admin> {
    return prisma.admin.create({
      data: {
        user_id: userId,
        role_description: roleDescription,
        status: "ACTIVE",
      },
    });
  }

  /**
   * Update admin role description
   */
  async updateAdminRole(userId: string, roleDescription: AdminRole): Promise<Admin> {
    return prisma.admin.update({
      where: { user_id: userId },
      data: { role_description: roleDescription },
    });
  }

  /**
   * Update admin status
   */
  async updateAdminStatus(userId: string, status: "ACTIVE" | "INACTIVE"): Promise<Admin> {
    return prisma.admin.update({
      where: { user_id: userId },
      data: { status },
    });
  }

  /**
   * Update admin last login
   */
  async updateAdminLastLogin(userId: string): Promise<Admin> {
    return prisma.admin.update({
      where: { user_id: userId },
      data: { last_login: new Date() },
    });
  }

  /**
   * Create admin invitation
   */
  async createAdminInvitation(data: {
    email: string;
    roleDescription: AdminRole;
    token: string;
    expiresAt: Date;
    invitedByUserId: string;
  }): Promise<AdminInvitation> {
    return prisma.adminInvitation.create({
      data: {
        email: data.email,
        role_description: data.roleDescription,
        token: data.token,
        expires_at: data.expiresAt,
        invited_by_user_id: data.invitedByUserId,
      },
    });
  }

  /**
   * Get admin invitation by token
   */
  async getAdminInvitationByToken(token: string): Promise<AdminInvitation | null> {
    return prisma.adminInvitation.findUnique({
      where: { token },
    });
  }

  /**
   * Mark invitation as accepted
   */
  async acceptAdminInvitation(token: string): Promise<AdminInvitation> {
    return prisma.adminInvitation.update({
      where: { token },
      data: {
        accepted: true,
        accepted_at: new Date(),
      },
    });
  }

  /**
   * Get pending admin invitations (not accepted, not expired)
   */
  async getPendingInvitations(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    roleDescription?: AdminRole;
  }): Promise<{
    invitations: (AdminInvitation & {
      invited_by: { first_name: string; last_name: string; email: string };
    })[];
    pagination: {
      currentPage: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const where: {
      accepted: boolean;
      expires_at: { gt: Date };
      role_description?: AdminRole;
      OR?: Array<{
        email?: { contains: string; mode: "insensitive" };
      }>;
    } = {
      accepted: false,
      expires_at: { gt: new Date() },
    };

    if (params?.roleDescription) {
      where.role_description = params.roleDescription;
    }

    if (params?.search) {
      where.OR = [{ email: { contains: params.search, mode: "insensitive" as const } }];
    }

    const [invitations, totalCount] = await Promise.all([
      prisma.adminInvitation.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { created_at: "desc" },
        include: {
          invited_by: {
            select: {
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      }),
      prisma.adminInvitation.count({ where }),
    ]);

    return {
      invitations,
      pagination: {
        currentPage: page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    };
  }

  /**
   * Get admin invitation by ID
   */
  async getAdminInvitationById(id: string): Promise<AdminInvitation | null> {
    return prisma.adminInvitation.findUnique({
      where: { id },
    });
  }

  /**
   * Delete admin invitation
   */
  async deleteAdminInvitation(id: string): Promise<void> {
    await prisma.adminInvitation.delete({
      where: { id },
    });
  }

  /**
   * Create security log entry
   */
  async createSecurityLog(data: {
    userId: string;
    eventType: string;
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: string;
    metadata?: object;
  }): Promise<SecurityLog> {
    return prisma.securityLog.create({
      data: {
        user_id: data.userId,
        event_type: data.eventType,
        ip_address: data.ipAddress,
        user_agent: data.userAgent,
        device_info: data.deviceInfo,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Get security logs with pagination and filters
   */
  async getSecurityLogs(params: GetSecurityLogsQuery): Promise<{
    logs: (SecurityLog & {
      user: { first_name: string; last_name: string; email: string; roles: UserRole[] };
    })[];
    total: number;
  }> {
    const { page, pageSize, search, eventType, eventTypes, dateRange, userId } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SecurityLogWhereInput = {};

    if (userId) {
      where.user_id = userId;
    }

    if (eventTypes && eventTypes.length > 0) {
      where.event_type = { in: eventTypes };
    } else if (eventType) {
      where.event_type = eventType;
    }

    if (dateRange && dateRange !== "all") {
      const now = new Date();
      let cutoffDate: Date;

      switch (dateRange) {
        case "24h":
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0);
      }

      where.created_at = { gte: cutoffDate };
    }

    if (search) {
      where.user = {
        OR: [
          { first_name: { contains: search, mode: "insensitive" } },
          { last_name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { user_id: { startsWith: search.toUpperCase(), mode: "insensitive" } },
        ],
      };
    }

    const [logs, total] = await Promise.all([
      prisma.securityLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { created_at: "desc" },
        include: {
          user: {
            select: {
              first_name: true,
              last_name: true,
              email: true,
              roles: true,
            },
          },
        },
      }),
      prisma.securityLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Create onboarding log
   */
  async createOnboardingLog(data: {
    userId: string;
    role: UserRole;
    eventType: string;
    portal?: string;
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: string;
    deviceType?: string;
    metadata?: object;
  }): Promise<OnboardingLog> {
    return prisma.onboardingLog.create({
      data: {
        user_id: data.userId,
        role: data.role,
        event_type: data.eventType,
        portal: data.portal,
        ip_address: data.ipAddress,
        user_agent: data.userAgent,
        device_info: data.deviceInfo,
        device_type: data.deviceType,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Get onboarding logs with pagination and filters
   */
  async getOnboardingLogs(params: GetOnboardingLogsQuery): Promise<{
    logs: (OnboardingLog & {
      user: { first_name: string; last_name: string; email: string; roles: UserRole[] };
    })[];
    total: number;
  }> {
    const { page, pageSize, search, eventType, eventTypes, role, dateRange, userId } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.OnboardingLogWhereInput = {};

    if (userId) {
      where.user_id = userId;
    }

    if (role) {
      where.role = role;
    }

    if (eventTypes && eventTypes.length > 0) {
      where.event_type = { in: eventTypes };
    } else if (eventType) {
      where.event_type = eventType;
    }

    if (dateRange && dateRange !== "all") {
      const now = new Date();
      let cutoffDate: Date;

      switch (dateRange) {
        case "24h":
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0);
      }

      where.created_at = { gte: cutoffDate };
    }

    if (search) {
      where.user = {
        OR: [
          { first_name: { contains: search, mode: "insensitive" } },
          { last_name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { user_id: { startsWith: search.toUpperCase(), mode: "insensitive" } },
        ],
      };
    }

    const [logs, total] = await Promise.all([
      prisma.onboardingLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { created_at: "desc" },
        include: {
          user: {
            select: {
              first_name: true,
              last_name: true,
              email: true,
              roles: true,
            },
          },
        },
      }),
      prisma.onboardingLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Get onboarding log by ID
   */
  async getOnboardingLogById(logId: string): Promise<(OnboardingLog & { user: User }) | null> {
    return prisma.onboardingLog.findUnique({
      where: { id: logId },
      include: {
        user: true,
      },
    });
  }

  /**
   * Get all onboarding logs for export (no pagination)
   */
  async getAllOnboardingLogsForExport(
    params: Omit<GetOnboardingLogsQuery, "page" | "pageSize">
  ): Promise<
    (OnboardingLog & {
      user: { first_name: string; last_name: string; email: string; roles: UserRole[] };
    })[]
  > {
    const { search, eventType, eventTypes, role, dateRange, userId } = params;

    const where: Prisma.OnboardingLogWhereInput = {};

    if (userId) {
      where.user_id = userId;
    }

    if (role) {
      where.role = role;
    }

    if (eventTypes && eventTypes.length > 0) {
      where.event_type = { in: eventTypes };
    } else if (eventType) {
      where.event_type = eventType;
    }

    if (dateRange && dateRange !== "all") {
      const now = new Date();
      let cutoffDate: Date;

      switch (dateRange) {
        case "24h":
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0);
      }

      where.created_at = { gte: cutoffDate };
    }

    if (search) {
      where.user = {
        OR: [
          { first_name: { contains: search, mode: "insensitive" } },
          { last_name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { user_id: { startsWith: search.toUpperCase(), mode: "insensitive" } },
        ],
      };
    }

    return prisma.onboardingLog.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
            email: true,
            roles: true,
          },
        },
      },
    });
  }

  /**
   * Get all security logs for export (no pagination)
   */
  async getAllSecurityLogsForExport(
    params: Omit<GetSecurityLogsQuery, "page" | "pageSize">
  ): Promise<
    (SecurityLog & {
      user: { first_name: string; last_name: string; email: string; roles: UserRole[] };
    })[]
  > {
    const { search, eventType, eventTypes, dateRange, userId } = params;

    const where: Prisma.SecurityLogWhereInput = {};

    if (userId) {
      where.user_id = userId;
    }

    if (eventTypes && eventTypes.length > 0) {
      where.event_type = { in: eventTypes };
    } else if (eventType) {
      where.event_type = eventType;
    }

    if (dateRange && dateRange !== "all") {
      const now = new Date();
      let cutoffDate: Date;

      switch (dateRange) {
        case "24h":
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0);
      }

      where.created_at = { gte: cutoffDate };
    }

    if (search) {
      where.user = {
        OR: [
          { first_name: { contains: search, mode: "insensitive" } },
          { last_name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { user_id: { startsWith: search.toUpperCase(), mode: "insensitive" } },
        ],
      };
    }

    return prisma.securityLog.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
            email: true,
            roles: true,
          },
        },
      },
    });
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
    onboardingStatus?: "PENDING" | "IN_PROGRESS" | "PENDING_APPROVAL" | "PENDING_AML" | "COMPLETED";
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
        | "COMPLETED";
      onboardedAt: Date | null;
      owner: {
        userId: string;
        email: string;
        firstName: string;
        lastName: string;
      };
      memberCount: number;
      createdAt: Date;
      updatedAt: Date;
    }[];
    total: number;
  }> {
    const { page, pageSize, search, portal, type, onboardingStatus } = params;

    // Build where clauses for both tables
    // Using a generic type that works for both InvestorOrganization and IssuerOrganization
    const buildWhere = (): Prisma.InvestorOrganizationWhereInput => {
      const where: Prisma.InvestorOrganizationWhereInput = {};

      if (type) {
        where.type = type as OrganizationType;
      }

      if (onboardingStatus) {
        where.onboarding_status = onboardingStatus as OnboardingStatus;
      }

      if (search) {
        // Split search into words and require all words to match somewhere
        const searchTerms = search.trim().split(/\s+/).filter(Boolean);

        if (searchTerms.length === 1) {
          // Single word: match against any field
          const term = searchTerms[0];
          where.OR = [
            { name: { contains: term, mode: "insensitive" } },
            { registration_number: { contains: term, mode: "insensitive" } },
            { owner: { first_name: { contains: term, mode: "insensitive" } } },
            { owner: { last_name: { contains: term, mode: "insensitive" } } },
            { owner: { email: { contains: term, mode: "insensitive" } } },
          ];
        } else {
          // Multiple words: each word must match at least one field (AND logic)
          where.AND = searchTerms.map((term) => ({
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { registration_number: { contains: term, mode: "insensitive" } },
              { owner: { first_name: { contains: term, mode: "insensitive" } } },
              { owner: { last_name: { contains: term, mode: "insensitive" } } },
              { owner: { email: { contains: term, mode: "insensitive" } } },
            ],
          }));
        }
      }

      return where;
    };

    const where = buildWhere();
    const include = {
      owner: {
        select: {
          user_id: true,
          email: true,
          first_name: true,
          last_name: true,
        },
      },
      _count: {
        select: { members: true },
      },
    };

    // Fetch from both tables based on portal filter
    let investorOrgs: Array<{
      id: string;
      type: OrganizationType;
      name: string | null;
      registration_number: string | null;
      onboarding_status: OnboardingStatus;
      onboarded_at: Date | null;
      is_sophisticated_investor: boolean;
      created_at: Date;
      updated_at: Date;
      owner: { user_id: string | null; email: string; first_name: string; last_name: string };
      _count: { members: number };
    }> = [];
    let issuerOrgs: Array<{
      id: string;
      type: OrganizationType;
      name: string | null;
      registration_number: string | null;
      onboarding_status: OnboardingStatus;
      onboarded_at: Date | null;
      created_at: Date;
      updated_at: Date;
      owner: { user_id: string | null; email: string; first_name: string; last_name: string };
      _count: { members: number };
    }> = [];
    let investorCount = 0;
    let issuerCount = 0;

    if (!portal || portal === "investor") {
      [investorOrgs, investorCount] = await Promise.all([
        prisma.investorOrganization.findMany({
          where,
          include,
          orderBy: { created_at: "desc" },
        }),
        prisma.investorOrganization.count({ where }),
      ]);
    }

    if (!portal || portal === "issuer") {
      // Cast where to IssuerOrganizationWhereInput since the structure is identical
      const issuerWhere = where as Prisma.IssuerOrganizationWhereInput;
      [issuerOrgs, issuerCount] = await Promise.all([
        prisma.issuerOrganization.findMany({
          where: issuerWhere,
          include,
          orderBy: { created_at: "desc" },
        }),
        prisma.issuerOrganization.count({ where: issuerWhere }),
      ]);
    }

    // Combine and transform results
    const allOrgs = [
      ...investorOrgs.map((org) => ({
        id: org.id,
        portal: "investor" as const,
        type: org.type as "PERSONAL" | "COMPANY",
        name: org.name,
        registrationNumber: org.registration_number,
        onboardingStatus: org.onboarding_status as
          | "PENDING"
          | "IN_PROGRESS"
          | "PENDING_APPROVAL"
          | "PENDING_AML"
          | "COMPLETED",
        onboardedAt: org.onboarded_at,
        owner: {
          userId: org.owner.user_id || "",
          email: org.owner.email,
          firstName: org.owner.first_name,
          lastName: org.owner.last_name,
        },
        memberCount: org._count.members,
        isSophisticatedInvestor: org.is_sophisticated_investor,
        createdAt: org.created_at,
        updatedAt: org.updated_at,
      })),
      ...issuerOrgs.map((org) => ({
        id: org.id,
        portal: "issuer" as const,
        type: org.type as "PERSONAL" | "COMPANY",
        name: org.name,
        registrationNumber: org.registration_number,
        onboardingStatus: org.onboarding_status as
          | "PENDING"
          | "IN_PROGRESS"
          | "PENDING_APPROVAL"
          | "PENDING_AML"
          | "COMPLETED",
        onboardedAt: org.onboarded_at,
        owner: {
          userId: org.owner.user_id || "",
          email: org.owner.email,
          firstName: org.owner.first_name,
          lastName: org.owner.last_name,
        },
        memberCount: org._count.members,
        isSophisticatedInvestor: false, // Issuers don't have sophisticated investor status
        createdAt: org.created_at,
        updatedAt: org.updated_at,
      })),
    ];

    // Sort by created_at desc
    allOrgs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const skip = (page - 1) * pageSize;
    const paginatedOrgs = allOrgs.slice(skip, skip + pageSize);

    return {
      organizations: paginatedOrgs,
      total: investorCount + issuerCount,
    };
  }

  /**
   * Get a single organization by portal type and ID with full details
   */
  async getOrganizationById(
    portal: "investor" | "issuer",
    id: string
  ): Promise<{
    id: string;
    type: OrganizationType;
    name: string | null;
    registration_number: string | null;
    onboarding_status: OnboardingStatus;
    onboarded_at: Date | null;
    created_at: Date;
    updated_at: Date;
    // RegTank extracted data
    first_name: string | null;
    last_name: string | null;
    middle_name: string | null;
    nationality: string | null;
    country: string | null;
    id_issuing_country: string | null;
    gender: string | null;
    address: string | null;
    date_of_birth: Date | null;
    phone_number: string | null;
    document_type: string | null;
    document_number: string | null;
    kyc_id: string | null;
    bank_account_details: unknown;
    wealth_declaration: unknown;
    compliance_declaration: unknown;
    document_info: unknown;
    liveness_check_info: unknown;
    // Sophisticated investor status (only for investor portal)
    is_sophisticated_investor?: boolean;
    owner: {
      user_id: string;
      email: string;
      first_name: string;
      last_name: string;
    };
    members: {
      id: string;
      user_id: string;
      role: string;
      created_at: Date;
      user: {
        first_name: string;
        last_name: string;
        email: string;
      };
    }[];
    // Latest RegTank onboarding record (for portal link)
    regtank_onboarding: {
      request_id: string;
      status: string;
    }[];
  } | null> {
    const include = {
      owner: {
        select: {
          user_id: true,
          email: true,
          first_name: true,
          last_name: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      },
      regtank_onboarding: {
        select: {
          request_id: true,
          status: true,
        },
        orderBy: { created_at: "desc" as const },
        take: 1,
      },
    };

    if (portal === "investor") {
      return prisma.investorOrganization.findUnique({
        where: { id },
        include,
      });
    } else {
      return prisma.issuerOrganization.findUnique({
        where: { id },
        include,
      });
    }
  }

  /**
   * Get onboarding operations metrics for the dashboard
   * Uses investor_organizations and issuer_organizations tables as source of truth
   *
   * Categories (based on organization onboarding_status):
   * - inProgress: PENDING or IN_PROGRESS (user still completing onboarding)
   * - pending: PENDING_APPROVAL or PENDING_AML (waiting for admin action)
   * - approved: COMPLETED (onboarding fully complete, has onboarded_at date)
   * - rejected: Count from regtank_onboarding (not tracked at org level)
   * - expired: Count from regtank_onboarding (not tracked at org level)
   *
   * Average time to approval: created_at to onboarded_at
   */
  async getOnboardingOperationsMetrics(): Promise<{
    inProgress: number;
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
    avgTimeToApprovalMinutes: number | null;
    avgTimeToApprovalChangePercent: number | null;
    avgTimeToOnboardingMinutes: number | null;
    avgTimeToOnboardingChangePercent: number | null;
  }> {
    // Count organizations by onboarding_status from both investor and issuer tables
    const [
      investorInProgress,
      investorPending,
      investorApproved,
      issuerInProgress,
      issuerPending,
      issuerApproved,
      rejectedCount,
      expiredCount,
    ] = await Promise.all([
      // Investor: In Progress (PENDING or IN_PROGRESS)
      prisma.investorOrganization.count({
        where: {
          onboarding_status: {
            in: [OnboardingStatus.PENDING, OnboardingStatus.IN_PROGRESS],
          },
        },
      }),
      // Investor: Pending admin action (PENDING_APPROVAL or PENDING_AML)
      prisma.investorOrganization.count({
        where: {
          onboarding_status: {
            in: [OnboardingStatus.PENDING_APPROVAL, OnboardingStatus.PENDING_AML],
          },
        },
      }),
      // Investor: Approved/Completed
      prisma.investorOrganization.count({
        where: {
          onboarding_status: OnboardingStatus.COMPLETED,
        },
      }),
      // Issuer: In Progress (PENDING or IN_PROGRESS)
      prisma.issuerOrganization.count({
        where: {
          onboarding_status: {
            in: [OnboardingStatus.PENDING, OnboardingStatus.IN_PROGRESS],
          },
        },
      }),
      // Issuer: Pending admin action (PENDING_APPROVAL or PENDING_AML)
      prisma.issuerOrganization.count({
        where: {
          onboarding_status: {
            in: [OnboardingStatus.PENDING_APPROVAL, OnboardingStatus.PENDING_AML],
          },
        },
      }),
      // Issuer: Approved/Completed
      prisma.issuerOrganization.count({
        where: {
          onboarding_status: OnboardingStatus.COMPLETED,
        },
      }),
      // Rejected: Count from organization tables using the REJECTED onboarding status
      Promise.all([
        prisma.investorOrganization.count({
          where: { onboarding_status: OnboardingStatus.REJECTED },
        }),
        prisma.issuerOrganization.count({
          where: { onboarding_status: OnboardingStatus.REJECTED },
        }),
      ]).then(([investor, issuer]) => investor + issuer),
      // Expired: Only tracked in regtank_onboarding (organizations don't have EXPIRED status)
      prisma.regTankOnboarding.count({
        where: { status: "EXPIRED" },
      }),
    ]);

    // Combine counts from both portals
    const inProgressCount = investorInProgress + issuerInProgress;
    const pendingCount = investorPending + issuerPending;
    const approvedCount = investorApproved + issuerApproved;

    // Calculate average time to approval for completed organizations
    // Time is measured from created_at to onboarded_at
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Get completed organizations from current period (last 30 days)
    // Include regtank_onboarding to get completed_at for approval time calculation
    // Use admin_approved_at as fallback filter since onboarded_at might not be set on older records
    // Exclude records where both timestamps are null (shouldn't happen for COMPLETED, but just in case)
    const [currentInvestorCompleted, currentIssuerCompleted] = await Promise.all([
      prisma.investorOrganization.findMany({
        where: {
          onboarding_status: OnboardingStatus.COMPLETED,
          OR: [{ onboarded_at: { not: null } }, { admin_approved_at: { not: null } }],
          AND: {
            OR: [
              { onboarded_at: { gte: thirtyDaysAgo } },
              { admin_approved_at: { gte: thirtyDaysAgo } },
            ],
          },
        },
        select: {
          created_at: true,
          onboarded_at: true,
          admin_approved_at: true,
          regtank_onboarding: {
            where: { status: "APPROVED" },
            orderBy: { completed_at: "desc" },
            take: 1,
            select: { completed_at: true },
          },
        },
      }),
      prisma.issuerOrganization.findMany({
        where: {
          onboarding_status: OnboardingStatus.COMPLETED,
          OR: [{ onboarded_at: { not: null } }, { admin_approved_at: { not: null } }],
          AND: {
            OR: [
              { onboarded_at: { gte: thirtyDaysAgo } },
              { admin_approved_at: { gte: thirtyDaysAgo } },
            ],
          },
        },
        select: {
          created_at: true,
          onboarded_at: true,
          admin_approved_at: true,
          regtank_onboarding: {
            where: { status: "APPROVED" },
            orderBy: { completed_at: "desc" },
            take: 1,
            select: { completed_at: true },
          },
        },
      }),
    ]);

    const currentPeriodCompleted = [...currentInvestorCompleted, ...currentIssuerCompleted];

    // Get completed organizations from previous period (30-60 days ago)
    // Use admin_approved_at as fallback filter since onboarded_at might not be set on older records
    // Exclude records where both timestamps are null
    const [previousInvestorCompleted, previousIssuerCompleted] = await Promise.all([
      prisma.investorOrganization.findMany({
        where: {
          onboarding_status: OnboardingStatus.COMPLETED,
          OR: [{ onboarded_at: { not: null } }, { admin_approved_at: { not: null } }],
          AND: {
            OR: [
              { onboarded_at: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
              { admin_approved_at: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
            ],
          },
        },
        select: {
          created_at: true,
          onboarded_at: true,
          admin_approved_at: true,
          regtank_onboarding: {
            where: { status: "APPROVED" },
            orderBy: { completed_at: "desc" },
            take: 1,
            select: { completed_at: true },
          },
        },
      }),
      prisma.issuerOrganization.findMany({
        where: {
          onboarding_status: OnboardingStatus.COMPLETED,
          OR: [{ onboarded_at: { not: null } }, { admin_approved_at: { not: null } }],
          AND: {
            OR: [
              { onboarded_at: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
              { admin_approved_at: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
            ],
          },
        },
        select: {
          created_at: true,
          onboarded_at: true,
          admin_approved_at: true,
          regtank_onboarding: {
            where: { status: "APPROVED" },
            orderBy: { completed_at: "desc" },
            take: 1,
            select: { completed_at: true },
          },
        },
      }),
    ]);

    const previousPeriodCompleted = [...previousInvestorCompleted, ...previousIssuerCompleted];

    // Calculate average time to approval (regtank completed_at to admin_approved_at)
    // This measures how long admin takes to approve after RegTank completes
    let avgTimeToApprovalMinutes: number | null = null;
    const currentWithApproval = currentPeriodCompleted.filter(
      (org) => org.admin_approved_at && org.regtank_onboarding[0]?.completed_at
    );
    if (currentWithApproval.length > 0) {
      const totalMinutes = currentWithApproval.reduce((sum, org) => {
        const regtankCompletedAt = org.regtank_onboarding[0]!.completed_at!;
        const diffMs = org.admin_approved_at!.getTime() - regtankCompletedAt.getTime();
        return sum + diffMs / 1000 / 60;
      }, 0);
      avgTimeToApprovalMinutes = Math.round(totalMinutes / currentWithApproval.length);
    }

    // Calculate average time to approval change percent
    let avgTimeToApprovalChangePercent: number | null = null;
    const previousWithApproval = previousPeriodCompleted.filter(
      (org) => org.admin_approved_at && org.regtank_onboarding[0]?.completed_at
    );
    if (previousWithApproval.length > 0 && avgTimeToApprovalMinutes !== null) {
      const previousTotalMinutes = previousWithApproval.reduce((sum, org) => {
        const regtankCompletedAt = org.regtank_onboarding[0]!.completed_at!;
        const diffMs = org.admin_approved_at!.getTime() - regtankCompletedAt.getTime();
        return sum + diffMs / 1000 / 60;
      }, 0);
      const previousAvg = previousTotalMinutes / previousWithApproval.length;
      if (previousAvg > 0) {
        avgTimeToApprovalChangePercent = Math.round(
          ((avgTimeToApprovalMinutes - previousAvg) / previousAvg) * 100
        );
      }
    }

    // Calculate average time to onboarding (created_at to onboarded_at or admin_approved_at)
    // This measures total time from organization creation to fully onboarded
    // Use admin_approved_at as fallback for older records where onboarded_at might not be set
    let avgTimeToOnboardingMinutes: number | null = null;
    const currentWithOnboarding = currentPeriodCompleted.filter(
      (org) => org.onboarded_at || org.admin_approved_at
    );
    if (currentWithOnboarding.length > 0) {
      const totalMinutes = currentWithOnboarding.reduce((sum, org) => {
        const completedAt = org.onboarded_at || org.admin_approved_at;
        const diffMs = completedAt!.getTime() - org.created_at.getTime();
        return sum + diffMs / 1000 / 60;
      }, 0);
      avgTimeToOnboardingMinutes = Math.round(totalMinutes / currentWithOnboarding.length);
    }

    // Calculate average time to onboarding change percent
    let avgTimeToOnboardingChangePercent: number | null = null;
    const previousWithOnboarding = previousPeriodCompleted.filter(
      (org) => org.onboarded_at || org.admin_approved_at
    );
    if (previousWithOnboarding.length > 0 && avgTimeToOnboardingMinutes !== null) {
      const previousTotalMinutes = previousWithOnboarding.reduce((sum, org) => {
        const completedAt = org.onboarded_at || org.admin_approved_at;
        const diffMs = completedAt!.getTime() - org.created_at.getTime();
        return sum + diffMs / 1000 / 60;
      }, 0);
      const previousAvg = previousTotalMinutes / previousWithOnboarding.length;
      if (previousAvg > 0) {
        avgTimeToOnboardingChangePercent = Math.round(
          ((avgTimeToOnboardingMinutes - previousAvg) / previousAvg) * 100
        );
      }
    }

    return {
      inProgress: inProgressCount,
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      expired: expiredCount,
      avgTimeToApprovalMinutes,
      avgTimeToApprovalChangePercent,
      avgTimeToOnboardingMinutes,
      avgTimeToOnboardingChangePercent,
    };
  }
}
