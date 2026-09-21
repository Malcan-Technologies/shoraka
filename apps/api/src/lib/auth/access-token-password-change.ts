/**
 * Cognito access-token `iat` is second-precision. When both `iat` and
 * `password_changed_at` are present, tokens issued at or before the password
 * change second are treated as pre-change and must be rejected. Same-second
 * tokens are rejected so a pre-change JWT cannot outrace a password change.
 * Missing `iat` or `password_changed_at` does not invalidate the token.
 */
export function isAccessTokenIssuedBeforePasswordChange(
  tokenIatSeconds: number | undefined,
  passwordChangedAt: Date | null | undefined
): boolean {
  if (
    tokenIatSeconds == null ||
    !Number.isFinite(tokenIatSeconds) ||
    !(passwordChangedAt instanceof Date)
  ) {
    return false;
  }

  const passwordChangedAtMs = passwordChangedAt.getTime();
  if (!Number.isFinite(passwordChangedAtMs)) {
    return false;
  }

  const passwordChangedAtSeconds = Math.floor(passwordChangedAtMs / 1000);
  return Math.floor(tokenIatSeconds) <= passwordChangedAtSeconds;
}
