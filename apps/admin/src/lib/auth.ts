"use client";

import { useEffect, useRef } from "react";
import { useAuthToken } from "@cashsouk/config";
import { useCurrentUser } from "../hooks/use-current-user";
import {
  isAdminPortalUser,
  resolveAdminAuthRedirect,
  resolveAuthGuardView,
  unauthorizedAdminExitUrl,
} from "./admin-auth-gate";

const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Redirect to Cognito login for admin
 */
export function redirectToLogin() {
  if (typeof window !== "undefined") {
    const loginUrl = `${API_URL}/v1/auth/cognito/login?role=ADMIN`;
    window.location.href = loginUrl;
  }
}

/**
 * Redirect to landing page
 */
export function redirectToLanding() {
  if (typeof window !== "undefined") {
    window.location.href = LANDING_URL;
  }
}

function clearLocalCognitoCookies() {
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || "localhost";

  if (!clientId) {
    return;
  }

  const cookies = document.cookie.split(";");

  cookies.forEach((cookie) => {
    const cookieName = cookie.split("=")[0].trim();
    if (cookieName.startsWith("CognitoIdentityServiceProvider")) {
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${cookieDomain};`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
  });
}

async function notifyBackendAdminLogout(accessToken: string | null) {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  await fetch(`${API_URL}/v1/auth/cognito/logout?portal=admin`, {
    method: "GET",
    credentials: "include",
    headers,
  });
}

function landingHomeUrl() {
  return unauthorizedAdminExitUrl(
    process.env.NEXT_PUBLIC_LANDING_URL ||
      (process.env.NODE_ENV === "production" ? "https://cashsouk.com" : "http://localhost:3000")
  );
}

/**
 * Logout user from admin portal
 * Clears all Cognito cookies and session, then redirects through Cognito logout to root domain
 */
export async function logout(
  signOut: () => Promise<void>,
  getAccessToken: () => Promise<string | null>
) {
  if (typeof window === "undefined") return;

  let accessToken: string | null = null;
  try {
    accessToken = await getAccessToken();
  } catch {
    // Ignore - token may already be expired
  }

  try {
    await signOut();
  } catch {
    // Ignore - continue with logout
  }

  clearLocalCognitoCookies();

  try {
    await notifyBackendAdminLogout(accessToken);
  } catch {
    // Ignore - continue with redirect
  }

  const landingUrl = landingHomeUrl();
  let cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
  const cognitoClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

  if (cognitoDomain && cognitoClientId) {
    if (!cognitoDomain.startsWith("http://") && !cognitoDomain.startsWith("https://")) {
      cognitoDomain = `https://${cognitoDomain}`;
    }

    const cognitoLogoutUrl = `${cognitoDomain}/logout?client_id=${cognitoClientId}&logout_uri=${encodeURIComponent(landingUrl)}`;
    window.location.href = cognitoLogoutUrl;
  } else {
    window.location.href = landingUrl;
  }
}

/**
 * Authenticated non-admin (or inactive admin) must leave Admin without going
 * through Cognito Hosted UI logout or /auth-error. Amplify global signOut can
 * trigger an OAuth logout that lands on the callback → auth-error page.
 */
export async function exitUnauthorizedAdmin(getAccessToken: () => Promise<string | null>) {
  if (typeof window === "undefined") return;

  let accessToken: string | null = null;
  try {
    accessToken = await getAccessToken();
  } catch {
    // Ignore - token may already be expired
  }

  clearLocalCognitoCookies();

  try {
    await notifyBackendAdminLogout(accessToken);
  } catch {
    // Ignore - continue with redirect
  }

  window.location.replace(landingHomeUrl());
}

/**
 * Hook to check authentication and verify ADMIN role.
 * Uses the centralized useCurrentUser hook for data fetching (React Query handles deduplication).
 * Auto-redirects to Cognito login if not authenticated.
 * Logs out and redirects if user doesn't have ADMIN role.
 */
export function useAuth() {
  const { getAccessToken } = useAuthToken();
  const { data, isPending, isError } = useCurrentUser();
  const redirectingRef = useRef(false);

  const user = data?.user;
  const canAccessAdmin = isAdminPortalUser(user);
  const skipGuard =
    typeof window !== "undefined" && window.location.pathname === "/callback";
  const redirect = resolveAdminAuthRedirect({ isPending, isError, user });
  const gate = resolveAuthGuardView({ skipGuard, isPending, isError, user });

  useEffect(() => {
    if (skipGuard || redirectingRef.current) {
      return;
    }

    if (redirect === "login") {
      redirectingRef.current = true;
      redirectToLogin();
      return;
    }

    if (redirect === "logout") {
      redirectingRef.current = true;
      exitUnauthorizedAdmin(getAccessToken);
    }
  }, [skipGuard, redirect, getAccessToken]);

  return {
    isAuthenticated: canAccessAdmin ? true : isPending ? null : false,
    hasAdminRole: canAccessAdmin ? true : isPending ? null : false,
    gate,
    token: null,
  };
}
