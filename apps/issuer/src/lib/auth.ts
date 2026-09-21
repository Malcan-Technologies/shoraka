"use client";

import { completeCognitoPortalLogout, usePortalAuthSession } from "@cashsouk/config";

const LANDING_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : process.env.NEXT_PUBLIC_LANDING_URL || "https://www.cashsouk.com";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
 * Logout user from issuer portal.
 * Durable backend revocation must succeed before local session teardown.
 */
export async function logout(
  signOut: () => Promise<void>,
  getAccessToken: () => Promise<string | null>
) {
  if (typeof window === "undefined") return;

  await completeCognitoPortalLogout({
    apiUrl: API_URL,
    portal: "issuer",
    getAccessToken,
    destroyLocalSession: async () => {
      try {
        await signOut();
        console.log("[Logout] Amplify signOut successful");
      } catch (error) {
        console.error("[Logout] Amplify signOut failed:", error);
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
            console.log(`[Logout] Cleared cookie: ${cookieName}`);
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
        console.log("[Logout] Redirecting through Cognito logout to:", landingUrl);
        window.location.href = cognitoLogoutUrl;
      } else {
        console.error("[Logout] Cognito domain or client ID not configured");
        window.location.href = landingUrl;
      }
    },
  });
}

export function useAuth() {
  const session = usePortalAuthSession();
  return { ...session, token: null };
}
