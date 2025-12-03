import { getEnv } from "./env";

export function getCognitoConfig() {
  const env = getEnv();
  return {
    userPoolId: env.COGNITO_USER_POOL_ID,
    clientId: env.COGNITO_CLIENT_ID,
    clientSecret: env.COGNITO_CLIENT_SECRET,
    domain: env.COGNITO_DOMAIN,
    region: env.COGNITO_REGION,
    redirectUri: env.REDIRECT_URI,
  };
}

export function getCognitoAuthorizeUrl(state?: string): string {
  const config = getCognitoConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    scope: "openid email",
    redirect_uri: config.redirectUri,
  });

  if (state) {
    params.append("state", state);
  }

  return `${config.domain}/oauth2/authorize?${params.toString()}`;
}

export function getCognitoTokenUrl(): string {
  const config = getCognitoConfig();
  return `${config.domain}/oauth2/token`;
}

export function getCognitoLogoutUrl(includeLogoutUri: boolean = true): string {
  const config = getCognitoConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
  });

  // logout_uri is optional in Cognito
  // If provided, it must be in the allowed logout URLs list in Cognito app client settings
  // If not in the allowed list, Cognito will show "Invalid request" error
  // We make it optional so logout can still work even if logout_uri isn't configured
  if (includeLogoutUri) {
    const env = getEnv();
    params.append("logout_uri", env.FRONTEND_URL);
  }

  return `${config.domain}/logout?${params.toString()}`;
}

export function getCognitoIssuerUrl(): string {
  const config = getCognitoConfig();
  return `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`;
}

