/**
 * Cognito access tokens carry `auth_time` (original authentication, second
 * precision). A refresh mints a new JWT with a new `iat` but the original
 * `auth_time`, so password-change invalidation must use `auth_time` first.
 * Fall back to `iat` only when `auth_time` is absent.
 *
 * When both the resolved authentication time and `password_changed_at` are
 * present, tokens authenticated at or before the password-change second are
 * treated as pre-change and must be rejected. Same-second tokens are rejected
 * so a pre-change JWT cannot outrace a password change. Missing authentication
 * time or `password_changed_at` does not invalidate the token.
 */
export function resolveAccessTokenAuthTimeSeconds(
  authTime: unknown,
  issuedAt: unknown
): number | undefined {
  if (typeof authTime === "number" && Number.isFinite(authTime)) {
    return Math.floor(authTime);
  }
  if (typeof issuedAt === "number" && Number.isFinite(issuedAt)) {
    return Math.floor(issuedAt);
  }
  return undefined;
}

export function isAccessTokenIssuedBeforePasswordChange(
  tokenAuthTimeSeconds: number | undefined,
  passwordChangedAt: Date | null | undefined
): boolean {
  if (
    tokenAuthTimeSeconds == null ||
    !Number.isFinite(tokenAuthTimeSeconds) ||
    !(passwordChangedAt instanceof Date)
  ) {
    return false;
  }

  const passwordChangedAtMs = passwordChangedAt.getTime();
  if (!Number.isFinite(passwordChangedAtMs)) {
    return false;
  }

  const passwordChangedAtSeconds = Math.floor(passwordChangedAtMs / 1000);
  return Math.floor(tokenAuthTimeSeconds) <= passwordChangedAtSeconds;
}
