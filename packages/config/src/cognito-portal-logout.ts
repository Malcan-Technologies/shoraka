import type { ClientPortal } from "./detect-client-portal";
import { tokenRefreshService } from "./token-refresh-service";

const LOGOUT_RETRY_MESSAGE = "Unable to complete logout. Please try again.";

export class CognitoLogoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CognitoLogoutError";
  }
}

function readSafeApiErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("error" in body)) {
    return null;
  }

  const error = (body as { error: unknown }).error;
  if (!error || typeof error !== "object" || !("message" in error)) {
    return null;
  }

  const message = (error as { message: unknown }).message;
  if (typeof message !== "string") {
    return null;
  }

  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 180 || /[\n\r]/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export async function requestBackendCognitoLogout(options: {
  apiUrl: string;
  portal: ClientPortal;
  accessToken: string | null;
}): Promise<void> {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${options.apiUrl}/v1/auth/cognito/logout?portal=${options.portal}`, {
      method: "GET",
      credentials: "include",
      headers,
    });
  } catch {
    throw new CognitoLogoutError(LOGOUT_RETRY_MESSAGE);
  }

  if (response.ok) {
    return;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new CognitoLogoutError(LOGOUT_RETRY_MESSAGE);
  }

  throw new CognitoLogoutError(readSafeApiErrorMessage(body) ?? LOGOUT_RETRY_MESSAGE);
}

export async function resolveLogoutAccessToken(options: {
  getAccessToken: () => Promise<string | null>;
  readAccessTokenFromCookies?: () => string | null;
}): Promise<string | null> {
  let accessToken: string | null = null;
  try {
    accessToken = await options.getAccessToken();
  } catch {
    accessToken = null;
  }

  if (accessToken) {
    return accessToken;
  }

  try {
    const readCookies =
      options.readAccessTokenFromCookies ?? (() => tokenRefreshService.readTokenFromCookies());
    return readCookies();
  } catch {
    return null;
  }
}

export async function completeCognitoPortalLogout(options: {
  apiUrl: string;
  portal: ClientPortal;
  getAccessToken: () => Promise<string | null>;
  destroyLocalSession: () => Promise<void>;
  readAccessTokenFromCookies?: () => string | null;
}): Promise<void> {
  const accessToken = await resolveLogoutAccessToken({
    getAccessToken: options.getAccessToken,
    readAccessTokenFromCookies: options.readAccessTokenFromCookies,
  });

  await requestBackendCognitoLogout({
    apiUrl: options.apiUrl,
    portal: options.portal,
    accessToken,
  });

  await options.destroyLocalSession();
}
