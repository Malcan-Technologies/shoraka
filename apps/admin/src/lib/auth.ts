"use client";

import { useEffect, useRef } from "react";
import { useAuthToken } from "@cashsouk/config";
import { useCurrentUser } from "../hooks/use-current-user";

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

  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || "localhost";

  if (clientId) {
    const cookies = document.cookie.split(";");

    cookies.forEach((cookie) => {
      const cookieName = cookie.split("=")[0].trim();
      if (cookieName.startsWith("CognitoIdentityServiceProvider")) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${cookieDomain};`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });
  }

  try {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    await fetch(`${API_URL}/v1/auth/cognito/logout?portal=admin`, {
      method: "GET",
      credentials: "include",
      headers,
    });
  } catch {
    // Ignore - continue with redirect
  }

  const landingUrl =
    process.env.NEXT_PUBLIC_LANDING_URL ||
    (process.env.NODE_ENV === "production" ? "https://cashsouk.com" : "http://localhost:3000");

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
 * Hook to check authentication and verify ADMIN role.
 * Uses the centralized useCurrentUser hook for data fetching (React Query handles deduplication).
 * Auto-redirects to Cognito login if not authenticated.
 * Logs out and redirects if user doesn't have ADMIN role.
 */
export function useAuth() {
  const { getAccessToken, signOut } = useAuthToken();
  const { data, isLoading, isError, error } = useCurrentUser();
  const redirectingRef = useRef(false);

  const user = data?.user;
  const hasAdminRole = user?.roles.includes("ADMIN") ?? false;
  const isAdminActive = user?.admin?.status === "ACTIVE";
  const canAccessAdmin = hasAdminRole && isAdminActive;

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname === "/callback") {
      return;
    }

    if (redirectingRef.current) {
      return;
    }

    if (isLoading) {
      return;
    }

    if (isError || !user) {
      redirectingRef.current = true;
      redirectToLogin();
      return;
    }

    if (!canAccessAdmin) {
      redirectingRef.current = true;
      logout(signOut, getAccessToken);
    }
  }, [isLoading, isError, user, canAccessAdmin, signOut, getAccessToken, error]);

  const isAuthenticated = !isLoading && !isError && !!user && canAccessAdmin;

  return {
    isAuthenticated: isLoading ? null : isAuthenticated,
    hasAdminRole: isLoading ? null : canAccessAdmin,
    token: null,
  };
}
