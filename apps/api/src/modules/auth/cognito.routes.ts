import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { getCognitoConfig } from "../../config/aws";
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
import { encryptOAuthState, decryptOAuthState, createOAuthState } from "../../lib/auth/oauth-state";

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

    // CRITICAL: Admin portal is sign-in only - never allow sign-up
    const signupParam = req.query.signup === "true";
    if (requestedRole === UserRole.ADMIN && signupParam) {
      logger.warn(
        {
          correlationId,
          requestedRole,
          attemptedSignup: signupParam,
        },
        "Sign-up attempt blocked for admin role - admin portal is sign-in only"
      );
      
      // Redirect back to admin login without signup parameter
      const adminLoginUrl = new URL(req.originalUrl.split("?")[0], `${req.protocol}://${req.get("host")}`);
      adminLoginUrl.searchParams.set("role", "ADMIN");
      return res.redirect(adminLoginUrl.toString());
    }

    // Prepare OAuth security tokens
    const client = getOpenIdClient();
    const nonce = generators.nonce(); // Nonce is a random string used to prevent replay attacks
    const oauthState = generators.state(); // State is a random string used to prevent CSRF attacks

    // Instead of storing in session (Safari ITP blocks cookies), encrypt state and embed in URL
    // This is Safari-proof and more secure for cross-domain OAuth flows
    // createOAuthState adds a unique stateId for replay attack prevention
    const stateData = encryptOAuthState(
      createOAuthState({
        nonce,
        state: oauthState,
        requestedRole: requestedRole.toString().toUpperCase(),
        signup: signupParam,
        timestamp: Date.now(),
      })
    );

    logger.info(
      {
        correlationId,
        requestedRole: requestedRole.toString().toUpperCase(),
        isSignup: signupParam,
        method: "encrypted-state",
      },
      "Prepared OAuth state (encrypted, no cookies)"
    );

    try {
      let authUrl = client.authorizationUrl({
        scope: "openid email",
        state: stateData, // Use encrypted state instead of raw state
        nonce: nonce,
      });

      // For signup flow, redirect to Cognito's /signup endpoint instead of /login
      if (signupParam) {
        // Replace /oauth2/authorize or /login with /signup
        authUrl = authUrl.replace(/\/oauth2\/authorize|\/login/, "/signup");
      }

      logger.info(
        {
          correlationId,
          requestedRole: requestedRole.toString().toUpperCase(),
          isSignup: signupParam,
          authUrl,
          stateMethod: "encrypted-in-url",
        },
        "Redirecting to Cognito authorization"
      );
      res.redirect(authUrl);
    } catch (error) {
      logger.error({ correlationId, error }, "Failed to generate authorization URL");
      return next(error);
    }
  } catch (error) {
    logger.error({ correlationId, error }, "Failed to generate authorization URL");
    return next(error);
  }
});

