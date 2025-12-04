import { AdminRepository } from "./repository";
import { User, AccessLog, UserRole } from "@prisma/client";
import { Request } from "express";
import { extractRequestMetadata } from "../../lib/http/request-utils";
import type {
  GetUsersQuery,
  GetAccessLogsQuery,
  UpdateUserRolesInput,
  UpdateUserKycInput,
  UpdateUserOnboardingInput,
  UpdateUserProfileInput,
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
    const updateData: any = { roles: { set: data.roles } };
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
      updatedRoles = updatedRoles.filter(role => role !== UserRole.INVESTOR);
    }

    if (data.issuerOnboarded === false && updatedRoles.includes(UserRole.ISSUER)) {
      updatedRoles = updatedRoles.filter(role => role !== UserRole.ISSUER);
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
		rolesRemoved: rolesChanged ? user.roles.filter(r => !updatedRoles.includes(r)) : [],
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
        updatedFields: Object.keys(data).filter(k => data[k as keyof UpdateUserProfileInput] !== undefined),
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
    logs: (AccessLog & { user: { first_name: string; last_name: string; email: string; roles: UserRole[] } })[];
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
    (AccessLog & { user: { first_name: string; last_name: string; email: string; roles: UserRole[] } })[]
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
          previous: totalStats.totalUsers - currentPeriodStats.totalUsers + previousPeriodStats.totalUsers,
          percentageChange: calculatePercentageChange(
            currentPeriodStats.totalUsers,
            previousPeriodStats.totalUsers
          ),
        },
        investorsOnboarded: {
          current: totalStats.investorsOnboarded,
          previous: totalStats.investorsOnboarded - currentPeriodStats.investorsOnboarded + previousPeriodStats.investorsOnboarded,
          percentageChange: calculatePercentageChange(
            currentPeriodStats.investorsOnboarded,
            previousPeriodStats.investorsOnboarded
          ),
        },
        issuersOnboarded: {
          current: totalStats.issuersOnboarded,
          previous: totalStats.issuersOnboarded - currentPeriodStats.issuersOnboarded + previousPeriodStats.issuersOnboarded,
          percentageChange: calculatePercentageChange(
            currentPeriodStats.issuersOnboarded,
            previousPeriodStats.issuersOnboarded
          ),
        },
      },
      signupTrends,
    };
  }
}

