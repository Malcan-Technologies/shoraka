import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminUpdateUserAttributesCommand,
  ResendConfirmationCodeCommand,
  ConfirmSignUpCommand,
  NotAuthorizedException,
  UserNotFoundException,
  CodeMismatchException,
  ExpiredCodeException,
  VerifyUserAttributeCommand,
  ChangePasswordCommand,
  GlobalSignOutCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { AuthRepository } from "./repository";
import { OnboardingStatus, User, UserRole } from "@prisma/client";
import { formatRolesForCognito } from "../../lib/auth/cognito";
import { verifyCognitoAccessToken } from "../../lib/auth/cognito-jwt-verifier";
import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import {
  AUDIT_ACTOR_TYPE,
  AUDIT_SOURCE,
  auditContextFromRequest,
  auditPortalFromRequest,
  auditPortalFromRole,
} from "../../lib/audit/context";
import { changedFieldsOf, roleDiff } from "../../lib/audit/snapshot";
import { writeAccessAuditLogBestEffort } from "./audit/writer";
import { accessAuditLogReader } from "./audit/reader";
import { writeSecurityAuditLog, writeSecurityAuditLogBestEffort } from "../security/audit/writer";
import { SECURITY_AUDIT_TARGET_TYPE } from "../security/audit/events";
import { createHmac } from "crypto";
import { getEnv } from "../../config/env";
import { NotificationService } from "../notification/service";
import { NotificationTypeIds } from "../notification/registry";
import { resolveAdminAccess } from "../../lib/auth/rbac";

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || "ap-southeast-5",
  // AWS credentials will be automatically loaded from:
  // 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
  // 2. IAM role (in production/ECS)
  // 3. ~/.aws/credentials (local development)
});

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || "";
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || "";
const COGNITO_CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET || "";
const COGNITO_DOMAIN = process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "";

/**
 * Compute SECRET_HASH for Cognito API calls when client has a secret configured
 */
function computeSecretHash(username: string): string {
  const message = username + COGNITO_CLIENT_ID;
  const hmac = createHmac("sha256", COGNITO_CLIENT_SECRET);
  hmac.update(message);
  return hmac.digest("base64");
}

async function hasIncompleteOnboardingForRole(userId: string, role: UserRole): Promise<boolean> {
  const portalType = role === UserRole.ISSUER ? "issuer" : "investor";
  const orgs =
    portalType === "investor"
      ? await prisma.investorOrganization.findMany({
          where: { owner_user_id: userId },
          select: { id: true, onboarding_status: true, onboarded_at: true },
        })
      : await prisma.issuerOrganization.findMany({
          where: { owner_user_id: userId },
          select: { id: true, onboarding_status: true, onboarded_at: true },
        });

  const sessions = await prisma.regTankOnboarding.findMany({
    where: { user_id: userId, portal_type: portalType },
    select: { investor_organization_id: true, issuer_organization_id: true },
  });

  const sessionOrgIds = new Set(
    sessions
      .map((row) =>
        portalType === "investor" ? row.investor_organization_id : row.issuer_organization_id
      )
      .filter((id): id is string => Boolean(id))
  );

  const hasIncomplete = orgs.some((org) => {
    if (org.onboarding_status === OnboardingStatus.COMPLETED || org.onboarded_at) {
      return false;
    }
    if (org.onboarding_status !== OnboardingStatus.PENDING) {
      return true;
    }
    return sessionOrgIds.has(org.id);
  });

  if (hasIncomplete) return true;
  return false;
}

export class AuthService {
  private repository: AuthRepository;
  private notificationService: NotificationService;

  constructor() {
    this.repository = new AuthRepository();
    this.notificationService = new NotificationService();
  }

  /**
   * Sync Cognito user to database after OAuth callback.
   * Does not write AccessAuditLog — Cognito callback is the login/signup writer.
   */
  async syncUser(
    _req: Request,
    data: {
      cognitoSub: string;
      email: string;
      roles: UserRole[];
      firstName?: string;
      lastName?: string;
      phone?: string;
      emailVerified?: boolean;
    }
  ): Promise<{
    user: User;
    requiresOnboarding: {
      investor: boolean;
      issuer: boolean;
    };
  }> {
    const user = await this.repository.upsertUser({
      cognitoSub: data.cognitoSub,
      cognitoUsername: data.email, // Default to email
      email: data.email,
      roles: data.roles,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      emailVerified: data.emailVerified,
    });

    // Check onboarding status
    const requiresOnboarding = {
      investor: data.roles.includes(UserRole.INVESTOR) && user.investor_account.length === 0,
      issuer: data.roles.includes(UserRole.ISSUER) && user.issuer_account.length === 0,
    };

    return { user, requiresOnboarding };
  }

