import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { getCognitoLogoutUrl, getCognitoConfig } from "../../config/aws";
import { getOpenIdClient, generators } from "../../lib/openid-client";
import { verifyToken, generateTokenPair } from "../../lib/auth/jwt";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { getEnv } from "../../config/env";
import { detectRoleFromRequest, getPortalFromRole } from "../../lib/role-detector";
import { UserRole } from "@prisma/client";
import { extractRequestMetadata, getDeviceFingerprint } from "../../lib/http/request-utils";
import { AppError } from "../../lib/http/error-handler";
import {
  CognitoIdentityProviderClient,
  AdminUserGlobalSignOutCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const router = Router();

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || "ap-southeast-5",
});

function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

router.get("/login", async (req: Request, res: Response, next: NextFunction) => {
  const correlationId = generateCorrelationId();

  try {
    const detectedRole = detectRoleFromRequest(req);
    const requestedRole = detectedRole || UserRole.INVESTOR;

    // Explicitly log what we're detecting
    logger.info(
      {
        correlationId,
        queryRole: req.query.role,
        detectedRole,
        requestedRole,
        requestedRoleString: requestedRole.toString(),
        origin: req.get("origin"),
        referer: req.get("referer"),
        host: req.get("host"),
      },
      "Login redirect requested"
    );

    // Prepare OAuth security tokens
    const client = getOpenIdClient();
    const nonce = generators.nonce(); // Nonce is a random string used to prevent replay attacks
    const state = generators.state(); // State is a random string used to prevent CSRF attacks

    // Store the requested role in the session
    const session = req.session as typeof req.session & {
      requestedRole?: string;
      signup?: boolean;
    };
    session.nonce = nonce;
    session.state = state;
    // Store as uppercase string to ensure consistency
    const roleToStore = requestedRole.toString().toUpperCase();
    session.requestedRole = roleToStore;

    logger.info(
      {
        correlationId,
        requestedRoleBeforeStore: requestedRole,
        storedRequestedRole: session.requestedRole,
        roleToStore,
        sessionId: req.sessionID,
      },
      "Stored requested role in session"
    );

    const signupParam = req.query.signup === "true";
    if (signupParam) {
      session.signup = true;
    }

    req.session.save((err) => {
      if (err) {
        logger.error({ correlationId, error: err }, "Failed to save session");
        return next(err);
      }

      try {
        let authUrl = client.authorizationUrl({
          scope: "openid email",
          state: state,
          nonce: nonce,
        });

        // For signup flow, redirect to Cognito's /signup endpoint instead of /login
        if (signupParam) {
          // Replace /oauth2/authorize or /login with /signup
          authUrl = authUrl.replace(/\/oauth2\/authorize|\/login/, "/signup");
        }

        logger.info(
          { correlationId, requestedRole: session.requestedRole, isSignup: signupParam, authUrl },
          "Redirecting to Cognito authorization"
        );
        res.redirect(authUrl);
      } catch (error) {
        logger.error({ correlationId, error }, "Failed to generate authorization URL");
        return next(error);
      }
    });
  } catch (error) {
    logger.error({ correlationId, error }, "Failed to generate authorization URL");
    return next(error);
  }
});

