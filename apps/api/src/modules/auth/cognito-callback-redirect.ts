/**
 * Post-callback destinations after Cognito OAuth.
 * Authorization rejections (authenticated, but not an active Admin) go to landing
 * home. Genuine authentication failures still use /auth-error.
 */
export function landingHomeUrl(frontendUrl: string): string {
  return frontendUrl.replace(/\/$/, "");
}

export function oauthAuthErrorUrl(
  frontendUrl: string,
  params: { error: string; message: string; extra?: Record<string, string> }
): string {
  const errorUrl = new URL(`${landingHomeUrl(frontendUrl)}/auth-error`);
  errorUrl.searchParams.set("error", params.error);
  errorUrl.searchParams.set("message", params.message);
  if (params.extra) {
    for (const [key, value] of Object.entries(params.extra)) {
      errorUrl.searchParams.set(key, value);
    }
  }
  return errorUrl.toString();
}

export function resolveAdminPortalAuthorizationDeniedRedirect(frontendUrl: string): string {
  return landingHomeUrl(frontendUrl);
}
