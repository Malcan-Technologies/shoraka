"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const LANDING_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : process.env.NEXT_PUBLIC_LANDING_URL || "https://www.cashsouk.com";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Get auth token from query params or localStorage
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;

  // Check query params first (for direct redirects)
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromQuery = urlParams.get("token");
  if (tokenFromQuery) {
    // Store in localStorage for future use
    localStorage.setItem("auth_token", tokenFromQuery);
    return tokenFromQuery;
  }

  // Fallback to localStorage
  return localStorage.getItem("auth_token");
}

/**
 * Verify token is valid by calling /v1/auth/me
 * Uses API client which handles automatic token refresh
 * Note: In production, tokens are in HTTP-Only cookies, so token parameter may be ignored
 */
export async function verifyToken(_token?: string | null): Promise<boolean> {
  try {
    const { createApiClient } = await import("@cashsouk/config");
    const apiClient = createApiClient(API_URL);

    // API client will use cookies if available, or Authorization header if token provided
    const result = await apiClient.get("/v1/auth/me");

    // If successful, update localStorage with token from cookies (for dev mode compatibility)
    // In production, tokens are in cookies only
    if (result.success && typeof window !== "undefined") {
      // Try to extract token from cookies if possible (for dev mode)
      // But since cookies are HTTP-Only, we can't read them
      // So we'll just trust that cookies work and keep localStorage for backward compatibility
    }

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
 * Logout user from investor portal
 * Clears local storage and redirects to Cognito logout endpoint
 */
export function logout() {
  if (typeof window === "undefined") return;

  const token = getAuthToken();
  const logoutUrl = new URL(`${API_URL}/v1/auth/cognito/logout`);

  if (token) {
    logoutUrl.searchParams.set("token", token);
  }

  // Clear tokens from localStorage before redirecting
  localStorage.removeItem("auth_token");
  localStorage.removeItem("refresh_token");

  window.location.href = logoutUrl.toString();
}

/**
 * Hook to check authentication and redirect if not authenticated
 */
export function useAuth() {
  const searchParams = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      // Try to verify auth - API client will use cookies if available
      // or localStorage token if cookies aren't available (dev mode)
      const authToken = getAuthToken();

      // Even if no token in localStorage, try to verify (cookies might work)
      const isValid = await verifyToken(authToken);

      if (!isValid) {
        // Token is invalid and refresh failed, clear it and redirect
        if (authToken) {
          localStorage.removeItem("auth_token");
        }
        setIsAuthenticated(false);
        redirectToLanding();
        return;
      }

      // Auth is valid - update token from localStorage or keep existing
      // In production, token is in cookies, so we might not have it in localStorage
      setToken(authToken || "cookie-based"); // Use placeholder if cookie-based
      setIsAuthenticated(true);
    };

    checkAuth();
  }, [searchParams]);

  return { isAuthenticated, token };
}
