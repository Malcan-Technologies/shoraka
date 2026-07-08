/** Issuer routes that must work without a Cognito session. */
export function isPublicIssuerPath(pathname: string): boolean {
  return pathname === "/callback" || pathname.startsWith("/signing/external/");
}
