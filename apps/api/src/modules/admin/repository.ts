import { prisma } from "../../lib/prisma";
import { User, AccessLog, UserRole } from "@prisma/client";
import type { GetUsersQuery, GetAccessLogsQuery } from "./schemas";

export class AdminRepository {
  /**
   * Get users with pagination and filters
   */
  async getUsers(params: GetUsersQuery): Promise<{
    users: User[];
    total: number;
  }> {
    const { page, pageSize, search, role, kycVerified, investorOnboarded, issuerOnboarded } =
      params;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: "insensitive" } },
        { last_name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (role) {
      where.roles = { has: role };
    }

    if (kycVerified !== undefined) {
      where.kyc_verified = kycVerified;
    }

    if (investorOnboarded !== undefined) {
      where.investor_onboarding_completed = investorOnboarded;
    }

    if (issuerOnboarded !== undefined) {
      where.issuer_onboarding_completed = issuerOnboarded;
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

    return { users, total };
  }

  /**
   * Get user by ID with relations
   */
  async getUserById(userId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id: userId },
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
      where: { id: userId },
      data: { roles: { set: roles } },
    });
  }

  /**
   * Update user KYC status
   */
  async updateUserKyc(userId: string, kycVerified: boolean): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { kyc_verified: kycVerified },
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
    const updateData: any = {};

    if (data.investorOnboarded !== undefined) {
      updateData.investor_onboarding_completed = data.investorOnboarded;
    }
    if (data.issuerOnboarded !== undefined) {
      updateData.issuer_onboarding_completed = data.issuerOnboarded;
    }

    if (roles !== undefined) {
      updateData.roles = { set: roles };
    }

    return prisma.user.update({
      where: { id: userId },
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
    const updateData: any = {};

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
      where: { id: userId },
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
    const { page, pageSize, search, eventType, status, dateRange, userId } = params;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = {};

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

    // If search is provided, filter by user name or email
    if (search) {
      where.user = {
        OR: [
          { first_name: { contains: search, mode: "insensitive" } },
          { last_name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
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
  async getAllAccessLogsForExport(
    params: Omit<GetAccessLogsQuery, "page" | "pageSize">
  ): Promise<
    (AccessLog & {
      user: { first_name: string; last_name: string; email: string; roles: UserRole[] };
    })[]
  > {
    const { search, eventType, status, dateRange, userId } = params;

    const where: any = {};

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
        metadata: data.metadata as any,
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
    const where: any = {};

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
          investor_onboarding_completed: true,
        },
      }),
      prisma.user.count({
        where: {
          ...where,
          issuer_onboarding_completed: true,
        },
      }),
    ]);

    return { totalUsers, investorsOnboarded, issuersOnboarded };
  }

  /**
   * Get daily signup trends for the specified number of days
   */
  async getSignupTrends(days: number): Promise<
    {
      date: string;
      totalSignups: number;
      investorsOnboarded: number;
      issuersOnboarded: number;
    }[]
  > {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get all users created in the period
    const users = await prisma.user.findMany({
      where: {
        created_at: {
          gte: startDate,
        },
      },
      select: {
        created_at: true,
        investor_onboarding_completed: true,
        issuer_onboarding_completed: true,
      },
    });

    // Group by date
    const trendMap = new Map<
      string,
      {
        totalSignups: number;
        investorsOnboarded: number;
        issuersOnboarded: number;
      }
    >();

    // Initialize all days in the range
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split("T")[0];
      trendMap.set(dateKey, {
        totalSignups: 0,
        investorsOnboarded: 0,
        issuersOnboarded: 0,
      });
    }

    // Aggregate user data
    for (const user of users) {
      const dateKey = user.created_at.toISOString().split("T")[0];
      const existing = trendMap.get(dateKey);
      if (existing) {
        existing.totalSignups++;
        if (user.investor_onboarding_completed) {
          existing.investorsOnboarded++;
        }
        if (user.issuer_onboarding_completed) {
          existing.issuersOnboarded++;
        }
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
}
