"use client";

import { useEffect, useState } from "react";
import { useAuthToken } from "@cashsouk/config";

const LANDING_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : process.env.NEXT_PUBLIC_LANDING_URL || "https://www.cashsouk.com";
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
 * Redirect to Cognito login for issuer role
 * Preserves current URL for post-auth redirect by passing it as a query parameter
 */
export function redirectToLogin() {
  if (typeof window !== "undefined") {
    // Save current URL to restore after authentication
    const currentUrl = window.location.pathname + window.location.search;
    console.log("[redirectToLogin] Preserving redirect URL:", currentUrl);
    
    // Pass the redirect URL as a query parameter to survive OAuth flow across origins
    const encodedRedirectUrl = encodeURIComponent(currentUrl);
    window.location.href = `${API_URL}/api/auth/login?role=ISSUER&redirect=${encodedRedirectUrl}`;
  }
}

/**
 * Logout user from issuer portal
 * Clears all Cognito cookies and session, then redirects through Cognito logout
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
    
    await fetch(`${API_URL}/v1/auth/cognito/logout?portal=issuer`, {
      method: "GET",
      credentials: "include",
      headers,
    });
    console.log("[Logout] Backend logout successful");
  } catch (error) {
    console.error("[Logout] Backend logout failed:", error);
  }

  // 5. Redirect through Cognito's logout endpoint to root domain
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
 * Hook to check authentication and redirect if not authenticated
 * Uses Amplify session to check authentication status
 */
export function useAuth() {
  const { getAccessToken, signOut } = useAuthToken();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Don't run auth check on callback page
    if (typeof window !== "undefined" && window.location.pathname === "/callback") {
      return;
    }

    const checkAuth = async () => {
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
          // No token after retries - not authenticated
          console.log("[useAuth] No token after retries, redirecting to login");
          setIsAuthenticated(false);
          redirectToLogin();
          return;
        }

        console.log("[useAuth] Token found, verifying with backend");

        // Verify token is valid by calling backend
        const isValid = await verifyToken(getAccessToken);

        if (!isValid) {
          // Token is invalid - sign out and redirect
          console.log("[useAuth] Token invalid, signing out");
          setIsAuthenticated(false);
          await signOut();
          redirectToLogin();
          return;
        }

        // Auth is valid
        console.log("[useAuth] Auth valid");
        setIsAuthenticated(true);
      } catch (error) {
        console.error("[useAuth] Auth check failed:", error);
        setIsAuthenticated(false);
        redirectToLogin();
      }
    };

    checkAuth();
  }, [getAccessToken, signOut]); // Re-run if auth functions change

  return { isAuthenticated, token: null }; // Token is managed by Amplify
}