router.get("/callback", async (req: Request, res: Response, next: NextFunction) => {
  const correlationId = generateCorrelationId();

  try {
    // Decrypt the state parameter to get nonce, state, role, etc.
    // This is Safari-proof - no cookies needed!
    const client = getOpenIdClient();
    const params = client.callbackParams(req);
    const encryptedState = params.state;

    if (!encryptedState) {
      throw new AppError(400, "MISSING_STATE", "OAuth state parameter is missing");
    }

    let stateData;
    try {
      stateData = decryptOAuthState(encryptedState);
    } catch (error) {
      logger.error(
        { correlationId, error: error instanceof Error ? error.message : String(error) },
        "Failed to decrypt OAuth state"
      );
      throw new AppError(400, "INVALID_STATE", "Invalid or expired OAuth state");
    }

    logger.info(
      {
        correlationId,
        hasNonce: !!stateData.nonce,
        hasState: !!stateData.state,
        requestedRole: stateData.requestedRole,
        isSignup: stateData.signup,
        stateAge: Date.now() - stateData.timestamp,
        method: "encrypted-state",
      },
      "OAuth callback received - state decrypted"
    );

    // Check for Cognito error responses
    if (req.query.error) {
      const error = req.query.error as string;
      const errorDescription = req.query.error_description as string | undefined;

      logger.error(
        { correlationId, error, errorDescription, query: req.query, isSignup: stateData.signup },
        "Cognito returned an error"
      );

      // If it's a signup flow and user already exists, redirect to login instead
      if (
        stateData.signup &&
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

    const config = getCognitoConfig();

    logger.info(
      {
        correlationId,
        redirectUri: config.redirectUri,
        hasCode: !!params.code,
        hasState: !!params.state,
        hasNonce: !!stateData.nonce,
        originalState: stateData.state,
        encryptedState: params.state,
      },
      "Exchanging code for tokens"
    );

    let tokenSet;
    try {
      // IMPORTANT: Replace the encrypted state in params with the original state
      // The openid-client library expects the raw OAuth state, not our encrypted version
      const callbackParams = {
        ...params,
        state: stateData.state, // Use the decrypted original state
      };

      // Use the decrypted nonce and state for verification
      tokenSet = await client.callback(config.redirectUri, callbackParams, {
        nonce: stateData.nonce,
        state: stateData.state,
      });

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

    // Get requested role from decrypted state data (not session)
    const requestedRoleStr = stateData.requestedRole;
    let requestedRole: UserRole = UserRole.INVESTOR; // Default fallback

    logger.info(
      {
        correlationId,
        requestedRoleStr,
        isSignup: stateData.signup,
        source: "encrypted-state",
      },
      "Retrieving requested role from state"
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
          "Invalid requestedRole in state, defaulting to INVESTOR"
        );
      }
    } else {
      logger.warn({ correlationId }, "No requestedRole in state, defaulting to INVESTOR");
    }

    const isSignup = stateData.signup === true;

    logger.info(
      {
        correlationId,
        requestedRoleStr,
        requestedRole,
        requestedRoleString: requestedRole.toString(),
        isSignup,
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

    // Extract request metadata early (needed for both success and error cases)
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);

    // Determine active role:
    // Always use the requestedRole (from the login button clicked)
    // This ensures users go to the portal they requested, even if they don't have that role yet
    // EXCEPTION: ADMIN role requires explicit ADMIN role in database - no signup allowed
    const activeRole: UserRole = requestedRole;

    // CRITICAL: Admin portal is sign-in only - users must have ADMIN role in database
    if (requestedRole === UserRole.ADMIN && !user.roles.includes(UserRole.ADMIN)) {
      logger.warn(
        {
          correlationId,
          userId: user.id,
          email: user.email,
          requestedRole,
          userRoles: user.roles,
        },
        "User attempted to access admin portal without ADMIN role"
      );

      // Log failed admin access attempt
      await prisma.accessLog.create({
        data: {
          user_id: user.id,
          event_type: "LOGIN",
          portal: "admin",
          ip_address: ipAddress,
          user_agent: userAgent,
          device_info: deviceInfo,
          device_type: deviceType,
          success: false,
          metadata: {
            requestedRole,
            userRoles: user.roles,
            reason: "User does not have ADMIN role",
          },
        },
      });

      // Logout user from Cognito and redirect to landing page
      // This breaks the infinite loop where Cognito auto-authenticates the same user
      // User will need to manually navigate to admin portal again with correct credentials
      const apiBaseUrl = `${req.protocol}://${req.get("host")}`;
      const logoutUrl = new URL(`${apiBaseUrl}/v1/auth/cognito/logout`);
      
      logger.info(
        { correlationId, userId: user.id, redirectUrl: logoutUrl.toString() },
        "Logging out non-admin user from Cognito - will redirect to landing page"
      );
      
      return res.redirect(logoutUrl.toString());
    }

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

    // IMPORTANT: Since we use encrypted state (no cookies during OAuth flow),
    // we MUST pass tokens in URL for the callback page to work
    // Each portal has its own callback handler
    
    // Determine which portal callback to redirect to
    let callbackUrl: string;
    
    if (activeRole === UserRole.ADMIN && env.ADMIN_URL) {
      // Admin users go directly to admin callback
      callbackUrl = `${env.ADMIN_URL}/callback`;
    } else if (activeRole === UserRole.INVESTOR && env.INVESTOR_URL) {
      // Investor users go to investor callback (if exists) or landing callback
      callbackUrl = env.FRONTEND_URL + "/callback";
    } else if (activeRole === UserRole.ISSUER && env.ISSUER_URL) {
      // Issuer users go to issuer callback (if exists) or landing callback
      callbackUrl = env.FRONTEND_URL + "/callback";
    } else {
      // Default to landing callback
      callbackUrl = `${env.FRONTEND_URL}/callback`;
    }

    const redirectUrl = new URL(callbackUrl);
    redirectUrl.searchParams.set("token", tokens.accessToken);
    redirectUrl.searchParams.set("refresh_token", tokens.refreshToken);

    logger.info(
      {
        correlationId,
        redirectUrl: redirectUrl.toString(),
        tokenLength: tokens.accessToken.length,
        activeRole: activeRole.toString(),
        callbackUrl,
        method: "token-in-url",
      },
      "Redirecting to portal callback with tokens in URL"
    );

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
  
  // Try to detect portal from referer/origin if token doesn't have it
  // This helps when logout is called without a valid token
  const referer = req.get("referer") || req.get("origin");
  if (referer && !portal) {
    try {
      const url = new URL(referer);
      const hostname = url.hostname.toLowerCase();
      if (hostname.includes("admin")) {
        portal = "admin";
      } else if (hostname.includes("investor")) {
        portal = "investor";
      } else if (hostname.includes("issuer")) {
        portal = "issuer";
      }
    } catch (error) {
      // Ignore URL parsing errors
    }
  }

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
  // IMPORTANT: Must use the SAME options as when cookies were set (domain, path, secure, sameSite)
  // Otherwise cookies won't be properly cleared
  const envForCookies = getEnv();
  
  res.clearCookie("access_token", {
    httpOnly: true,
    secure: envForCookies.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    domain: envForCookies.COOKIE_DOMAIN,
  });
  
  // refresh_token uses same path "/" (not /api/auth/refresh)
  res.clearCookie("refresh_token", {
    httpOnly: true,
    secure: envForCookies.NODE_ENV === "production",
    sameSite: envForCookies.NODE_ENV === "production" ? "strict" : "lax",
    path: "/",
    domain: envForCookies.COOKIE_DOMAIN,
  });

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

  // IMPORTANT: Redirect through Cognito's /logout endpoint to clear OAuth/Hosted UI session
  // AdminUserGlobalSignOut only invalidates tokens, NOT the OAuth session
  // Without redirecting through Cognito's /logout, users can auto-login without entering credentials
  // 
  // We've already completed:
  // 1. Revoked all refresh tokens in database
  // 2. Cleared HTTP-Only cookies (access_token, refresh_token)
  // 3. Called AdminUserGlobalSignOut to invalidate Cognito tokens (if IAM permissions allow)
  // 4. Destroyed Express session
  //
  // Now redirect through Cognito's /logout to clear OAuth session
  const env = getEnv();
  const config = getCognitoConfig();
  
  // Determine final redirect URL based on portal
  let finalRedirectUrl: string;
  if (portal === "admin" && env.ADMIN_URL) {
    finalRedirectUrl = env.ADMIN_URL;
  } else if (portal === "investor" && env.INVESTOR_URL) {
    finalRedirectUrl = env.FRONTEND_URL;
  } else if (portal === "issuer" && env.ISSUER_URL) {
    finalRedirectUrl = env.FRONTEND_URL;
  } else {
    finalRedirectUrl = env.FRONTEND_URL;
  }
  
  // Build Cognito logout URL with logout_uri to redirect back to our portal
  // This requires logout_uri to be in Cognito's allowed logout URLs
  const cognitoLogoutUrl = `${config.domain}/logout?client_id=${config.clientId}&logout_uri=${encodeURIComponent(finalRedirectUrl)}`;
  
  logger.info(
    { correlationId, cognitoLogoutUrl, finalRedirectUrl, userId, portal },
    "Redirecting through Cognito logout to clear OAuth session"
  );
  res.redirect(cognitoLogoutUrl);
});

export default router;
