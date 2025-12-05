"use client";

import { useEffect, useState, useRef } from "react";
import type { UserRole } from "@cashsouk/types";
import { useAuthToken } from "@cashsouk/config";

const LANDING_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";
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
  } catch (error) {
    return false;
  }
}

/**
 * Get user info including roles from /v1/auth/me
 */
export async function getUserInfo(
  getToken: () => string | null,
  setToken: (token: string | null) => void
): Promise<{ roles: UserRole[]; email: string } | null> {
  try {
    const { createApiClient } = await import("@cashsouk/config");
    const apiClient = createApiClient(API_URL, getToken, setToken);
    
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
 * Hook to check authentication and verify ADMIN role
 * Auto-redirects to Cognito login if not authenticated
 * Logs out and redirects if user doesn't have ADMIN role
 */
export function useAuth() {
  const { accessToken, setAccessToken, clearAccessToken } = useAuthToken();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
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
        // Verify auth using token from memory
        const isValid = await verifyToken(() => accessToken, setAccessToken);
        
        if (!isValid) {
          // Token is invalid and refresh failed, clear it and redirect
          clearAccessToken();
          setIsAuthenticated(false);
          setHasAdminRole(false);
          checkedRef.current = true;
          redirectToLogin();
          return;
        }

        // Auth is valid - check if user has ADMIN role
        const userInfo = await getUserInfo(() => accessToken, setAccessToken);
        
        if (!userInfo || !userInfo.roles.includes("ADMIN")) {
          // User doesn't have ADMIN role - logout and they'll be redirected to landing
          clearAccessToken();
          setIsAuthenticated(false);
          setHasAdminRole(false);
          checkedRef.current = true;
          
          // Logout from Cognito - user will be redirected to landing page
          logout(clearAccessToken);
          return;
        }

        // User is authenticated and has ADMIN role
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
  }, [accessToken, setAccessToken, clearAccessToken]); // Run when accessToken changes

  return { isAuthenticated, token: accessToken, hasAdminRole };
}

