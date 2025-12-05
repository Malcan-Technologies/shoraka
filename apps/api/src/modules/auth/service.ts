import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminUpdateUserAttributesCommand,
  InitiateAuthCommand,
  ChangePasswordCommand,
  UpdateUserAttributesCommand,
  VerifyUserAttributeCommand,
  GetUserAttributeVerificationCodeCommand,
  NotAuthorizedException,
  UserNotFoundException,
  CodeMismatchException,
  ExpiredCodeException,
  AliasExistsException,
} from "@aws-sdk/client-cognito-identity-provider";
import { AuthRepository } from "./repository";
import { User, UserRole } from "@prisma/client";
import { formatRolesForCognito } from "../../lib/auth/cognito";
import { extractRequestMetadata, getDeviceFingerprint } from "../../lib/http/request-utils";
import { getPortalFromRole } from "../../lib/role-detector";
import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { verifyToken, verifyRefreshToken, generateTokenPair, parseTimeToMs } from "../../lib/auth/jwt";
import { AppError } from "../../lib/http/error-handler";
import { getEnv } from "../../config/env";
import { logger } from "../../lib/logger";
import { createHmac } from "crypto";

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || "ap-southeast-5",
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
   * Creates or updates user record and creates access log
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
      emailVerified: true, // If they completed OAuth, email is verified
      roles: data.roles,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
    });

    // Create access log
    // Note: Portal is not set here as it's determined in the callback route
    await this.repository.createAccessLog({
      userId: user.id,
      eventType: "LOGIN",
      ipAddress,
      userAgent,
      deviceInfo,
      deviceType,
      success: true,
      metadata: {
        roles: data.roles,
      },
    });

    // Check onboarding status
    const requiresOnboarding = {
      investor: data.roles.includes(UserRole.INVESTOR) && !user.investor_onboarding_completed,
      issuer: data.roles.includes(UserRole.ISSUER) && !user.issuer_onboarding_completed,
    };

    return { user, requiresOnboarding };
  }

  /**
   * Add a role to an existing user
   * Updates both Cognito custom attribute and database
   */
  async addRole(req: Request, userId: string, cognitoSub: string, role: UserRole): Promise<User> {
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);

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

    // Create access log
    // ROLE_ADDED is typically an admin action
    await this.repository.createAccessLog({
      userId,
      eventType: "ROLE_ADDED",
      portal: "admin",
      ipAddress,
      userAgent,
      deviceInfo,
      deviceType,
      success: true,
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
      completed = user.investor_onboarding_completed;
    } else if (role === UserRole.ISSUER) {
      completed = user.issuer_onboarding_completed;
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
      where: { id: userId },
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
          const payload = verifyToken(token);
          onboardingRole = payload.activeRole;
        } catch (error) {
          onboardingRole = user.roles[0] || UserRole.INVESTOR;
        }
      } else {
        onboardingRole = user.roles[0] || UserRole.INVESTOR;
      }
    }

    const portal = getPortalFromRole(onboardingRole);

    // Create access log
    await this.repository.createAccessLog({
      userId: user.id,
      eventType: "ONBOARDING",
      portal,
      ipAddress,
      userAgent,
      deviceInfo,
      deviceType,
      success: true,
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

    // Get current user by database ID (userId is the database user ID, not cognito_sub)
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    console.log("completeOnboarding - Current user:", {
      userId: user.id,
      email: user.email,
      currentRoles: user.roles,
      requestedRole: role,
      investorOnboarding: user.investor_onboarding_completed,
      issuerOnboarding: user.issuer_onboarding_completed,
    });

    const roleNeedsToBeAdded = !user.roles.includes(role);
    let updatedUser = user;

    // Add role if user doesn't have it yet
    if (roleNeedsToBeAdded) {
      console.log("Adding role to user:", role);
      updatedUser = await this.repository.addRoleToUser(user.id, role);
      console.log("Role added. Updated roles:", updatedUser.roles);

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
          console.warn(
            "Failed to update Cognito custom:roles attribute:",
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    } else {
      console.log("User already has role:", role);
    }

    // Update onboarding status - this should always run regardless of whether role was added
    console.log("Updating onboarding status for role:", role);
    updatedUser = await this.repository.updateOnboardingStatus(updatedUser.id, role, true);
    console.log("Onboarding status updated. Final user state:", {
      roles: updatedUser.roles,
      investorOnboarding: updatedUser.investor_onboarding_completed,
      issuerOnboarding: updatedUser.issuer_onboarding_completed,
    });

    // Create access log
    await this.repository.createAccessLog({
      userId: updatedUser.id,
      eventType: "ONBOARDING_COMPLETED",
      portal,
      ipAddress,
      userAgent,
      deviceInfo,
      deviceType,
      success: true,
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
    user: User;
    activeRole: UserRole | null;
    sessions: {
      active: number;
    };
  }> {
    const user = await this.repository.findUserByCognitoSub(userId);

    if (!user) {
      throw new Error("User not found");
    }

    const activeSession = await this.repository.findActiveSession(user.id);
    const activeSessionsCount = await this.repository.countActiveSessions(user.id);

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
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);
    const portal = getPortalFromRole(role);
    const user = await this.repository.findUserByCognitoSub(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Verify user has the role
    if (!user.roles.includes(role)) {
      throw new Error(`User does not have ${role} role`);
    }

    // Update active session
    const session = await this.repository.findActiveSession(user.id);

    if (session) {
      await this.repository.updateSessionActiveRole(session.id, role);
    }

    // Create access log
    await this.repository.createAccessLog({
      userId: user.id,
      eventType: "ROLE_SWITCHED",
      portal,
      ipAddress,
      userAgent,
      deviceInfo,
      deviceType,
      success: true,
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
   * Refresh access token using refresh token
   * Implements token rotation and reuse detection
   */
  async refreshTokens(
    req: Request,
    res: Response
  ): Promise<{ message: string; accessToken?: string; refreshToken?: string }> {
    const env = getEnv();
    const { ipAddress, userAgent } = extractRequestMetadata(req);

    // Get refresh token from HTTP-Only cookie (production) or request body/header (development)
    // In development, cookies don't work across different ports (localhost:4000 vs localhost:3002)
    let refreshToken = req.cookies?.refresh_token;

    // Fallback for development: Check Authorization header
    if (!refreshToken) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        // Check if it's a refresh token (has tokenType: "refresh" in payload)
        try {
          const decoded = verifyRefreshToken(token);
          if (decoded.tokenType === "refresh") {
            refreshToken = token;
            logger.info(
              { source: "authorization_header" },
              "Using refresh token from Authorization header (dev mode)"
            );
          }
        } catch {
          // Not a refresh token, ignore
        }
      }
    }

    // Fallback: Check request body for development mode
    if (!refreshToken && req.body?.refreshToken) {
      refreshToken = req.body.refreshToken;
      logger.info({ source: "request_body" }, "Using refresh token from request body (dev mode)");
    }

    if (!refreshToken) {
      logger.warn(
        {
          hasCookies: !!req.cookies,
          cookieKeys: req.cookies ? Object.keys(req.cookies) : [],
          hasAuthHeader: !!req.headers.authorization,
          hasBody: !!req.body,
        },
        "No refresh token found in cookies, header, or body"
      );
      throw new AppError(401, "UNAUTHORIZED", "No refresh token provided");
    }

    try {
      // Verify refresh token signature and expiration
      verifyRefreshToken(refreshToken);

      // Find token in database
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!storedToken) {
        throw new AppError(403, "FORBIDDEN", "Invalid refresh token");
      }

      // Check if token is revoked
      if (storedToken.revoked) {
        throw new AppError(403, "FORBIDDEN", "Refresh token has been revoked");
      }

      // Check if token is expired
      if (storedToken.expires_at < new Date()) {
        throw new AppError(403, "FORBIDDEN", "Refresh token has expired");
      }

      // 🚨 CRITICAL: Check if token was already used (TOKEN REUSE DETECTION)
      if (storedToken.used) {
        console.error("🚨 TOKEN REUSE DETECTED", {
          userId: storedToken.user_id,
          tokenId: storedToken.id,
          ipAddress,
          userAgent,
        });

        // Revoke ALL tokens for this user (security breach detected)
        await prisma.refreshToken.updateMany({
          where: { user_id: storedToken.user_id },
          data: {
            revoked: true,
            revoked_at: new Date(),
            revoked_reason: "TOKEN_REUSE_DETECTED",
          },
        });

        // Log security incident
        await this.repository.createAccessLog({
          userId: storedToken.user_id,
          eventType: "LOGOUT",
          ipAddress,
          userAgent,
          deviceInfo: extractRequestMetadata(req).deviceInfo,
          deviceType: extractRequestMetadata(req).deviceType,
          success: false,
          metadata: {
            reason: "TOKEN_REUSE_DETECTED",
            revokedAllTokens: true,
          },
        });

        throw new AppError(403, "FORBIDDEN", "Token reuse detected - all sessions revoked");
      }

      // Optional: Verify device fingerprint hasn't changed
      const currentFingerprint = getDeviceFingerprint(req);
      if (storedToken.device_fingerprint && storedToken.device_fingerprint !== currentFingerprint) {
        console.warn("Device fingerprint mismatch", {
          userId: storedToken.user_id,
          stored: storedToken.device_fingerprint,
          current: currentFingerprint,
        });
        // Note: We log but don't block - devices can legitimately change (browser updates, etc.)
      }

      // Mark old refresh token as USED (one-time use only)
      // This must happen BEFORE generating new tokens to prevent race conditions
      try {
        await prisma.refreshToken.update({
          where: { id: storedToken.id },
          data: {
            used: true,
            used_at: new Date(),
          },
        });
        logger.info(
          {
            tokenId: storedToken.id,
            userId: storedToken.user_id,
          },
          "Refresh token marked as used"
        );
      } catch (updateError) {
        logger.error(
          {
            tokenId: storedToken.id,
            userId: storedToken.user_id,
            error: updateError,
          },
          "Failed to mark refresh token as used"
        );
        // Don't throw - continue with token generation
        // But log the error for investigation
      }

      // Generate NEW token pair
      const newTokens = generateTokenPair(
        storedToken.user.id,
        storedToken.user.email,
        storedToken.user.roles,
        storedToken.user.roles[0] // Default to first role, user can switch later
      );

      // Store NEW refresh token in database
      await prisma.refreshToken.create({
        data: {
          token: newTokens.refreshToken,
          user_id: storedToken.user_id,
          expires_at: newTokens.refreshTokenExpiresAt,
          device_fingerprint: currentFingerprint,
          ip_address: ipAddress,
          user_agent: userAgent,
        },
      });

      // Set new HTTP-Only cookie for refresh_token only
      // access_token is returned in response body and stored in Next.js memory (not cookies)
      res.cookie("refresh_token", newTokens.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: env.NODE_ENV === "production" ? "strict" : "lax", // Lax for dev cross-origin
        maxAge: parseTimeToMs(process.env.REFRESH_TOKEN_EXPIRES_IN || "7d"),
        path: "/", // Available to all paths (needed for /v1/auth/refresh)
        domain: env.COOKIE_DOMAIN,
      });

      // Always return accessToken in response body (frontend stores in memory)
      // refreshToken is also returned for dev mode compatibility
      return {
        message: "Tokens refreshed successfully",
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(403, "FORBIDDEN", "Invalid refresh token");
    }
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
      emailVerified: true,
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
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);

    // Verify user exists before proceeding
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) {
      throw new Error("User not found");
    }

    const updatedUser = await this.repository.updateUserProfile(userId, data);

    // Create access log
    await this.repository.createAccessLog({
      userId,
      eventType: "PROFILE_UPDATED",
      ipAddress,
      userAgent,
      deviceInfo,
      deviceType,
      success: true,
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
  ): Promise<{ success: boolean }> {
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);

    // Get user to find their email (used as Cognito username)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    // Determine portal from token for access logging
    let portal: string | undefined;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const payload = verifyToken(token);
        portal = getPortalFromRole(payload.activeRole);
      }
    } catch {
      // Ignore token verification errors for portal detection
    }

    try {
      // Step 1: Verify current password by attempting to authenticate
      logger.info(
        { email: user.email, clientId: COGNITO_CLIENT_ID },
        "Attempting to verify current password via InitiateAuth"
      );

      // Compute SECRET_HASH required when Cognito client has a secret configured
      const secretHash = computeSecretHash(user.email);

      const authCommand = new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: user.email,
          PASSWORD: data.currentPassword,
          SECRET_HASH: secretHash,
        },
      });

      const authResult = await cognitoClient.send(authCommand);
      logger.info({ email: user.email }, "Current password verified successfully");

      // Step 2: Use the Cognito access token from auth to change password
      // This doesn't require AWS IAM credentials, only the user's Cognito access token
      const cognitoAccessToken = authResult.AuthenticationResult?.AccessToken;
      if (!cognitoAccessToken) {
        throw new AppError(
          500,
          "INTERNAL_ERROR",
          "Failed to obtain access token for password change"
        );
      }

      const changePasswordCommand = new ChangePasswordCommand({
        AccessToken: cognitoAccessToken,
        PreviousPassword: data.currentPassword,
        ProposedPassword: data.newPassword,
      });

      await cognitoClient.send(changePasswordCommand);

      // Update password changed timestamp
      await this.repository.updatePasswordChangedAt(userId);

      // Log successful password change
      await this.repository.createAccessLog({
        userId,
        eventType: "PASSWORD_CHANGED",
        portal,
        ipAddress,
        userAgent,
        deviceInfo,
        deviceType,
        success: true,
        metadata: {
          reason: "USER_INITIATED",
        },
      });

      logger.info({ userId, email: user.email }, "Password changed successfully");

      return { success: true };
    } catch (error) {
      // Log failed password change attempt
      await this.repository.createAccessLog({
        userId,
        eventType: "PASSWORD_CHANGED",
        portal,
        ipAddress,
        userAgent,
        deviceInfo,
        deviceType,
        success: false,
        metadata: {
          reason: "USER_INITIATED",
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
   * Initiate email change process
   * Verifies password, checks new email availability, and sends verification code
   */
  async initiateEmailChange(
    _req: Request,
    userId: string,
    data: {
      newEmail: string;
      password: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    // Get user to find their current email
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    // Check if new email is same as current
    if (user.email.toLowerCase() === data.newEmail.toLowerCase()) {
      throw new AppError(400, "VALIDATION_ERROR", "New email must be different from current email");
    }

    // Check if new email is already in use by another user
    const existingUser = await prisma.user.findUnique({
      where: { email: data.newEmail.toLowerCase() },
    });
    if (existingUser) {
      throw new AppError(400, "EMAIL_IN_USE", "This email address is already in use");
    }

    try {
      // Step 1: Verify password by authenticating to get Cognito access token
      logger.info({ email: user.email }, "Initiating email change - verifying password");

      const secretHash = computeSecretHash(user.email);
      const authCommand = new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: user.email,
          PASSWORD: data.password,
          SECRET_HASH: secretHash,
        },
      });

      const authResult = await cognitoClient.send(authCommand);
      const cognitoAccessToken = authResult.AuthenticationResult?.AccessToken;

      if (!cognitoAccessToken) {
        throw new AppError(500, "INTERNAL_ERROR", "Failed to obtain access token");
      }

      logger.info(
        { email: user.email, newEmail: data.newEmail },
        "Password verified, updating email attribute"
      );

      // Step 2: Update email attribute in Cognito (triggers verification email)
      const updateCommand = new UpdateUserAttributesCommand({
        AccessToken: cognitoAccessToken,
        UserAttributes: [
          {
            Name: "email",
            Value: data.newEmail.toLowerCase(),
          },
        ],
      });

      await cognitoClient.send(updateCommand);

      // Update database email immediately to stay in sync with Cognito
      // Set email_verified to false until verification is complete
      const oldEmail = user.email;
      await prisma.user.update({
        where: { id: userId },
        data: {
          email: data.newEmail.toLowerCase(),
          email_verified: false,
        },
      });

      logger.info(
        { userId, oldEmail, newEmail: data.newEmail.toLowerCase() },
        "Email change initiated - verification code sent, database updated"
      );

      return {
        success: true,
        message: "Verification code sent to your new email address",
      };
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "Unknown";
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(
        {
          userId,
          email: user.email,
          newEmail: data.newEmail,
          errorName,
          errorMessage,
        },
        "Failed to initiate email change"
      );

      if (error instanceof NotAuthorizedException) {
        throw new AppError(400, "INVALID_PASSWORD", "Current password is incorrect");
      }

      if (error instanceof AliasExistsException) {
        throw new AppError(
          400,
          "EMAIL_IN_USE",
          "This email address is already registered in the system"
        );
      }

      throw new AppError(500, "INTERNAL_ERROR", `Failed to initiate email change: ${errorMessage}`);
    }
  }

  /**
   * Verify email change with code
   * Completes the email change process and updates the database
   */
  async verifyEmailChange(
    req: Request,
    userId: string,
    data: {
      code: string;
      newEmail: string; // The new email (Cognito email was already updated in initiate step)
      password: string; // Need password to get access token for verification
    }
  ): Promise<{ success: boolean; newEmail: string }> {
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);

    // Get user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    // Determine portal from token for access logging
    let portal: string | undefined;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const payload = verifyToken(token);
        portal = getPortalFromRole(payload.activeRole);
      }
    } catch {
      // Ignore token verification errors for portal detection
    }

    try {
      // Get Cognito access token by authenticating with the NEW email
      // (Cognito email was already changed in initiate step, pending verification)
      logger.info({ oldEmail: user.email, newEmail: data.newEmail }, "Verifying email change code");

      const secretHash = computeSecretHash(data.newEmail);
      const authCommand = new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: data.newEmail,
          PASSWORD: data.password,
          SECRET_HASH: secretHash,
        },
      });

      const authResult = await cognitoClient.send(authCommand);
      const cognitoAccessToken = authResult.AuthenticationResult?.AccessToken;

      if (!cognitoAccessToken) {
        throw new AppError(500, "INTERNAL_ERROR", "Failed to obtain access token");
      }

      // Verify the email attribute with the code
      const verifyCommand = new VerifyUserAttributeCommand({
        AccessToken: cognitoAccessToken,
        AttributeName: "email",
        Code: data.code,
      });

      await cognitoClient.send(verifyCommand);

      // Email was already updated in database during initiate step
      // Now just mark it as verified
      await prisma.user.update({
        where: { id: userId },
        data: { email_verified: true },
      });

      // Log successful email change verification
      await this.repository.createAccessLog({
        userId,
        eventType: "EMAIL_CHANGED",
        portal,
        ipAddress,
        userAgent,
        deviceInfo,
        deviceType,
        success: true,
        metadata: {
          newEmail: data.newEmail.toLowerCase(),
          reason: "USER_INITIATED",
        },
      });

      logger.info({ userId, newEmail: data.newEmail }, "Email change verified successfully");

      return {
        success: true,
        newEmail: data.newEmail.toLowerCase(),
      };
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "Unknown";
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log failed attempt
      await this.repository.createAccessLog({
        userId,
        eventType: "EMAIL_CHANGED",
        portal,
        ipAddress,
        userAgent,
        deviceInfo,
        deviceType,
        success: false,
        metadata: {
          reason: "USER_INITIATED",
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
        "Failed to verify email change"
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

      throw new AppError(500, "INTERNAL_ERROR", `Failed to verify email change: ${errorMessage}`);
    }
  }

  /**
   * Resend email verification code
   * For users with unverified email addresses
   */
  async resendEmailVerification(
    _req: Request,
    userId: string,
    data: {
      password: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    // Get user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    // Check if email is already verified
    if (user.email_verified) {
      throw new AppError(400, "ALREADY_VERIFIED", "Email is already verified");
    }

    try {
      // Authenticate to get Cognito access token
      logger.info({ email: user.email }, "Resending email verification code");

      const secretHash = computeSecretHash(user.email);
      const authCommand = new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: user.email,
          PASSWORD: data.password,
          SECRET_HASH: secretHash,
        },
      });

      const authResult = await cognitoClient.send(authCommand);
      const cognitoAccessToken = authResult.AuthenticationResult?.AccessToken;

      if (!cognitoAccessToken) {
        throw new AppError(500, "INTERNAL_ERROR", "Failed to obtain access token");
      }

      // Request new verification code
      const verificationCommand = new GetUserAttributeVerificationCodeCommand({
        AccessToken: cognitoAccessToken,
        AttributeName: "email",
      });

      await cognitoClient.send(verificationCommand);

      logger.info({ userId, email: user.email }, "Email verification code resent");

      return {
        success: true,
        message: "Verification code sent to your email address",
      };
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "Unknown";
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(
        {
          userId,
          email: user.email,
          errorName,
          errorMessage,
        },
        "Failed to resend email verification code"
      );

      if (error instanceof NotAuthorizedException) {
        throw new AppError(400, "INVALID_PASSWORD", "Password is incorrect");
      }

      throw new AppError(
        500,
        "INTERNAL_ERROR",
        `Failed to resend verification code: ${errorMessage}`
      );
    }
  }

  /**
   * Verify email with code
   * For users with unverified email addresses
   */
  async verifyEmail(
    req: Request,
    userId: string,
    data: {
      code: string;
      password: string;
    }
  ): Promise<{ success: boolean }> {
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);

    // Get user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    // Check if email is already verified
    if (user.email_verified) {
      throw new AppError(400, "ALREADY_VERIFIED", "Email is already verified");
    }

    // Determine portal from token for access logging
    let portal: string | undefined;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const payload = verifyToken(token);
        portal = getPortalFromRole(payload.activeRole);
      }
    } catch {
      // Ignore token verification errors for portal detection
    }

    try {
      // Authenticate to get Cognito access token
      logger.info({ email: user.email }, "Verifying email");

      const secretHash = computeSecretHash(user.email);
      const authCommand = new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: user.email,
          PASSWORD: data.password,
          SECRET_HASH: secretHash,
        },
      });

      const authResult = await cognitoClient.send(authCommand);
      const cognitoAccessToken = authResult.AuthenticationResult?.AccessToken;

      if (!cognitoAccessToken) {
        throw new AppError(500, "INTERNAL_ERROR", "Failed to obtain access token");
      }

      // Verify the email attribute with the code
      const verifyCommand = new VerifyUserAttributeCommand({
        AccessToken: cognitoAccessToken,
        AttributeName: "email",
        Code: data.code,
      });

      await cognitoClient.send(verifyCommand);

      // Update email_verified in database
      await prisma.user.update({
        where: { id: userId },
        data: { email_verified: true },
      });

      // Log successful verification
      await this.repository.createAccessLog({
        userId,
        eventType: "EMAIL_CHANGED",
        portal,
        ipAddress,
        userAgent,
        deviceInfo,
        deviceType,
        success: true,
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

      // Log failed attempt
      await this.repository.createAccessLog({
        userId,
        eventType: "EMAIL_CHANGED",
        portal,
        ipAddress,
        userAgent,
        deviceInfo,
        deviceType,
        success: false,
        metadata: {
          email: user.email,
          reason: "VERIFICATION_FAILED",
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
}
