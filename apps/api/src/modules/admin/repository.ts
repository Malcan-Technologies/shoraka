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
    const { page, pageSize, search, role, kycVerified, investorOnboarded, issuerOnboarded } = params;
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
   * Get access logs with pagination and filters
   */
  async getAccessLogs(params: GetAccessLogsQuery): Promise<{
    logs: (AccessLog & { user: { first_name: string; last_name: string; email: string; roles: UserRole[] } })[];
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
  async getAllAccessLogsForExport(params: Omit<GetAccessLogsQuery, "page" | "pageSize">): Promise<
    (AccessLog & { user: { first_name: string; last_name: string; email: string; roles: UserRole[] } })[]
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
}

