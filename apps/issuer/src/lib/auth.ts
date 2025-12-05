"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthToken } from "@cashsouk/config";

const LANDING_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : process.env.NEXT_PUBLIC_LANDING_URL || "https://www.cashsouk.com";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Verify token is valid by calling /v1/auth/me
 * Uses API client which handles automatic token refresh
 * Access token is stored in memory and sent via Authorization header
 */
export async function verifyToken(
  getToken: () => string | null,
  setToken: (token: string | null) => void
): Promise<boolean> {
  try {
    const { createApiClient } = await import("@cashsouk/config");
    const apiClient = createApiClient(API_URL, getToken, setToken);

    // API client will use token from memory via Authorization header
    const result = await apiClient.get("/v1/auth/me");

    return result.success === true;
  } catch {
    return false;
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
 * Logout user from issuer portal
 * Clears token from memory and redirects to Cognito logout endpoint
 */
export function logout(clearAccessToken: () => void) {
  if (typeof window === "undefined") return;

  // Clear access token from memory
  clearAccessToken();

  // Redirect to logout endpoint (refresh_token cookie will be cleared by backend)
  const logoutUrl = `${API_URL}/v1/auth/cognito/logout`;
  window.location.href = logoutUrl;
}

/**
 * Hook to check authentication and redirect if not authenticated
 */
export function useAuth() {
  const searchParams = useSearchParams();
  const { accessToken, setAccessToken, clearAccessToken } = useAuthToken();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      // Check if token exists in query params (from callback redirect)
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromQuery = urlParams.get("token");
      if (tokenFromQuery) {
        // Store token in memory
        setAccessToken(tokenFromQuery);
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname);
      }

      // Verify auth using token from memory
      const isValid = await verifyToken(() => accessToken, setAccessToken);

      if (!isValid) {
        // Token is invalid and refresh failed, clear it and redirect
        clearAccessToken();
        setIsAuthenticated(false);
        redirectToLanding();
        return;
      }

      // Auth is valid
      setIsAuthenticated(true);
    };

    checkAuth();
  }, [searchParams, accessToken, setAccessToken, clearAccessToken]);

  return { isAuthenticated, token: accessToken };
}
