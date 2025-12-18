import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminUserGlobalSignOutCommand,
  AdminSetUserPasswordCommand,
  AdminInitiateAuthCommand,
  ResendConfirmationCodeCommand,
  ConfirmSignUpCommand,
  NotAuthorizedException,
  UserNotFoundException,
  CodeMismatchException,
  ExpiredCodeException,
  VerifyUserAttributeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { AuthRepository } from "./repository";
import { User, UserRole } from "@prisma/client";
import { formatRolesForCognito } from "../../lib/auth/cognito";
import { extractRequestMetadata } from "../../lib/http/request-utils";
import { getPortalFromRole } from "../../lib/role-detector";
import { verifyCognitoAccessToken } from "../../lib/auth/cognito-jwt-verifier";
import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { createHmac } from "crypto";
import { getEnv } from "../../config/env";

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

export class AuthService {
  private repository: AuthRepository;

  constructor() {
    this.repository = new AuthRepository();
  }

  /**
   * Sync Cognito user to database after OAuth callback
   * Creates or updates user record and creates access log for audit trail
   */
  async syncUser(
    req: Request,
    data: {
      cognitoSub: string;
      email: string;
      roles: UserRole[];
      firstName?: string;
      lastName?: string;
      phone?: string;
    }
  ): Promise<{
    user: User;
    requiresOnboarding: {
      investor: boolean;
      issuer: boolean;
    };
  }> {
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);

    // Upsert user in database
    const user = await this.repository.upsertUser({
      cognitoSub: data.cognitoSub,
      cognitoUsername: data.email, // Default to email
      email: data.email,
      roles: data.roles,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
    });