router.get("/callback", async (req: Request, res: Response, next: NextFunction) => {
  const correlationId = generateCorrelationId();

  try {
    logger.info(
      {
        correlationId,
        hasSession: !!req.session,
        nonce: !!req.session?.nonce,
        state: !!req.session?.state,
      },
      "OAuth callback received"
    );

    // Check for Cognito error responses
    if (req.query.error) {
      const error = req.query.error as string;
      const errorDescription = req.query.error_description as string | undefined;
      const session = req.session as typeof req.session & {
        requestedRole?: string;
        signup?: boolean;
      };
      const isSignup = session?.signup === true;

      logger.error(
        { correlationId, error, errorDescription, query: req.query, isSignup },
        "Cognito returned an error"
      );

      // If it's a signup flow and user already exists, redirect to login instead
      if (
        isSignup &&
        (errorDescription?.toLowerCase().includes("already exists") ||
          errorDescription?.toLowerCase().includes("user already exists"))
      ) {
        logger.info(
          { correlationId, email: errorDescription },
          "User already exists, redirecting to login"
        );
        const env = getEnv();
        const loginUrl = new URL(`${env.FRONTEND_URL}/get-started`);
        loginUrl.searchParams.set("error", "user_exists");
        loginUrl.searchParams.set(
          "message",
          "An account with this email already exists. Please sign in instead."
        );
        return res.redirect(loginUrl.toString());
      }

      throw new AppError(
        400,
        "COGNITO_ERROR",
        errorDescription || error || "Authentication failed"
      );
    }

    const client = getOpenIdClient();
    const config = getCognitoConfig();
    const params = client.callbackParams(req);

    const stateFromQuery = params.state;
    if (req.session?.state) {
      if (stateFromQuery !== req.session.state) {
        logger.error(
          { correlationId, sessionState: req.session.state, queryState: stateFromQuery },
          "State mismatch"
        );
        throw new AppError(400, "INVALID_STATE", "State mismatch - possible CSRF attack");
      }
    } else {
      logger.warn(
        { correlationId },
        "Session state not found, proceeding without state validation"
      );
    }

    const callbackOptions: { nonce?: string; state?: string } = {};
    if (req.session?.nonce) {
      callbackOptions.nonce = req.session.nonce;
    }
    if (req.session?.state) {
      callbackOptions.state = req.session.state;
    }

    logger.info(
      {
        correlationId,
        redirectUri: config.redirectUri,
        hasCode: !!params.code,
        hasState: !!params.state,
        hasSessionNonce: !!req.session?.nonce,
        hasSessionState: !!req.session?.state,
      },
      "Exchanging code for tokens"
    );

    let tokenSet;
    try {
      // Always pass callbackOptions as an object, never undefined
      // When session is missing, openid-client will skip CSRF checks
      tokenSet = await client.callback(config.redirectUri, params, callbackOptions);

      logger.info(
        { correlationId, hasAccessToken: !!tokenSet.access_token, hasIdToken: !!tokenSet.id_token },
        "Token exchange successful"
      );
    } catch (error) {
      logger.error(
        { correlationId, error: error instanceof Error ? error.message : String(error) },
        "Token exchange failed"
      );
      throw new AppError(
        400,
        "TOKEN_EXCHANGE_FAILED",
        `Token exchange failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (!tokenSet.access_token) {
      throw new AppError(400, "NO_ACCESS_TOKEN", "No access token received from Cognito");
    }

    let userInfo;
    try {
      userInfo = await client.userinfo(tokenSet.access_token);
      logger.info(
        { correlationId, hasSub: !!userInfo.sub, hasEmail: !!userInfo.email },
        "User info retrieved"
      );
    } catch (error) {
      logger.error(
        { correlationId, error: error instanceof Error ? error.message : String(error) },
        "Failed to get user info"
      );
      throw new AppError(
        400,
        "USER_INFO_FAILED",
        `Failed to get user info: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const cognitoId = userInfo.sub as string;
    const email = userInfo.email as string;
    const firstName =
      (userInfo.given_name as string) || (userInfo.name as string)?.split(" ")[0] || "";
    const lastName =
      (userInfo.family_name as string) ||
      (userInfo.name as string)?.split(" ").slice(1).join(" ") ||
      "";

    if (!cognitoId || !email) {
      throw new AppError(400, "MISSING_USER_INFO", "Missing user information in token");
    }

    logger.info({ correlationId, cognitoId, email }, "User info retrieved from Cognito");

    const session = req.session as typeof req.session & {
      requestedRole?: string;
      signup?: boolean;
    };
    // Ensure requestedRole is a valid UserRole enum value
    const requestedRoleStr = session?.requestedRole;
    let requestedRole: UserRole = UserRole.INVESTOR; // Default fallback

    logger.info(
      {
        correlationId,
        requestedRoleStrFromSession: requestedRoleStr,
        sessionKeys: session ? Object.keys(session) : [],
        fullSession: JSON.stringify(session),
      },
      "Retrieving requested role from session"
    );

    if (requestedRoleStr) {
      // Try to match the string value to a UserRole enum
      const upperRole = requestedRoleStr.toUpperCase().trim();
      if (upperRole === "INVESTOR") {
        requestedRole = UserRole.INVESTOR;
      } else if (upperRole === "ISSUER") {
        requestedRole = UserRole.ISSUER;
      } else if (upperRole === "ADMIN") {
        requestedRole = UserRole.ADMIN;
      } else {
        logger.warn(
          { correlationId, requestedRoleStr, upperRole },
          "Invalid requestedRole in session, defaulting to INVESTOR"
        );
      }
    } else {
      logger.warn(
        { correlationId, sessionKeys: session ? Object.keys(session) : [] },
        "No requestedRole in session, defaulting to INVESTOR"
      );
    }

    const isSignup = session?.signup === true;

    logger.info(
      {
        correlationId,
        requestedRoleStr,
        requestedRole,
        requestedRoleString: requestedRole.toString(),
        isSignup,
        sessionKeys: session ? Object.keys(session) : [],
      },
      "Processing callback with requested role"
    );

    let user = await prisma.user.findUnique({
      where: { cognito_sub: cognitoId },
    });

    if (!user) {
      user = await prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        logger.info(
          { correlationId, userId: user.id, email },
          "User found by email, updating cognito_sub"
        );
        user = await prisma.user.update({
          where: { id: user.id },
          data: { cognito_sub: cognitoId },
        });
      }
    }

    if (!user) {
      // Don't assign roles during signup - roles will be added after onboarding completion
      const initialRoles: UserRole[] = [];
      // Only assign ADMIN role immediately (admin users are created differently)
      if (isSignup && requestedRole === UserRole.ADMIN) {
        initialRoles.push(UserRole.ADMIN);
      }

      try {
        user = await prisma.user.create({
          data: {
            cognito_sub: cognitoId,
            cognito_username: email,
            email,
            roles: initialRoles,
            first_name: firstName,
            last_name: lastName,
            email_verified: true,
          },
        });

        logger.info(
          { correlationId, userId: user.id, email, roles: initialRoles, requestedRole, isSignup },
          "User created in database (roles will be added after onboarding)"
        );
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
          logger.warn(
            { correlationId, error },
            "User creation failed due to unique constraint, attempting to find existing user"
          );
          user = await prisma.user.findUnique({
            where: { email },
          });

          if (user && user.cognito_sub !== cognitoId) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { cognito_sub: cognitoId },
            });
          }

          if (!user) {
            throw new AppError(500, "USER_CREATION_FAILED", "Failed to create or find user");
          }
        } else {
          throw error;
        }
      }
    } else {
      if (firstName && user.first_name !== firstName) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { first_name: firstName },
        });
      }
      if (lastName && user.last_name !== lastName) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { last_name: lastName },
        });
      }

      logger.info({ correlationId, userId: user.id, email }, "User found in database");
    }

    // Determine active role:
    // Always use the requestedRole (from the login button clicked)
    // This ensures users go to the portal they requested, even if they don't have that role yet
    const activeRole: UserRole = requestedRole;

    logger.info(
      {
        correlationId,
        requestedRole,
        activeRole,
        activeRoleString: activeRole.toString(),
        userHasRequestedRole: user.roles.includes(requestedRole),
        userRoles: user.roles,
      },
      "Determined active role"
    );

    // Generate token pair (access + refresh)
    const tokens = generateTokenPair(user.id, user.email, user.roles, activeRole);

    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);
    const deviceFingerprint = getDeviceFingerprint(req);
    const portal = getPortalFromRole(activeRole);

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        user_id: user.id,
        expires_at: tokens.refreshTokenExpiresAt,
        device_fingerprint: deviceFingerprint,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
    });

    // Create access log
    await prisma.accessLog.create({
      data: {
        user_id: user.id,
        event_type: isSignup ? "SIGNUP" : "LOGIN",
        portal,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_info: deviceInfo,
        device_type: deviceType,
        success: true,
        metadata: {
          requestedRole,
          activeRole,
          roles: user.roles,
        },
      },
    });

    // Set HTTP-Only cookies for tokens
    const env = getEnv();
    res.cookie("access_token", tokens.accessToken, {
      httpOnly: true, // XSS protection - cannot be accessed by JavaScript
      secure: env.NODE_ENV === "production", // HTTPS only in production
      sameSite: "strict", // CSRF protection
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: "/",
      domain: env.COOKIE_DOMAIN,
    });

    res.cookie("refresh_token", tokens.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: env.NODE_ENV === "production" ? "strict" : "lax", // Lax for dev cross-origin
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/", // Available to all paths (needed for /v1/auth/refresh)
      domain: env.COOKIE_DOMAIN,
    });

    // Clear session data
    req.session.nonce = undefined;
    req.session.state = undefined;
    req.session.requestedRole = undefined;
    req.session.signup = undefined;

    logger.info(
      {
        correlationId,
        userId: user.id,
        activeRole,
        requestedRole,
        userRoles: user.roles,
        hasRole: user.roles.includes(activeRole),
        investorOnboarding: user.investor_onboarding_completed,
        issuerOnboarding: user.issuer_onboarding_completed,
      },
      "Authentication successful - tokens set in HTTP-Only cookies"
    );

    const frontendUrl = env.FRONTEND_URL;

    const redirectUrl = new URL("/callback", frontendUrl);

    // In development, cookies won't work across different origins (localhost:4000 vs localhost:3000)
    // So we pass token in URL for dev, but use cookies only in production
    const isDevelopment = env.NODE_ENV === "development";

    if (isDevelopment || !env.COOKIE_DOMAIN) {
      // Development: Pass tokens in URL (necessary for cross-origin)
      // This is less secure but required when API and frontend are on different ports
      redirectUrl.searchParams.set("token", tokens.accessToken);
      redirectUrl.searchParams.set("refresh_token", tokens.refreshToken); // Also pass refresh token for dev mode
      logger.info(
        {
          correlationId,
          redirectUrl: redirectUrl.toString(),
          reason: "Development mode - tokens in URL",
        },
        "Redirecting to callback with tokens in URL (dev mode)"
      );
    } else {
      // Production: Token in HTTP-Only cookies only (more secure)
      // Frontend callback should verify cookie exists via API call
      logger.info(
        {
          correlationId,
          redirectUrl: redirectUrl.toString(),
          reason: "Production mode - token in cookies",
        },
        "Redirecting to callback with token in cookies (prod mode)"
      );
    }

    // Always include the role in the redirect URL so the callback page knows which portal to redirect to
    redirectUrl.searchParams.set("role", activeRole.toString());

    // Check onboarding status for the active role
    // If user doesn't have the role yet, they need to complete onboarding first
    const hasRole = user.roles.includes(activeRole);
    const onboardingCompleted =
      (activeRole === UserRole.INVESTOR && user.investor_onboarding_completed) ||
      (activeRole === UserRole.ISSUER && user.issuer_onboarding_completed) ||
      activeRole === UserRole.ADMIN;

    // Redirect to onboarding if:
    // 1. User doesn't have the role yet (needs to complete onboarding to get it)
    // 2. User has the role but hasn't completed onboarding
    if (!hasRole || !onboardingCompleted) {
      redirectUrl.searchParams.set("onboarding", "required");
    }

    res.redirect(redirectUrl.toString());
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error(
      {
        correlationId,
        error: errorMessage,
        stack: errorStack,
        hasSession: !!req.session,
        sessionKeys: req.session ? Object.keys(req.session) : [],
      },
      "Callback error"
    );

    if (error instanceof z.ZodError) {
      return next(
        new AppError(400, "VALIDATION_ERROR", "Missing authorization code", error.errors)
      );
    }

    return next(error);
  }
});

