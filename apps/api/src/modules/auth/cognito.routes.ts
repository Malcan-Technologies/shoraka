import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { getCognitoConfig } from "../../config/aws";
import { getOpenIdClient, generators } from "../../lib/openid-client";
import { verifyCognitoAccessToken } from "../../lib/auth/cognito-jwt-verifier";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { getEnv } from "../../config/env";
import { detectRoleFromRequest, getPortalFromRole } from "../../lib/role-detector";
import { UserRole } from "@prisma/client";
import { extractRequestMetadata } from "../../lib/http/request-utils";
import { AppError } from "../../lib/http/error-handler";
import {
  CognitoIdentityProviderClient,
  AdminUserGlobalSignOutCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { encryptOAuthState, decryptOAuthState, createOAuthState } from "../../lib/auth/oauth-state";
import { AuthRepository } from "./repository";

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
      const adminLoginUrl = new URL(
        req.originalUrl.split("?")[0],
        `${req.protocol}://${req.get("host")}`
      );
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

router.get("/callback", async (req: Request, res: Response) => {
  const correlationId = generateCorrelationId();

  try {
    // Decrypt the state parameter to get nonce, state, role, etc.
    // This is Safari-proof - no cookies needed!
    const client = getOpenIdClient();
    const params = client.callbackParams(req);
    const encryptedState = params.state;

    if (!encryptedState) {
      // Redirect to user-friendly error page for missing state
      const env = getEnv();
      const errorUrl = new URL(`${env.FRONTEND_URL}/auth-error`);
      errorUrl.searchParams.set("error", "missing_state");
      errorUrl.searchParams.set(
        "message",
        "Authentication session is missing. Please sign in again."
      );
      return res.redirect(errorUrl.toString());
    }

    let stateData;
    try {
      stateData = decryptOAuthState(encryptedState);
    } catch (error) {
      logger.error(
        { correlationId, error: error instanceof Error ? error.message : String(error) },
        "Failed to decrypt OAuth state"
      );

      // Redirect to user-friendly error page instead of throwing JSON error
      // This handles cases where user clicks back button and tries to reuse expired state
      const env = getEnv();
      const errorUrl = new URL(`${env.FRONTEND_URL}/auth-error`);
      errorUrl.searchParams.set("error", "expired_session");
      errorUrl.searchParams.set("message", "Your login session has expired. Please sign in again.");
      return res.redirect(errorUrl.toString());
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

    // Check if user exists by cognito_sub first
    let existingUser = await prisma.user.findUnique({
      where: { cognito_sub: cognitoId },
    });

    // If not found by cognito_sub, check by email (for migration scenarios)
    // This handles users who existed before Cognito integration
    if (!existingUser) {
      existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        logger.info(
          { correlationId, userId: existingUser.id, email },
          "User found by email (migration scenario), updating cognito_sub"
        );
        // Update the cognito_sub for this user
        existingUser = await prisma.user.update({
          where: { id: existingUser.id },
          data: { cognito_sub: cognitoId },
        });
      }
    }

    // Use AuthRepository to handle user creation/update with user_id assignment
    const authRepository = new AuthRepository();

    // Don't assign roles during signup - roles will be added after onboarding completion
    const initialRoles: UserRole[] = [];
    // Only assign ADMIN role immediately (admin users are created differently)
    if (isSignup && requestedRole === UserRole.ADMIN) {
      initialRoles.push(UserRole.ADMIN);
    }

    // If user exists, preserve their existing roles (don't overwrite with initialRoles)
    const rolesToUse =
      existingUser && existingUser.roles.length > 0 ? existingUser.roles : initialRoles;

    const user = await authRepository.upsertUser({
      cognitoSub: cognitoId,
      cognitoUsername: email,
      email,
      emailVerified: true,
      roles: rolesToUse,
      firstName,
      lastName,
    });

    logger.info(
      {
        correlationId,
        userId: user.id,
        email,
        roles: user.roles,
        hasUserId: !!user.user_id,
        requestedRole,
        isSignup,
        wasMigration: !!existingUser && !existingUser.cognito_sub,
      },
      "User synced via repository (upsert with user_id assignment)"
    );

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

    const portal = getPortalFromRole(activeRole);

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
      "Authentication successful - setting Amplify cookies"
    );

    // Set Cognito tokens as cookies for Amplify to read
    // Amplify expects these cookie names for its session management
    const env = getEnv();
    const cookieDomain = process.env.NODE_ENV === "production" ? ".cashsouk.com" : "localhost";
    const isSecure = process.env.NODE_ENV === "production";

    // Set access token cookie (Amplify format)
    res.cookie(`CognitoIdentityServiceProvider.${env.COGNITO_CLIENT_ID}.LastAuthUser`, cognitoId, {
      httpOnly: false, // Amplify needs to read this
      secure: isSecure,
      sameSite: "lax",
      domain: cookieDomain,
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.cookie(
      `CognitoIdentityServiceProvider.${env.COGNITO_CLIENT_ID}.${cognitoId}.accessToken`,
      tokenSet.access_token,
      {
        httpOnly: false, // Amplify needs to read this
        secure: isSecure,
        sameSite: "lax",
        domain: cookieDomain,
        path: "/",
        maxAge: 60 * 60 * 1000, // 1 hour (access token expiry)
      }
    );

    if (tokenSet.id_token) {
      res.cookie(
        `CognitoIdentityServiceProvider.${env.COGNITO_CLIENT_ID}.${cognitoId}.idToken`,
        tokenSet.id_token,
        {
          httpOnly: false, // Amplify needs to read this
          secure: isSecure,
          sameSite: "lax",
          domain: cookieDomain,
          path: "/",
          maxAge: 60 * 60 * 1000, // 1 hour
        }
      );
    }

    if (tokenSet.refresh_token) {
      res.cookie(
        `CognitoIdentityServiceProvider.${env.COGNITO_CLIENT_ID}.${cognitoId}.refreshToken`,
        tokenSet.refresh_token,
        {
          httpOnly: false, // Amplify needs to read this
          secure: isSecure,
          sameSite: "lax",
          domain: cookieDomain,
          path: "/",
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        }
      );
    }

    // Set clock drift cookie (Amplify uses this)
    res.cookie(
      `CognitoIdentityServiceProvider.${env.COGNITO_CLIENT_ID}.${cognitoId}.clockDrift`,
      "0",
      {
        httpOnly: false,
        secure: isSecure,
        sameSite: "lax",
        domain: cookieDomain,
        path: "/",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      }
    );

    logger.info(
      {
        correlationId,
        userId: user.id,
        cognitoId,
        cookieDomain,
        cookiesSet: ["accessToken", "idToken", "refreshToken", "LastAuthUser", "clockDrift"],
      },
      "Amplify cookies set successfully"
    );

    // IMPORTANT: ALL OAuth callbacks go to landing page callback
    // Landing page will handle portal-specific routing based on roles and portal parameter
    // Amplify will now be able to read tokens from cookies
    const callbackUrl = `${env.FRONTEND_URL}/callback`;
    const redirectUrl = new URL(callbackUrl);

    // Determine target portal based on requestedRole (from state) or activeRole
    // requestedRole is what the user originally clicked on (e.g., "Login as Investor")
    // activeRole is what we assigned (may differ if user already has another role)
    const targetPortal =
      requestedRole?.toLowerCase() ||
      (activeRole === UserRole.ADMIN
        ? "admin"
        : activeRole === UserRole.INVESTOR
          ? "investor"
          : activeRole === UserRole.ISSUER
            ? "issuer"
            : "landing");

    redirectUrl.searchParams.set("portal", targetPortal);

    // Check if user has the requested role
    const hasRequestedRole = requestedRole ? user.roles.includes(requestedRole) : false;

    // Check onboarding status for the active role
    const onboardingCompleted =
      (activeRole === UserRole.INVESTOR && user.investor_onboarding_completed) ||
      (activeRole === UserRole.ISSUER && user.issuer_onboarding_completed) ||
      activeRole === UserRole.ADMIN;

    // Pass onboarding flag if user needs to complete onboarding
    if (!hasRequestedRole || !onboardingCompleted) {
      redirectUrl.searchParams.set("onboarding", "required");
    }

    logger.info(
      {
        correlationId,
        userId: user.id,
        redirectUrl: redirectUrl.toString(),
        activeRole: activeRole.toString(),
        requestedRole,
        targetPortal,
        hasRequestedRole,
        onboardingCompleted,
        method: "amplify-managed-tokens",
      },
      "Redirecting to landing callback - tokens managed by Amplify"
    );

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

    // Redirect to user-friendly error page instead of showing JSON error
    const env = getEnv();
    const errorUrl = new URL(`${env.FRONTEND_URL}/auth-error`);

    if (error instanceof AppError) {
      // Map specific error codes to user-friendly messages
      let userMessage = error.message;
      if (error.code === "INVALID_STATE" || error.code === "MISSING_STATE") {
        userMessage = "Your login session has expired. Please sign in again.";
      } else if (error.code === "TOKEN_EXCHANGE_FAILED") {
        userMessage = "Authentication failed. Please try signing in again.";
      } else if (error.code === "COGNITO_ERROR") {
        userMessage = "Authentication service error. Please try again.";
      }

      errorUrl.searchParams.set("error", error.code);
      errorUrl.searchParams.set("message", userMessage);
    } else if (error instanceof z.ZodError) {
      errorUrl.searchParams.set("error", "VALIDATION_ERROR");
      errorUrl.searchParams.set("message", "Invalid authentication request. Please try again.");
    } else {
      errorUrl.searchParams.set("error", "unknown_error");
      errorUrl.searchParams.set("message", "An unexpected error occurred. Please try again.");
    }

    return res.redirect(errorUrl.toString());
  }
});

router.get("/logout", async (req: Request, res: Response) => {
  const correlationId = generateCorrelationId();
  logger.info({ correlationId }, "Logout requested");

  // Try to extract user info from Cognito access token
  // Access token can be sent via:
  // 1. Authorization header (preferred) - stored in Amplify
  // 2. Query parameter ?token= (fallback for browser redirects)
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;
  const tokenFromQuery = req.query.token as string | undefined;
  const token = tokenFromHeader || tokenFromQuery;

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
      // Verify Cognito access token
      const cognitoPayload = await verifyCognitoAccessToken(token);
      cognitoSub = cognitoPayload.sub;

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { cognito_sub: cognitoPayload.sub },
        select: { id: true, roles: true },
      });

      if (user) {
        userId = user.id;
        const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);

        // Determine portal from user's roles if not detected from referer
        if (!portal && user.roles.length > 0) {
          portal = getPortalFromRole(user.roles[0]);
        }

        // Create access log before signing out
        await prisma.accessLog.create({
          data: {
            user_id: user.id,
            event_type: "LOGOUT",
            portal: portal || null,
            ip_address: ipAddress,
            user_agent: userAgent,
            device_info: deviceInfo,
            device_type: deviceType,
            success: true,
            metadata: {
              roles: user.roles,
            },
          },
        });

        logger.info({ correlationId, userId: user.id, portal }, "Logout access log created");
      }
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

  // Note: Amplify handles token clearing on the frontend
  // We don't need to clear cookies here as Amplify manages session storage

  // Sign out from Cognito using AdminUserGlobalSignOut
  // This revokes all tokens and signs out the user from all devices
  // According to AWS docs: https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html
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

  // Note: Amplify handles token clearing on the frontend
  // We don't need to clear cookies here as Amplify manages session storage
  // Backend only handles access logging and Cognito session revocation
  // Frontend will handle the redirect to Cognito logout URL

  // Return success response - let frontend handle redirect
  logger.info({ correlationId, userId, portal }, "Logout completed - returning success");
  return res.json({
    success: true,
    message: "Logged out successfully",
  });
});

export default router;