  /**
   * Add a role to an existing user
   * Updates both Cognito custom attribute and database
   */
  async addRole(req: Request, userId: string, cognitoSub: string, role: UserRole): Promise<User> {
    const currentUser = await prisma.user.findUnique({ where: { user_id: userId } });
    if (!currentUser) {
      throw new Error("User not found");
    }

    const updatedUser = await this.repository.addRoleToUser(userId, role);

    const rolesString = formatRolesForCognito(updatedUser.roles);

    const command = new AdminUpdateUserAttributesCommand({
      UserPoolId: COGNITO_USER_POOL_ID,
      Username: cognitoSub,
      UserAttributes: [
        {
          Name: "custom:roles",
          Value: rolesString,
        },
      ],
    });

    await cognitoClient.send(command);

    if (updatedUser.roles.join(",") !== currentUser.roles.join(",")) {
      const context = auditContextFromRequest(req, {
        actorType: AUDIT_ACTOR_TYPE.USER,
        actorUserId: userId,
        portal: auditPortalFromRole(role) ?? auditPortalFromRequest(req),
      });
      const diff = roleDiff(currentUser.roles, updatedUser.roles);
      await writeSecurityAuditLogBestEffort({
        eventType: "USER_ROLE_ADDED",
        context,
        subjectUserId: userId,
        targetType: SECURITY_AUDIT_TARGET_TYPE.USER,
        targetId: userId,
        metadata: {
          ...diff,
          addedRole: role,
        },
      });
    }

    return updatedUser;
  }

  /**
   * Check if onboarding is completed for a specific role
   */
  async checkOnboarding(
    userId: string,
    role: UserRole
  ): Promise<{
    completed: boolean;
    redirectTo?: string;
  }> {
    const user = await this.repository.findUserByCognitoSub(userId);

    if (!user) {
      throw new Error("User not found");
    }

    let completed = true;

    if (role === UserRole.INVESTOR) {
      completed = user.investor_account.length > 0;
    } else if (role === UserRole.ISSUER) {
      completed = user.issuer_account.length > 0;
    }

    return {
      completed,
      redirectTo: completed ? undefined : "/onboarding/account",
    };
  }