router.get("/logout", async (req: Request, res: Response) => {
  const correlationId = generateCorrelationId();
  logger.info({ correlationId }, "Logout requested");

  // Try to extract user info from token before destroying session
  // Check HTTP-Only cookie first, then fallback to Authorization header (for API clients)
  const tokenFromCookie = req.cookies?.access_token;
  const authHeader = req.headers.authorization;
  const token =
    tokenFromCookie || (authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined);

  let cognitoSub: string | undefined;
  let portal: string | undefined;
  let userId: string | undefined;

  if (token) {
    try {
      const payload = verifyToken(token);
      userId = payload.userId;
      const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);
      portal = getPortalFromRole(payload.activeRole);

      // Get user's cognito_sub to sign out from Cognito
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { cognito_sub: true },
      });

      if (user) {
        cognitoSub = user.cognito_sub;
      }

      // Revoke ALL refresh tokens for this user
      const revokedCount = await prisma.refreshToken.updateMany({
        where: {
          user_id: payload.userId,
          revoked: false,
        },
        data: {
          revoked: true,
          revoked_at: new Date(),
          revoked_reason: "USER_LOGOUT",
        },
      });

      logger.info(
        { correlationId, userId: payload.userId, revokedTokens: revokedCount.count },
        "Revoked all refresh tokens for user"
      );

      // Create access log before destroying session or signing out
      await prisma.accessLog.create({
        data: {
          user_id: payload.userId,
          event_type: "LOGOUT",
          portal,
          ip_address: ipAddress,
          user_agent: userAgent,
          device_info: deviceInfo,
          device_type: deviceType,
          success: true,
          metadata: {
            activeRole: payload.activeRole,
            roles: payload.roles,
            revokedTokens: revokedCount.count,
          },
        },
      });

      logger.info({ correlationId, userId: payload.userId, portal }, "Logout access log created");
    } catch (error) {
      // If token is invalid/expired, log warning but continue with logout
      logger.warn(
        { correlationId, error: error instanceof Error ? error.message : String(error) },
        "Failed to create logout access log - token invalid or expired"
      );
    }
  } else {
    logger.warn({ correlationId }, "No token provided for logout - access log will not be created");
  }

  // Clear HTTP-Only cookies
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/api/auth/refresh" });

  // Sign out from Cognito using AdminUserGlobalSignOut
  // This revokes all tokens and signs out the user from all devices
  // According to AWS docs: https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html
  // The /logout endpoint is a redirection endpoint that signs out the user
  if (cognitoSub) {
    try {
      const config = getCognitoConfig();
      const command = new AdminUserGlobalSignOutCommand({
        UserPoolId: config.userPoolId,
        Username: cognitoSub,
      });

      await cognitoClient.send(command);
      logger.info(
        { correlationId, cognitoSub },
        "User signed out from Cognito successfully via AdminUserGlobalSignOut"
      );
    } catch (error) {
      // Log error but don't fail - Cognito sign out is best effort
      // The redirect to Cognito logout URL will still handle client-side logout
      logger.warn(
        {
          correlationId,
          cognitoSub,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to sign out from Cognito via AdminUserGlobalSignOut - continuing with logout redirect"
      );
    }
  }

  // Destroy express session
  req.session.destroy((err) => {
    if (err) {
      logger.error({ correlationId, error: err }, "Failed to destroy session");
    } else {
      logger.info({ correlationId }, "Express session destroyed");
    }
  });

  // Redirect to Cognito's /logout endpoint
  // According to AWS docs, this endpoint requires client_id and logout_uri parameters
  // It will sign out the user from the hosted UI and redirect them back
  const logoutUrl = getCognitoLogoutUrl();
  logger.info(
    { correlationId, logoutUrl, userId, portal },
    "Redirecting to Cognito logout endpoint"
  );
  res.redirect(logoutUrl);
});

export default router;
