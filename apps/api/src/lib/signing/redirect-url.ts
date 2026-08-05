/**
 * Validate redirect URLs for SigningCloud backUrl — must match ISSUER_URL origin.
 */
export function readIssuerOrigin(): string | null {
  const issuerUrl = process.env.ISSUER_URL?.trim().replace(/\/$/, "");
  if (!issuerUrl) return null;
  try {
    return new URL(issuerUrl).origin;
  } catch {
    return null;
  }
}

export function validateSigningRedirectUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    const allowHttp = process.env.SIGNINGCLOUD_ALLOW_HTTP_BACK_URL === "true";
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && allowHttp)) {
      return null;
    }
    const issuerOrigin = readIssuerOrigin();
    if (!issuerOrigin) return null;
    if (parsed.origin !== issuerOrigin) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function buildSigningReturnUrl(returnSessionId: string): string | null {
  const issuerUrl = process.env.ISSUER_URL?.trim().replace(/\/$/, "");
  if (!issuerUrl) return null;
  return `${issuerUrl}/signing/return?rs=${encodeURIComponent(returnSessionId)}`;
}
