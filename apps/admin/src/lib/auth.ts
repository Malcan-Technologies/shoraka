"use client";

import { useEffect, useState, useRef } from "react";
import type { UserRole } from "@cashsouk/types";
import { useAuthToken } from "@cashsouk/config";

const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Verify token is valid by calling /v1/auth/me
 * Uses Amplify session to get access token
 */
export async function verifyToken(
  getAccessToken: () => Promise<string | null>
): Promise<boolean> {
  try {
    const { createApiClient } = await import("@cashsouk/config");
    const apiClient = createApiClient(API_URL, getAccessToken);
    
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
  getAccessToken: () => Promise<string | null>
): Promise<{ roles: UserRole[]; email: string } | null> {
  try {
    const { createApiClient } = await import("@cashsouk/config");
    const apiClient = createApiClient(API_URL, getAccessToken);
    
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
 * Clears all Cognito cookies and session, then redirects through Cognito logout to root domain
 */
export async function logout(
  signOut: () => Promise<void>,
  getAccessToken: () => Promise<string | null>
) {
  if (typeof window === "undefined") return;

  // 1. Get access token before logout (for backend access log)
  let accessToken: string | null = null;
  try {
    accessToken = await getAccessToken();
    console.log("[Logout] Got access token:", accessToken ? "present" : "missing");
  } catch (error) {
    console.error("[Logout] Failed to get access token:", error);
  }

  // 2. Sign out from Amplify (clears Amplify-managed tokens)
  try {
    await signOut();
    console.log("[Logout] Amplify signOut successful");
  } catch (error) {
    console.error("[Logout] Amplify signOut failed:", error);
  }

  // 3. Manually clear all Cognito cookies
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || "localhost";
  
  if (clientId) {
    const cookies = document.cookie.split(';');
    
    cookies.forEach(cookie => {
      const cookieName = cookie.split('=')[0].trim();
      if (cookieName.startsWith('CognitoIdentityServiceProvider')) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${cookieDomain};`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        console.log(`[Logout] Cleared cookie: ${cookieName}`);
      }
    });
  }

  // 4. Call backend logout endpoint (for access logging and session revocation)
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
    console.log("[Logout] Backend logout successful");
  } catch (error) {
    console.error("[Logout] Backend logout failed:", error);
  }

  // 5. Redirect through Cognito's logout endpoint to clear hosted UI session
  // Then Cognito will redirect to root domain
  const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || 
    (process.env.NODE_ENV === "production" ? "https://cashsouk.com" : "http://localhost:3000");
  
  let cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
  const cognitoClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  
  if (cognitoDomain && cognitoClientId) {
    if (!cognitoDomain.startsWith('http://') && !cognitoDomain.startsWith('https://')) {
      cognitoDomain = `https://${cognitoDomain}`;
    }
    
    const cognitoLogoutUrl = `${cognitoDomain}/logout?client_id=${cognitoClientId}&logout_uri=${encodeURIComponent(landingUrl)}`;
    console.log("[Logout] Redirecting through Cognito logout to:", landingUrl);
    window.location.href = cognitoLogoutUrl;
  } else {
    console.error("[Logout] Cognito domain or client ID not configured");
    window.location.href = landingUrl;
  }
}

/**
 * Hook to check authentication and verify ADMIN role
 * Auto-redirects to Cognito login if not authenticated
 * Logs out and redirects if user doesn't have ADMIN role
 */
export function useAuth() {
  const { getAccessToken, signOut } = useAuthToken();
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
        // Get access token from Amplify session with retry logic
        // Sometimes Amplify needs a moment to read cookies after page load
        let token: string | null = null;
        let retries = 0;
        const maxRetries = 3;
        
        while (!token && retries < maxRetries) {
          token = await getAccessToken();
          if (!token) {
            console.log(`[useAuth] No token on attempt ${retries + 1}/${maxRetries}, waiting...`);
            await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
            retries++;
            }
        }

        if (!token) {
          // No token after retries - redirect to login
          console.log("[useAuth] No token after retries, redirecting to login");
            setIsAuthenticated(false);
            setHasAdminRole(false);
            checkedRef.current = true;
            redirectToLogin();
            return;
          }

        console.log("[useAuth] Token found, verifying with backend");

        // Verify auth using token
        const isValid = await verifyToken(getAccessToken);
        
        if (!isValid) {
          // Token is invalid - redirect to login
          console.log("[useAuth] Token invalid, redirecting to login");
          setIsAuthenticated(false);
          setHasAdminRole(false);
          checkedRef.current = true;
          redirectToLogin();
          return;
        }

        console.log("[useAuth] Auth valid, checking admin role");

        // Auth is valid - check if user has ADMIN role
        const userInfo = await getUserInfo(getAccessToken);
        
        if (!userInfo || !userInfo.roles.includes("ADMIN")) {
          // User doesn't have ADMIN role - sign out and redirect to landing page
          console.log("[useAuth] User lacks ADMIN role, signing out");
          setIsAuthenticated(false);
          setHasAdminRole(false);
          checkedRef.current = true;
          
          // Sign out from Amplify and redirect to landing
          await signOut();
          redirectToLanding();
          return;
        }

        // User is authenticated and has ADMIN role
        console.log("[useAuth] User has ADMIN role");
        setIsAuthenticated(true);
        setHasAdminRole(true);
        checkedRef.current = true;
      } catch (error) {
        console.error("[useAuth] Auth check failed:", error);
        setIsAuthenticated(false);
        setHasAdminRole(false);
        checkedRef.current = true;
        redirectToLogin();
      } finally {
        checkingRef.current = false;
      }
    };

    checkAuth();
  }, [getAccessToken, signOut]); // Re-run if auth functions change

  return { isAuthenticated, token: null, hasAdminRole }; // Token is managed by Amplify
}