  /**
   * Log when user starts onboarding(lands on onboarding page)
   */
  async startOnboarding(
    req: Request,
    userId: string,
    role?: UserRole
  ): Promise<{ success: boolean }> {
    // Get user to determine role if not provided
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Validate that user has first name and last name before starting onboarding
    if (
      !user.first_name ||
      !user.last_name ||
      user.first_name.trim() === "" ||
      user.last_name.trim() === ""
    ) {
      throw new AppError(
        400,
        "NAMES_REQUIRED",
        "First name and last name are required before starting onboarding. Please update your profile first."
      );
    }

    let onboardingRole = role;
    if (!onboardingRole) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        try {
          const token = authHeader.substring(7);
          const payload = await verifyCognitoAccessToken(token);
          // Get user from database to determine role
          const tokenUser = await prisma.user.findUnique({
            where: { cognito_sub: payload.sub },
          });
          onboardingRole = tokenUser?.roles[0] || user.roles[0] || UserRole.INVESTOR;
        } catch {
          onboardingRole = user.roles[0] || UserRole.INVESTOR;
        }
      } else {
        onboardingRole = user.roles[0] || UserRole.INVESTOR;
      }
    }

    return { success: true };
  }

  /**
   * Mark onboarding as completed for a specific role
   * Also adds the role to the user if they don't have it yet
   */
  async completeOnboarding(
    _req: Request,
    userId: string,
    role: UserRole
  ): Promise<{ success: boolean }> {
    // Get current user by database ID (userId is the database user_id, not cognito_sub)
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    logger.info(
      {
        userId: user.user_id,
        email: user.email,
        currentRoles: user.roles,
        requestedRole: role,
        investorOnboarding: user.investor_account.length > 0,
        issuerOnboarding: user.issuer_account.length > 0,
      },
      "Complete onboarding - current user state"
    );

    const roleNeedsToBeAdded = !user.roles.includes(role);
    let updatedUser = user;

    // Add role if user doesn't have it yet
    if (roleNeedsToBeAdded) {
      logger.info({ role }, "Adding role to user");
      updatedUser = await this.repository.addRoleToUser(user.user_id, role);
      logger.info({ updatedRoles: updatedUser.roles }, "Role added successfully");

      // Update Cognito custom:roles attribute if not ADMIN
      // This is optional - if AWS credentials aren't configured (e.g., local dev), we'll skip it
      if (role !== UserRole.ADMIN) {
        try {
          const rolesString = formatRolesForCognito(updatedUser.roles);

          const command = new AdminUpdateUserAttributesCommand({
            UserPoolId: COGNITO_USER_POOL_ID,
            Username: user.cognito_sub,
            UserAttributes: [
              {
                Name: "custom:roles",
                Value: rolesString,
              },
            ],
          });

          await cognitoClient.send(command);
        } catch (error) {
          // Log warning but don't fail - Cognito sync is optional in local dev
          // In production, AWS credentials should be configured
          logger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            "Failed to update Cognito custom:roles attribute"
          );
        }
      }
    } else {
      logger.info({ role }, "User already has role");
    }

    // Update onboarding status - this should always run regardless of whether role was added
    logger.info({ role }, "Updating onboarding status for role");
    updatedUser = await this.repository.updateOnboardingStatus(updatedUser.user_id, role, true);
    logger.info(
      {
        roles: updatedUser.roles,
        investorOnboarding: updatedUser.investor_account.length > 0,
        issuerOnboarding: updatedUser.issuer_account.length > 0,
      },
      "Onboarding status updated successfully"
    );

    // Note: USER_COMPLETED log is only created when final approval is completed by admin
    // See apps/api/src/modules/admin/service.ts completeFinalApproval()
    // Removed USER_COMPLETED log creation from here

    return { success: true };
  }

  /**
   * Report whether the user has incomplete onboarding for a portal.
   * Does not rewind org status, delete provider sessions, or write audit.
   */
  async cancelOnboarding(
    req: Request,
    userId: string,
    role?: UserRole,
    reason?: string
  ): Promise<{ success: boolean; cancelled: boolean }> {
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    let onboardingRole = role;
    if (!onboardingRole) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        try {
          const token = authHeader.substring(7);
          const payload = await verifyCognitoAccessToken(token);
          const tokenUser = await prisma.user.findUnique({
            where: { cognito_sub: payload.sub },
          });
          onboardingRole = tokenUser?.roles[0] || user.roles[0] || UserRole.INVESTOR;
        } catch {
          onboardingRole = user.roles[0] || UserRole.INVESTOR;
        }
      } else {
        onboardingRole = user.roles[0] || UserRole.INVESTOR;
      }
    }

    const cancelled = await hasIncompleteOnboardingForRole(userId, onboardingRole);
    logger.info(
      { userId, role: onboardingRole, reason, cancelled },
      cancelled
        ? "Onboarding cancelled (user-initiated, no state mutation)"
        : "Onboarding cancel skipped — never started or already completed"
    );
    return { success: true, cancelled };
  }

  /**
   * Logout user and revoke session
   */
  async logout(
    req: Request,
    userId: string,
    activeRole?: UserRole
  ): Promise<{
    success: boolean;
    logoutUrl: string;
  }> {
    const session = await this.repository.findActiveSession(userId);

    const roleForPortal = activeRole || session?.active_role || null;

    // Check if user has started but not completed onboarding, and cancel it
    if (roleForPortal) {
      try {
        await this.cancelOnboarding(
          req,
          userId,
          roleForPortal,
          "User logged out during onboarding"
        );
      } catch (error) {
        // Log error but don't fail logout
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            userId,
            role: roleForPortal,
          },
          "Failed to cancel onboarding during logout"
        );
      }
    }

    if (session) {
      await this.repository.revokeSession(session.id);
    }

    await writeAccessAuditLogBestEffort({
      eventType: "USER_LOGGED_OUT",
      context: auditContextFromRequest(req, {
        actorType: AUDIT_ACTOR_TYPE.USER,
        actorUserId: userId,
        portal: auditPortalFromRole(roleForPortal),
        source: AUDIT_SOURCE.API,
      }),
      userId,
      metadata: roleForPortal ? { activeRole: roleForPortal } : {},
    });

    // Return Cognito logout URL
    const env = await import("../../config/env").then((m) => m.getEnv());
    const logoutUrl = `${COGNITO_DOMAIN}/logout?client_id=${process.env.COGNITO_CLIENT_ID}&logout_uri=${encodeURIComponent(env.FRONTEND_URL)}`;

    return {
      success: true,
      logoutUrl,
    };
  }

  /**
   * Get current user profile with session info
   */
  async getCurrentUser(userId: string): Promise<{
    userId: string;
    user: User & {
      admin: {
        status: string;
        role_description: string | null;
      } | null;
    };
    activeRole: UserRole | null;
    permissions: string[];
    roleKey: string | null;
    roleName: string | null;
    sessions: {
      active: number;
    };
    recentLogins: Array<{
      at: Date;
      ip: string | null;
      device: string | null;
    }>;
  }> {
    const user = await prisma.user.findUnique({
      where: { cognito_sub: userId },
      include: {
        admin: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const activeSession = await this.repository.findActiveSession(user.user_id);
    const activeSessionsCount = await this.repository.countActiveSessions(user.user_id);
    const recentLogins = await accessAuditLogReader.findRecentLogins(user.user_id, 3);
    const access = user.admin ? await resolveAdminAccess(prisma, user.admin) : null;

    return {
      userId: user.user_id,
      user,
      activeRole: activeSession?.active_role || null,
      permissions: access?.permissions ?? [],
      roleKey: access?.roleKey ?? null,
      roleName: access?.roleName ?? null,
      sessions: {
        active: activeSessionsCount > 0 ? activeSessionsCount : 1,
      },
      recentLogins: recentLogins.map((login) => ({
        at: new Date(login.occurredAt),
        ip: login.ipAddress,
        device: login.deviceInfo,
      })),
    };
  }

  /**
   * Switch active role in current session
   */
  async switchRole(
    req: Request,
    userId: string,
    role: UserRole
  ): Promise<{
    success: boolean;
    activeRole: UserRole;
  }> {
    const user = await this.repository.findUserByCognitoSub(userId);

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.roles.includes(role)) {
      throw new Error(`User does not have ${role} role`);
    }

    const session = await this.repository.findActiveSession(user.user_id);
    const previousRole = session?.active_role ?? null;
    const context = auditContextFromRequest(req, {
      actorType: AUDIT_ACTOR_TYPE.USER,
      actorUserId: user.user_id,
      portal: auditPortalFromRole(role),
    });

    await prisma.$transaction(async (tx) => {
      if (session) {
        await tx.userSession.update({
          where: { id: session.id },
          data: {
            active_role: role,
            last_activity: new Date(),
          },
        });
      }

      await writeSecurityAuditLog(
        {
          eventType: "ACTIVE_ROLE_CHANGED",
          context,
          subjectUserId: user.user_id,
          targetType: SECURITY_AUDIT_TARGET_TYPE.USER,
          targetId: user.user_id,
          metadata: {
            previousRole,
            newRole: role,
            sessionId: session?.id ?? null,
          },
        },
        tx
      );
    });

    return {
      success: true,
      activeRole: role,
    };
  }

  /**
   * @deprecated Token refresh is now handled by AWS Amplify on the frontend
   * This method is kept for backward compatibility but should not be used
   */
  async refreshTokens(
    _req: Request,
    _res: Response
  ): Promise<{ message: string; accessToken?: string; refreshToken?: string }> {
    throw new AppError(
      410,
      "GONE",
      "Token refresh is now handled by AWS Amplify. This endpoint is deprecated."
    );
  }

  /**
   * Refresh access token using refresh token from cookies
   * Authenticates to Cognito with client secret (secure backend-only operation)
   */
  async refreshToken(req: Request, res: Response): Promise<{ accessToken: string }> {
    const env = getEnv();
    const cookies = req.cookies;
    const clientId = env.COGNITO_CLIENT_ID;
    const clientSecret = env.COGNITO_CLIENT_SECRET;
    const cognitoDomain = env.COGNITO_DOMAIN;

    // Get user ID from LastAuthUser cookie
    const lastAuthUser = cookies[`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`];

    if (!lastAuthUser) {
      throw new AppError(401, "NO_REFRESH_TOKEN", "No authentication session found");
    }

    // Get refresh token for this user
    const refreshToken =
      cookies[`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.refreshToken`];

    if (!refreshToken) {
      throw new AppError(401, "NO_REFRESH_TOKEN", "No refresh token found");
    }

    // Prepare Basic Auth header with client secret
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    logger.info(
      {
        userId: lastAuthUser,
        cognitoDomain,
      },
      "Refreshing token via Cognito"
    );

    // Call Cognito with client secret authentication
    const response = await fetch(`${cognitoDomain}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${authHeader}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        {
          status: response.status,
          error: errorText,
        },
        "Cognito token refresh failed"
      );
      throw new AppError(401, "REFRESH_FAILED", "Failed to refresh authentication token");
    }

    const tokens = (await response.json()) as {
      access_token: string;
      id_token?: string;
      refresh_token?: string;
      token_type: string;
      expires_in: number;
    };

    // Update cookies with new tokens
    // Use COOKIE_DOMAIN from env (AWS Secrets Manager in production)
    // Fallback to localhost for development if not set
    const cookieDomain =
      env.COOKIE_DOMAIN || (env.NODE_ENV === "production" ? ".cashsouk.com" : "localhost");
    const isSecure = env.NODE_ENV === "production";

    // Set new access token
    res.cookie(
      `CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.accessToken`,
      tokens.access_token,
      {
        httpOnly: false, // Amplify needs to read this
        secure: isSecure,
        sameSite: "lax",
        domain: cookieDomain,
        path: "/",
        maxAge: 60 * 60 * 1000, // 1 hour
      }
    );

    // Set new ID token
    if (tokens.id_token) {
      res.cookie(
        `CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.idToken`,
        tokens.id_token,
        {
          httpOnly: false,
          secure: isSecure,
          sameSite: "lax",
          domain: cookieDomain,
          path: "/",
          maxAge: 60 * 60 * 1000,
        }
      );
    }

    // Update refresh token if Cognito returned a new one (token rotation)
    if (tokens.refresh_token) {
      res.cookie(
        `CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.refreshToken`,
        tokens.refresh_token,
        {
          httpOnly: true, // SECURITY: Refresh tokens must be httpOnly to prevent XSS exfiltration
          secure: isSecure,
          sameSite: "lax",
          domain: cookieDomain,
          path: "/",
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        }
      );
    }

    logger.info(
      {
        userId: lastAuthUser,
        hasNewRefreshToken: !!tokens.refresh_token,
      },
      "Token refreshed successfully"
    );

    return {
      accessToken: tokens.access_token,
    };
  }

  /**
   * Create admin user (admin-only function)
   */
  async createAdminUser(data: {
    email: string;
    firstName: string;
    lastName: string;
    tempPassword: string;
  }): Promise<{
    user: User;
    tempPassword: string;
  }> {
    // Create user in Cognito
    const command = new AdminCreateUserCommand({
      UserPoolId: COGNITO_USER_POOL_ID,
      Username: data.email,
      UserAttributes: [
        { Name: "email", Value: data.email },
        { Name: "email_verified", Value: "true" },
        { Name: "custom:roles", Value: UserRole.ADMIN },
      ],
      TemporaryPassword: data.tempPassword,
      MessageAction: "SUPPRESS", // Don't send welcome email (we'll handle it)
    });

    const cognitoResponse = await cognitoClient.send(command);
    const cognitoSub = cognitoResponse.User?.Attributes?.find((attr) => attr.Name === "sub")?.Value;

    if (!cognitoSub) {
      throw new Error("Failed to create Cognito user");
    }

    // Create user in database
    const user = await this.repository.upsertUser({
      cognitoSub,
      cognitoUsername: data.email,
      email: data.email,
      roles: [UserRole.ADMIN],
      firstName: data.firstName,
      lastName: data.lastName,
      emailVerified: true,
    });

    return {
      user,
      tempPassword: data.tempPassword,
    };
  }

  /**
   * Update current user's profile (name, phone)
   * Any authenticated user can update their own profile
   */
  async updateProfile(
    req: Request,
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
    }
  ): Promise<User> {
    const currentUser = await prisma.user.findUnique({ where: { user_id: userId } });
    if (!currentUser) {
      throw new Error("User not found");
    }

    const isAdmin = currentUser.roles.includes(UserRole.ADMIN);
    const hasCompletedOnboarding =
      currentUser.investor_account.length > 0 || currentUser.issuer_account.length > 0;
    if (
      !isAdmin &&
      hasCompletedOnboarding &&
      (data.firstName !== undefined || data.lastName !== undefined)
    ) {
      throw new AppError(
        403,
        "NAME_LOCKED",
        "Names cannot be changed after completing onboarding. Please contact support if you need to update your name."
      );
    }

    const context = auditContextFromRequest(req, {
      actorType: isAdmin ? AUDIT_ACTOR_TYPE.ADMIN : AUDIT_ACTOR_TYPE.USER,
      actorUserId: userId,
    });

    return prisma.$transaction(async (tx) => {
      const updateData: Record<string, string | null> = {};
      if (data.firstName !== undefined) updateData.first_name = data.firstName;
      if (data.lastName !== undefined) updateData.last_name = data.lastName;
      if (data.phone !== undefined) updateData.phone = data.phone;

      const updatedUser = await tx.user.update({
        where: { user_id: userId },
        data: updateData,
      });

      const before = {
        firstName: currentUser.first_name,
        lastName: currentUser.last_name,
        phone: currentUser.phone,
      };
      const after = {
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        phone: updatedUser.phone,
      };
      const changedFields = changedFieldsOf(before, after);
      if (changedFields.length > 0) {
        await writeSecurityAuditLog(
          {
            eventType: "USER_PROFILE_UPDATED",
            context,
            subjectUserId: userId,
            targetType: SECURITY_AUDIT_TARGET_TYPE.USER,
            targetId: userId,
            metadata: { changedFields, before, after },
          },
          tx
        );
      }

      return updatedUser;
    });
  }

  /**
   * Change password for the current user
   * Uses Cognito's non-admin ChangePasswordCommand with user's access token
   * This avoids needing IAM permissions on the ECS task role
   */
  async changePassword(
    req: Request,
    userId: string,
    data: {
      currentPassword: string;
      newPassword: string;
    }
  ): Promise<{ success: boolean; sessionRevoked?: boolean }> {
    const user = await prisma.user.findUnique({ where: { user_id: userId } });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    // Extract access token from Authorization header
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!accessToken) {
      throw new AppError(401, "UNAUTHORIZED", "Access token required for password change");
    }

    try {
      // Log token info for debugging (only first/last few chars for security)
      const tokenPreview = accessToken
        ? `${accessToken.substring(0, 20)}...${accessToken.substring(accessToken.length - 10)}`
        : "null";
      logger.info(
        {
          email: user.email,
          cognitoSub: user.cognito_sub,
          tokenLength: accessToken?.length,
          tokenPreview,
        },
        "Changing password using user access token"
      );

      // Use non-admin ChangePasswordCommand
      // This verifies current password AND sets new password in one call
      // No IAM permissions needed - uses the user's token context
      const changePasswordCommand = new ChangePasswordCommand({
        AccessToken: accessToken,
        PreviousPassword: data.currentPassword,
        ProposedPassword: data.newPassword,
      });

      await cognitoClient.send(changePasswordCommand);

      logger.info({ email: user.email }, "Password changed successfully, revoking sessions");

      // Update password changed timestamp in database
      await this.repository.updatePasswordChangedAt(userId);

      let sessionRevoked = false;
      try {
        const signOutCommand = new GlobalSignOutCommand({
          AccessToken: accessToken,
        });

        await cognitoClient.send(signOutCommand);
        sessionRevoked = true;

        logger.info(
          { userId, cognitoSub: user.cognito_sub },
          "All user sessions revoked after password change via GlobalSignOut"
        );
      } catch (error) {
        logger.error(
          { userId, error: error instanceof Error ? error.message : String(error) },
          "Failed to revoke sessions after password change"
        );
      }

      await writeSecurityAuditLogBestEffort({
        eventType: "PASSWORD_CHANGED",
        context: auditContextFromRequest(req, {
          actorType: AUDIT_ACTOR_TYPE.USER,
          actorUserId: userId,
        }),
        subjectUserId: userId,
        targetType: SECURITY_AUDIT_TARGET_TYPE.USER,
        targetId: userId,
        metadata: {
          reason: "USER_INITIATED",
          sessionRevoked,
        },
      });

      // Send platform notification
      try {
        await this.notificationService.sendTyped(userId, NotificationTypeIds.PASSWORD_CHANGED, {
          changedAt: new Date(),
        });
      } catch (error) {
        logger.error({ error, userId }, "Failed to send password changed notification");
      }

      logger.info({ userId, email: user.email, sessionRevoked }, "Password changed successfully");

      return { success: true, sessionRevoked };
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "Unknown";
      const errorMessage = error instanceof Error ? error.message : String(error);
      const cognitoMessage =
        error && typeof error === "object" && "message" in error ? (error as Error).message : "";

      const reasonCode =
        error instanceof NotAuthorizedException
          ? cognitoMessage.toLowerCase().includes("scope")
            ? "INSUFFICIENT_SCOPE"
            : cognitoMessage.toLowerCase().includes("expired") ||
                cognitoMessage.toLowerCase().includes("token")
              ? "TOKEN_EXPIRED"
              : "INCORRECT_PASSWORD"
          : error instanceof UserNotFoundException
            ? "USER_NOT_FOUND"
            : "UNKNOWN_ERROR";

      await writeSecurityAuditLogBestEffort({
        eventType: "PASSWORD_CHANGE_FAILED",
        context: auditContextFromRequest(req, {
          actorType: AUDIT_ACTOR_TYPE.USER,
          actorUserId: userId,
        }),
        subjectUserId: userId,
        targetType: SECURITY_AUDIT_TARGET_TYPE.USER,
        targetId: userId,
        metadata: {
          reasonCode,
          providerErrorCode: errorName,
        },
      });

      logger.error(
        {
          userId,
          email: user.email,
          errorName,
          errorMessage,
          cognitoMessage,
          errorType: error?.constructor?.name,
          isNotAuthorized: error instanceof NotAuthorizedException,
          isUserNotFound: error instanceof UserNotFoundException,
        },
        "Failed to change password - Cognito error"
      );

      if (error instanceof NotAuthorizedException) {
        // Check the actual Cognito message to provide better error feedback
        // NotAuthorizedException can mean:
        // - "Incorrect username or password" = wrong current password
        // - "Access Token has expired" = token issue
        // - "Access Token does not have required scopes" = missing aws.cognito.signin.user.admin scope
        if (cognitoMessage.toLowerCase().includes("scope")) {
          // This means the OAuth app client is not configured with aws.cognito.signin.user.admin scope
          logger.error(
            { cognitoMessage },
            "Token missing required scope. App client needs aws.cognito.signin.user.admin scope for password changes."
          );
          throw new AppError(
            403,
            "INSUFFICIENT_SCOPE",
            "Unable to change password. Please contact support."
          );
        }
        if (
          cognitoMessage.toLowerCase().includes("expired") ||
          cognitoMessage.toLowerCase().includes("token")
        ) {
          throw new AppError(
            401,
            "TOKEN_EXPIRED",
            "Your session has expired. Please log in again and try changing your password."
          );
        }
        throw new AppError(400, "INVALID_PASSWORD", "Current password is incorrect");
      }

      if (error instanceof UserNotFoundException) {
        throw new AppError(404, "NOT_FOUND", "User not found in authentication system");
      }

      throw new AppError(500, "INTERNAL_ERROR", `Failed to change password: ${errorMessage}`);
    }
  }

  /**
   * Verify email with code
   * For logged-in users with unverified email addresses
   * No password needed since user is already authenticated
   */
  async verifyEmail(
    req: Request,
    userId: string,
    data: {
      code: string;
    }
  ): Promise<{ success: boolean }> {
    const user = await prisma.user.findUnique({ where: { user_id: userId } });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    try {
      logger.info({ email: user.email, userId }, "Verifying email attribute with code");

      // Extract access token from Authorization header (user is already authenticated)
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new AppError(401, "UNAUTHORIZED", "No access token provided");
      }

      const accessToken = authHeader.substring(7); // Remove "Bearer " prefix

      // Verify the email attribute with the code using the user's access token
      // This works for confirmed users with unverified emails
      const verifyCommand = new VerifyUserAttributeCommand({
        AccessToken: accessToken,
        AttributeName: "email",
        Code: data.code,
      });

      await cognitoClient.send(verifyCommand);
      logger.info({ email: user.email }, "Email attribute verified successfully");

      // Ensure email is marked as verified in Cognito (idempotent)
      const updateVerifiedCommand = new AdminUpdateUserAttributesCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: user.cognito_sub,
        UserAttributes: [
          {
            Name: "email_verified",
            Value: "true",
          },
        ],
      });

      await cognitoClient.send(updateVerifiedCommand);

      // Update email_verified in database
      await prisma.user.update({
        where: { user_id: userId },
        data: { email_verified: true },
      });

      await writeSecurityAuditLogBestEffort({
        eventType: "USER_EMAIL_VERIFIED",
        context: auditContextFromRequest(req, {
          actorType: AUDIT_ACTOR_TYPE.USER,
          actorUserId: userId,
        }),
        subjectUserId: userId,
        targetType: SECURITY_AUDIT_TARGET_TYPE.USER,
        targetId: userId,
        metadata: {
          email: user.email,
          reasonCode: "EMAIL_VERIFIED",
        },
      });

      logger.info({ userId, email: user.email }, "Email verified successfully");

      return { success: true };
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "Unknown";
      const errorMessage = error instanceof Error ? error.message : String(error);
      const reasonCode =
        error instanceof CodeMismatchException
          ? "INVALID_CODE"
          : error instanceof ExpiredCodeException
            ? "EXPIRED_CODE"
            : error instanceof NotAuthorizedException
              ? "INVALID_PASSWORD"
              : error instanceof AppError
                ? error.code
                : "UNKNOWN_ERROR";

      await writeSecurityAuditLogBestEffort({
        eventType: "EMAIL_VERIFICATION_FAILED",
        context: auditContextFromRequest(req, {
          actorType: AUDIT_ACTOR_TYPE.USER,
          actorUserId: userId,
        }),
        subjectUserId: userId,
        targetType: SECURITY_AUDIT_TARGET_TYPE.USER,
        targetId: userId,
        metadata: {
          email: user.email,
          reasonCode,
        },
      });

      logger.error(
        {
          userId,
          email: user.email,
          errorName,
          errorMessage,
        },
        "Failed to verify email"
      );

      if (error instanceof NotAuthorizedException) {
        throw new AppError(400, "INVALID_PASSWORD", "Password is incorrect");
      }

      if (error instanceof CodeMismatchException) {
        throw new AppError(400, "INVALID_CODE", "Invalid verification code");
      }

      if (error instanceof ExpiredCodeException) {
        throw new AppError(
          400,
          "EXPIRED_CODE",
          "Verification code has expired. Please request a new code."
        );
      }

      throw new AppError(500, "INTERNAL_ERROR", `Failed to verify email: ${errorMessage}`);
    }
  }

  /**
   * Resend signup confirmation code (public - for unconfirmed users)
   */
  async resendSignupCode(email: string): Promise<void> {
    try {
      const secretHash = computeSecretHash(email);

      const command = new ResendConfirmationCodeCommand({
        ClientId: COGNITO_CLIENT_ID,
        Username: email,
        SecretHash: secretHash,
      });

      await cognitoClient.send(command);
      logger.info({ email }, "Verification code resent successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = (error as { name?: string }).name;
      logger.error({ email, error: errorMessage }, "Failed to resend confirmation code");

      if (errorName === "UserNotFoundException") {
        throw new AppError(404, "USER_NOT_FOUND", "No account found with this email address");
      }

      if (errorName === "InvalidParameterException" && errorMessage?.includes("confirmed")) {
        throw new AppError(400, "ALREADY_CONFIRMED", "User is already confirmed");
      }

      if (errorName === "LimitExceededException") {
        throw new AppError(429, "TOO_MANY_REQUESTS", "Too many requests. Please try again later.");
      }

      throw new AppError(500, "INTERNAL_ERROR", `Failed to resend code: ${errorMessage}`);
    }
  }

  /**
   * Confirm signup with code (public - for unconfirmed users)
   */
  async confirmSignup(email: string, code: string): Promise<void> {
    try {
      const secretHash = computeSecretHash(email);

      const command = new ConfirmSignUpCommand({
        ClientId: COGNITO_CLIENT_ID,
        Username: email,
        ConfirmationCode: code,
        SecretHash: secretHash,
      });

      await cognitoClient.send(command);
      logger.info({ email }, "Email confirmed successfully");

      // Update email_verified in database if user exists
      const user = await this.repository.findUserByEmail(email);
      if (user) {
        await prisma.user.update({
          where: { user_id: user.user_id },
          data: { email_verified: true },
        });
        logger.info(
          { email, userId: user.user_id },
          "Email verified updated in database after signup confirmation"
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = (error as { name?: string }).name;
      logger.error({ email, error: errorMessage }, "Failed to confirm signup");

      if (errorName === "UserNotFoundException") {
        throw new AppError(404, "USER_NOT_FOUND", "No account found with this email address");
      }

      if (errorName === "CodeMismatchException") {
        throw new AppError(400, "INVALID_CODE", "Invalid verification code");
      }

      if (errorName === "ExpiredCodeException") {
        throw new AppError(
          400,
          "EXPIRED_CODE",
          "Verification code has expired. Please request a new code."
        );
      }

      if (errorName === "NotAuthorizedException") {
        throw new AppError(403, "NOT_AUTHORIZED", "User cannot be confirmed in current state");
      }

      throw new AppError(500, "INTERNAL_ERROR", `Failed to confirm signup: ${errorMessage}`);
    }
  }
}
