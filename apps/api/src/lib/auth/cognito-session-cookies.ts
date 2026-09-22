import type { CookieOptions } from "express";
import { getEnv } from "../../config/env";

/** Cognito access and ID token lifetime. */
export const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;

/**
 * Browser idle cutoff for the HttpOnly refresh cookie. Reset on each successful
 * refresh. Distinct from Cognito RefreshTokenValidity (30 days from sign-in);
 * rotation replaces the token value but does not extend that absolute expiry.
 */
export const REFRESH_TOKEN_MAX_AGE_MS = 60 * 60 * 1000;

export function cognitoCookieOptions(httpOnly: boolean, maxAge: number): CookieOptions {
  const env = getEnv();
  const cookieDomain =
    env.COOKIE_DOMAIN || (env.NODE_ENV === "production" ? ".cashsouk.com" : "localhost");

  return {
    httpOnly,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    domain: cookieDomain,
    path: "/",
    maxAge,
  };
}
