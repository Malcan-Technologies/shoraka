"use client";

import { useEffect, useRef } from "react";
import {
  classifyAuthMeFailure,
  completeCognitoPortalLogout,
  useAuthToken,
} from "@cashsouk/config";
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
 * Logout user from admin portal.
 * Durable backend revocation must succeed before local session teardown.
 */
export async function logout(
  signOut: () => Promise<void>,
  getAccessToken: () => Promise<string | null>
) {
  if (typeof window === "undefined") return;

  await completeCognitoPortalLogout({
    apiUrl: API_URL,
    portal: "admin",
    getAccessToken,
    destroyLocalSession: async () => {
      try {
        await signOut();
      } catch {
        // Continue with cookie clear and redirect after durable revocation
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
    },
  });
}

/**
 * Hook to check authentication and verify ADMIN role.
 * Uses the centralized useCurrentUser hook for data fetching (React Query handles deduplication).
 * Auto-redirects to Cognito login if not authenticated.
 * Logs out and redirects if user doesn't have ADMIN role.
 */
export function useAuth() {
  const { getAccessToken, signOut } = useAuthToken();
  const { data, isLoading, isFetching, isError, error, refetch } = useCurrentUser();
  const redirectingRef = useRef(false);

  const user = data?.user;
  const hasAdminRole = user?.roles.includes("ADMIN") ?? false;
  const isAdminActive = user?.admin?.status === "ACTIVE";
  const canAccessAdmin = hasAdminRole && isAdminActive;
  const sessionFailure = isError ? classifyAuthMeFailure(error) : null;
  const sessionFailureStatus = sessionFailure?.status;
  const sessionUnavailable = sessionFailureStatus === "retryable" && !isFetching;
  const checkingSession = isLoading || (sessionFailureStatus === "retryable" && isFetching);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname === "/callback") {
      return;
    }

    if (redirectingRef.current) {
      return;
    }

    if (checkingSession || sessionUnavailable) {
      return;
    }

    if (sessionFailureStatus === "unauthorized" || sessionFailureStatus === "unauthenticated") {
      redirectingRef.current = true;
      redirectToLogin();
      return;
    }

    if (isError || !user) {
      return;
    }

    if (!canAccessAdmin) {
      redirectingRef.current = true;
      void logout(signOut, getAccessToken).catch(() => {
        redirectToLanding();
      });
    }
  }, [
    checkingSession,
    sessionUnavailable,
    sessionFailureStatus,
    isError,
    user,
    canAccessAdmin,
    signOut,
    getAccessToken,
  ]);

  const isAuthenticated = !isLoading && !isError && !!user && canAccessAdmin;

  return {
    isAuthenticated: checkingSession || sessionUnavailable ? null : isAuthenticated,
    hasAdminRole: checkingSession || sessionUnavailable ? null : canAccessAdmin,
    sessionUnavailable,
    retrySessionCheck: () => {
      redirectingRef.current = false;
      void refetch();
    },
    token: null,
  };
}
