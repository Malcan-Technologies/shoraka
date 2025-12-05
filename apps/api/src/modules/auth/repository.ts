import { prisma } from "../../lib/prisma";
import { User, UserRole, AccessLog, UserSession } from "@prisma/client";

export class AuthRepository {
  /**
   * Find user by Cognito sub
   */
  async findUserByCognitoSub(cognitoSub: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { cognito_sub: cognitoSub },
    });
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Create or update user (upsert by cognito_sub)
   */
  async upsertUser(data: {
    cognitoSub: string;
    cognitoUsername: string;
    email: string;
    emailVerified: boolean;
    roles: UserRole[];
    firstName?: string;
    lastName?: string;
    phone?: string;
  }): Promise<User> {
    return prisma.user.upsert({
      where: { cognito_sub: data.cognitoSub },
      create: {
        cognito_sub: data.cognitoSub,
        cognito_username: data.cognitoUsername,
        email: data.email,
        email_verified: data.emailVerified,
        roles: data.roles,
        first_name: data.firstName || "",
        last_name: data.lastName || "",
        phone: data.phone,
      },
      update: {
        cognito_username: data.cognitoUsername,
        email: data.email,
        email_verified: data.emailVerified,
        roles: data.roles,
        ...(data.firstName && { first_name: data.firstName }),
        ...(data.lastName && { last_name: data.lastName }),
        ...(data.phone && { phone: data.phone }),
      },
    });
  }

  /**
   * Add role to user
   */
  async addRoleToUser(userId: string, role: UserRole): Promise<User> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      throw new Error("User not found");
    }
    
    if (user.roles.includes(role)) {
      return user; // Role already exists
    }
    
    // Prisma doesn't support push for arrays - need to use set with full array
    return prisma.user.update({
      where: { id: userId },
      data: {
        roles: {
          set: [...user.roles, role],
        },
      },
    });
  }

  /**
   * Update onboarding status for a specific role
   */
  async updateOnboardingStatus(userId: string, role: UserRole, completed: boolean): Promise<User> {
    const updateData: Record<string, boolean> = {};
    
    if (role === UserRole.INVESTOR) {
      updateData.investor_onboarding_completed = completed;
    } else if (role === UserRole.ISSUER) {
      updateData.issuer_onboarding_completed = completed;
    } else if (role === UserRole.ADMIN) {
      // ADMIN doesn't require onboarding, but we'll still log it
      // No database field to update for ADMIN
      return prisma.user.findUniqueOrThrow({ where: { id: userId } });
    }
    
    if (Object.keys(updateData).length === 0) {
      throw new Error(`Invalid role for onboarding update: ${role}`);
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
    const updateData: Record<string, string | null> = {};

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
   * Update password changed timestamp
   */
  async updatePasswordChangedAt(userId: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { password_changed_at: new Date() },
    });
  }

  /**
   * Create access log entry
   */
  async createAccessLog(data: {
    userId: string;
    eventType: string;
    portal?: string;
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: string;
    deviceType?: string;
    cognitoEvent?: object;
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
        cognito_event: data.cognitoEvent as any,
        success: data.success ?? true,
        metadata: data.metadata as any,
      },
    });
  }

  /**
   * Create or update user session
   */
  async upsertUserSession(data: {
    userId: string;
    cognitoSession: string;
    ipAddress?: string;
    deviceInfo?: string;
    activeRole?: UserRole;
    expiresAt: Date;
  }): Promise<UserSession> {
    return prisma.userSession.upsert({
      where: { cognito_session: data.cognitoSession },
      create: {
        user_id: data.userId,
        cognito_session: data.cognitoSession,
        ip_address: data.ipAddress,
        device_info: data.deviceInfo,
        active_role: data.activeRole,
        expires_at: data.expiresAt,
      },
      update: {
        ip_address: data.ipAddress,
        device_info: data.deviceInfo,
        active_role: data.activeRole,
        last_activity: new Date(),
        expires_at: data.expiresAt,
      },
    });
  }

  /**
   * Update session active role
   */
  async updateSessionActiveRole(sessionId: string, activeRole: UserRole): Promise<UserSession> {
    return prisma.userSession.update({
      where: { id: sessionId },
      data: {
        active_role: activeRole,
        last_activity: new Date(),
      },
    });
  }

  /**
   * Revoke user session
   */
  async revokeSession(sessionId: string): Promise<UserSession> {
    return prisma.userSession.update({
      where: { id: sessionId },
      data: {
        revoked_at: new Date(),
      },
    });
  }

  /**
   * Find active session by user ID
   */
  async findActiveSession(userId: string): Promise<UserSession | null> {
    return prisma.userSession.findFirst({
      where: {
        user_id: userId,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { last_activity: "desc" },
    });
  }

  /**
   * Count active sessions for user
   */
  async countActiveSessions(userId: string): Promise<number> {
    return prisma.userSession.count({
      where: {
        user_id: userId,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
    });
  }
}