    // Create access log for audit trail
    // Note: This may create a duplicate log if called from OAuth callback route,
    // but both logs serve different purposes:
    // - This log: Records the sync operation (no portal context)
    // - Callback log: Records LOGIN/SIGNUP event (with portal context)
    // Both are needed for complete audit trail
    await this.repository.createAccessLog({
      userId: user.user_id,
      eventType: "LOGIN",
      ipAddress,
      userAgent,
      deviceInfo,
      deviceType,
      success: true,
      metadata: {
        roles: data.roles,
        source: "sync-user-endpoint",
      },
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
    const { ipAddress, userAgent, deviceInfo } = extractRequestMetadata(req);

    // Add role in database
    const updatedUser = await this.repository.addRoleToUser(userId, role);

    // Update Cognito custom:roles attribute
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

    // Create security log (ROLE_ADDED is a security event)
    await this.repository.createSecurityLog({
      userId,
      eventType: "ROLE_ADDED",
      ipAddress,
      userAgent,
      deviceInfo,
      metadata: {
        addedRole: role,
        allRoles: updatedUser.roles,
      },
    });

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
      redirectTo: completed ? undefined : "/onboarding-start",
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
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);

    // Get user to determine role if not provided
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Validate that user has first name and last name before starting onboarding
    if (!user.first_name || !user.last_name || user.first_name.trim() === "" || user.last_name.trim() === "") {
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
        } catch (error) {
          onboardingRole = user.roles[0] || UserRole.INVESTOR;
        }
      } else {
        onboardingRole = user.roles[0] || UserRole.INVESTOR;
      }
    }

    const portal = getPortalFromRole(onboardingRole as UserRole);

    // Create onboarding log
    await this.repository.createOnboardingLog({
      userId: user.user_id,
      role: onboardingRole as UserRole,
      eventType: "ONBOARDING_STARTED",
      portal,
      ipAddress,
      userAgent,
      deviceInfo,
      deviceType,
      metadata: {
        role: onboardingRole,
        roles: user.roles,
      },
    });

    return { success: true };
  }

  /**
   * Mark onboarding as completed for a specific role
   * Also adds the role to the user if they don't have it yet
   */
  async completeOnboarding(
    req: Request,
    userId: string,
    role: UserRole
  ): Promise<{ success: boolean }> {
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);
    const portal = getPortalFromRole(role);

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

    // Create onboarding log
    await this.repository.createOnboardingLog({
      userId: updatedUser.user_id,
      role,
      eventType: "ONBOARDING_COMPLETED",
      portal,
      ipAddress,
      userAgent,
      deviceInfo,
      deviceType,
      metadata: {
        role,
        roleAdded: roleNeedsToBeAdded,
        roles: updatedUser.roles,
      },
    });

    return { success: true };
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
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);

    // Find active session
    const session = await this.repository.findActiveSession(userId);

    // Use activeRole from parameter, session, or default to first role
    const roleForPortal = activeRole || session?.active_role || null;
    const portal = roleForPortal ? getPortalFromRole(roleForPortal) : undefined;

    if (session) {
      await this.repository.revokeSession(session.id);
    }

    // Create access log
    await this.repository.createAccessLog({
      userId,
      eventType: "LOGOUT",
      portal,
      ipAddress,
      userAgent,
      deviceInfo,
      deviceType,
      success: true,
      metadata: roleForPortal ? { activeRole: roleForPortal } : undefined,
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
    user: User & { admin: { status: string; role_description: string | null } | null };
    activeRole: UserRole | null;
    sessions: {
      active: number;
    };
  }> {
    const user = await prisma.user.findUnique({
      where: { cognito_sub: userId },
      include: {
        admin: {
          select: {
            status: true,
            role_description: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const activeSession = await this.repository.findActiveSession(user.user_id);
    const activeSessionsCount = await this.repository.countActiveSessions(user.user_id);

    return {
      user,
      activeRole: activeSession?.active_role || null,
      sessions: {
        active: activeSessionsCount,
      },
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
    const { ipAddress, userAgent, deviceInfo } = extractRequestMetadata(req);
    const user = await this.repository.findUserByCognitoSub(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Verify user has the role
    if (!user.roles.includes(role)) {
      throw new Error(`User does not have ${role} role`);
    }

    // Update active session
    const session = await this.repository.findActiveSession(user.user_id);

    if (session) {
      await this.repository.updateSessionActiveRole(session.id, role);
    }

    // Create security log (ROLE_SWITCHED is a security event)
    await this.repository.createSecurityLog({
      userId: user.user_id,
      eventType: "ROLE_SWITCHED",
      ipAddress,
      userAgent,
      deviceInfo,
      metadata: {
        newRole: role,
      },
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
    const cookieDomain = env.COOKIE_DOMAIN;
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
    const { ipAddress, userAgent, deviceInfo } = extractRequestMetadata(req);

    // Verify user exists before proceeding
    const currentUser = await prisma.user.findUnique({ where: { user_id: userId } });
    if (!currentUser) {
      throw new Error("User not found");
    }

    // Check if user has completed onboarding - if so, lock name changes
    // Admins can always edit names (for corrections)
    const isAdmin = currentUser.roles.includes(UserRole.ADMIN);
    const hasCompletedOnboarding = currentUser.investor_account.length > 0 || currentUser.issuer_account.length > 0;
    if (!isAdmin && hasCompletedOnboarding && (data.firstName !== undefined || data.lastName !== undefined)) {
      throw new AppError(
        403,
        "NAME_LOCKED",
        "Names cannot be changed after completing onboarding. Please contact support if you need to update your name."
      );
    }

    const updatedUser = await this.repository.updateUserProfile(userId, data);

    // Create security log (PROFILE_UPDATED is a security event)
    await this.repository.createSecurityLog({
      userId,
      eventType: "PROFILE_UPDATED",
      ipAddress,
      userAgent,
      deviceInfo,
      metadata: {
        updatedFields: Object.keys(data).filter((k) => data[k as keyof typeof data] !== undefined),
        previousValues: {
          firstName: currentUser.first_name,
          lastName: currentUser.last_name,
          phone: currentUser.phone,
        },
      },
    });

    return updatedUser;
  }

  /**
   * Change password for the current user
   * Verifies current password via Cognito, then sets new password
   */
  async changePassword(
    req: Request,
    userId: string,
    data: {
      currentPassword: string;
      newPassword: string;
    }
  ): Promise<{ success: boolean; sessionRevoked?: boolean }> {
    const { ipAddress, userAgent, deviceInfo } = extractRequestMetadata(req);

    // Get user to find their email (used as Cognito username)
    const user = await prisma.user.findUnique({ where: { user_id: userId } });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    try {
      // Step 1: Verify the current password by attempting to authenticate with it
      // Use AdminInitiateAuth with ADMIN_NO_SRP_AUTH to avoid triggering MFA
      logger.info(
        { email: user.email, cognitoSub: user.cognito_sub },
        "Verifying current password"
      );

      // SECRET_HASH must be computed with the USERNAME parameter (cognito_sub in this case)
      const secretHash = computeSecretHash(user.cognito_sub);

      const authCommand = new AdminInitiateAuthCommand({
        AuthFlow: "ADMIN_NO_SRP_AUTH",
        UserPoolId: COGNITO_USER_POOL_ID,
        ClientId: COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: user.cognito_sub,
          PASSWORD: data.currentPassword,
          SECRET_HASH: secretHash,
        },
      });

      // This will throw NotAuthorizedException if password is incorrect
      await cognitoClient.send(authCommand);

      logger.info({ email: user.email }, "Current password verified, setting new password");

      // Step 2: Set the new password using admin command
      const setPasswordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: user.cognito_sub,
        Password: data.newPassword,
        Permanent: true,
      });

      await cognitoClient.send(setPasswordCommand);

      // Update password changed timestamp
      await this.repository.updatePasswordChangedAt(userId);

      // CRITICAL: Revoke all existing sessions globally
      let sessionRevoked = false;
      try {
        const command = new AdminUserGlobalSignOutCommand({
          UserPoolId: COGNITO_USER_POOL_ID,
          Username: user.cognito_sub,
        });

        await cognitoClient.send(command);
        sessionRevoked = true;

        logger.info(
          { userId, cognitoSub: user.cognito_sub },
          "All user sessions revoked after password change via AdminUserGlobalSignOut"
        );
      } catch (error) {
        logger.error(
          { userId, error: error instanceof Error ? error.message : String(error) },
          "Failed to revoke sessions after password change"
        );
        // Don't fail the password change, but log the error
      }

      // Log successful password change with session revocation status (SecurityLog)
      await this.repository.createSecurityLog({
        userId,
        eventType: "PASSWORD_CHANGED",
        ipAddress,
        userAgent,
        deviceInfo,
        metadata: {
          reason: "USER_INITIATED",
          sessionRevoked,
        },
      });

      logger.info({ userId, email: user.email, sessionRevoked }, "Password changed successfully");

      return { success: true, sessionRevoked };
    } catch (error) {
      // Log failed password change attempt (SecurityLog)
      await this.repository.createSecurityLog({
        userId,
        eventType: "PASSWORD_CHANGED",
        ipAddress,
        userAgent,
        deviceInfo,
        metadata: {
          reason: "USER_INITIATED",
          success: false,
          error:
            error instanceof NotAuthorizedException
              ? "INCORRECT_PASSWORD"
              : error instanceof UserNotFoundException
                ? "USER_NOT_FOUND"
                : "UNKNOWN_ERROR",
        },
      });

      // Log detailed error information
      const errorName = error instanceof Error ? error.name : "Unknown";
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        {
          userId,
          email: user.email,
          errorName,
          errorMessage,
          errorType: error?.constructor?.name,
          isNotAuthorized: error instanceof NotAuthorizedException,
          isUserNotFound: error instanceof UserNotFoundException,
        },
        "Failed to change password - Cognito error"
      );

      if (error instanceof NotAuthorizedException) {
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
    const { ipAddress, userAgent, deviceInfo } = extractRequestMetadata(req);

    // Get user
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

      // Log successful verification (SecurityLog)
      await this.repository.createSecurityLog({
        userId,
        eventType: "EMAIL_CHANGED",
        ipAddress,
        userAgent,
        deviceInfo,
        metadata: {
          email: user.email,
          reason: "EMAIL_VERIFIED",
        },
      });

      logger.info({ userId, email: user.email }, "Email verified successfully");

      return { success: true };
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "Unknown";
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log failed attempt (SecurityLog)
      await this.repository.createSecurityLog({
        userId,
        eventType: "EMAIL_CHANGED",
        ipAddress,
        userAgent,
        deviceInfo,
        metadata: {
          email: user.email,
          reason: "VERIFICATION_FAILED",
          success: false,
          error: errorName,
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
