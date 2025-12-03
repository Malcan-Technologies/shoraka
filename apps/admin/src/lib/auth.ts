"use client";

import { useEffect, useState, useRef } from "react";
import type { UserRole } from "@cashsouk/types";

const LANDING_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Get auth token from localStorage only
 * Token from query params should be handled by the callback page
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  
  // Only return from localStorage - callback page handles query params
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
    
    return result.success === true;
  } catch (error) {
    return false;
  }
}

/**
 * Get user info including roles from /v1/auth/me
 */
export async function getUserInfo(): Promise<{ roles: UserRole[]; email: string } | null> {
  try {
    const { createApiClient } = await import("@cashsouk/config");
    const apiClient = createApiClient(API_URL);
    
    const result = await apiClient.get<{
      user: {
        id: string;
        email: string;
        roles: UserRole[];
        first_name: string | null;
        last_name: string | null;
        investor_onboarding_completed: boolean;
        issuer_onboarding_completed: boolean;
      };
      activeRole: string | null;
      sessions: {
        active: number;
      };
    }>("/v1/auth/me");
    
    if (result.success && result.data?.user) {
      return {
        roles: result.data.user.roles || [],
        email: result.data.user.email || "",
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

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
 * Hook to check authentication and verify ADMIN role
 * Auto-redirects to Cognito login if not authenticated
 * Logs out and redirects if user doesn't have ADMIN role
 */
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hasAdminRole, setHasAdminRole] = useState<boolean | null>(null);
  const checkingRef = useRef(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    // Don't run auth check on callback page - it has its own logic
    if (typeof window !== "undefined" && window.location.pathname === "/callback") {
      return;
    }

    // Prevent multiple simultaneous checks
    if (checkingRef.current || checkedRef.current) {
      return;
    }

    const checkAuth = async () => {
      checkingRef.current = true;

      try {
        // Try to verify auth - API client will use cookies if available
        // or localStorage token if cookies aren't available (dev mode)
        const authToken = getAuthToken();
        
        // Even if no token in localStorage, try to verify (cookies might work)
        const isValid = await verifyToken(authToken);
        
        if (!isValid) {
          // Token is invalid and refresh failed, clear it and redirect
          if (authToken) {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("refresh_token");
          }
          setIsAuthenticated(false);
          setHasAdminRole(false);
          checkedRef.current = true;
          redirectToLogin();
          return;
        }

        // Auth is valid - check if user has ADMIN role
        const userInfo = await getUserInfo();
        
        if (!userInfo || !userInfo.roles.includes("ADMIN")) {
          // User doesn't have ADMIN role - logout and they'll be redirected to landing
          
          // Clear tokens locally first
          localStorage.removeItem("auth_token");
          localStorage.removeItem("refresh_token");
          
          setIsAuthenticated(false);
          setHasAdminRole(false);
          checkedRef.current = true;
          
          // Logout from Cognito - user will be redirected to landing page
          // User can then navigate to localhost:3003 to try logging in with admin credentials
          const token = getAuthToken(); // Will be null since we just cleared it
          const logoutUrl = new URL(`${API_URL}/v1/auth/cognito/logout`);
          if (token) {
            logoutUrl.searchParams.set("token", token);
          }
          
          window.location.href = logoutUrl.toString();
          return;
        }

        // User is authenticated and has ADMIN role
        setToken(authToken || "cookie-based"); // Use placeholder if cookie-based
        setIsAuthenticated(true);
        setHasAdminRole(true);
        checkedRef.current = true;
      } catch {
        setIsAuthenticated(false);
        setHasAdminRole(false);
        checkedRef.current = true;
        redirectToLogin();
      } finally {
        checkingRef.current = false;
      }
    };

    checkAuth();
  }, []); // Run on mount only - check auth when component loads

  return { isAuthenticated, token, hasAdminRole };
}

