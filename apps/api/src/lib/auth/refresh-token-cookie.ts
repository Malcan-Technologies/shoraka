import {
  CognitoIdentityProviderClient,
  RevokeTokenCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type { CookieOptions, Request, Response } from "express";
import { getEnv } from "../../config/env";
import { AppError } from "../http/error-handler";
import { logger } from "../logger";

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || "ap-southeast-5",
});

const COOKIE_PREFIX = "CognitoIdentityServiceProvider";

export function readCognitoRefreshTokenCookie(
  cookies: Record<string, unknown> | undefined,
  clientId: string
): { cookieName: string; refreshToken: string } | null {
  if (!cookies || typeof cookies !== "object" || !clientId) {
    return null;
  }

  const lastAuthUser = cookies[`${COOKIE_PREFIX}.${clientId}.LastAuthUser`];
  if (typeof lastAuthUser !== "string" || lastAuthUser.length === 0) {
    return null;
  }

  const cookieName = `${COOKIE_PREFIX}.${clientId}.${lastAuthUser}.refreshToken`;
  const refreshToken = cookies[cookieName];
  if (typeof refreshToken !== "string" || refreshToken.length === 0) {
    return null;
  }

  return { cookieName, refreshToken };
}

export function cognitoRefreshTokenCookieOptions(): CookieOptions {
  const env = getEnv();
  const cookieDomain =
    env.COOKIE_DOMAIN || (env.NODE_ENV === "production" ? ".cashsouk.com" : "localhost");

  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    domain: cookieDomain,
    path: "/",
  };
}

function clearCognitoRefreshTokenCookie(res: Response, cookieName: string): void {
  res.clearCookie(cookieName, cognitoRefreshTokenCookieOptions());
}

function isAlreadyInvalidRefreshTokenError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const name = error.name;
  if (name !== "InvalidParameterException" && name !== "NotAuthorizedException") {
    return false;
  }

  return (
    /invalid refresh token/i.test(error.message) ||
    /token has been revoked/i.test(error.message) ||
    /refresh token is not valid/i.test(error.message)
  );
}

async function revokeCognitoRefreshToken(refreshToken: string): Promise<void> {
  const env = getEnv();

  try {
    await cognitoClient.send(
      new RevokeTokenCommand({
        Token: refreshToken,
        ClientId: env.COGNITO_CLIENT_ID,
        ClientSecret: env.COGNITO_CLIENT_SECRET,
      })
    );
  } catch (error) {
    if (isAlreadyInvalidRefreshTokenError(error)) {
      logger.info("Cognito refresh token already invalid during logout");
      return;
    }

    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to revoke Cognito refresh token"
    );
    throw new AppError(
      503,
      "SERVICE_UNAVAILABLE",
      "Authentication service temporarily unavailable"
    );
  }
}

/**
 * Revoke the refresh token held in the current browser's httpOnly cookie.
 * LastAuthUser is used only as a cookie-name key; possession of the httpOnly
 * refresh cookie is required. Missing cookies are a no-op. Transient Cognito
 * failures throw 503 and must not clear the cookie.
 */
export async function revokeAndClearCurrentRefreshTokenCookie(
  req: Request,
  res: Response
): Promise<void> {
  const env = getEnv();
  const held = readCognitoRefreshTokenCookie(req.cookies, env.COGNITO_CLIENT_ID);
  if (!held) {
    return;
  }

  await revokeCognitoRefreshToken(held.refreshToken);
  clearCognitoRefreshTokenCookie(res, held.cookieName);
}
