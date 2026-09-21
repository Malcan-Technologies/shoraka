import { parseCookieHeader, readCognitoAccessTokenFromCookieMap } from "./cookie-pair";

/**
 * Centralized Token Refresh Service
 *
 * Singleton service that manages all token refresh operations across the application.
 * Used by both AuthProvider and ApiClient to ensure consistent token management.
 *
 * Features:
 * - Reads/writes Amplify-format cookies directly
 * - Calls AWS Cognito /oauth2/token endpoint for refresh
 * - Prevents concurrent refresh attempts with promise locking
 * - Checks JWT expiry with 5-minute buffer
 */

class TokenRefreshService {
  private static instance: TokenRefreshService;
  private isRefreshing = false;
  private refreshPromise: Promise<string | null> | null = null;

  // Private constructor for singleton pattern
  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): TokenRefreshService {
    if (!TokenRefreshService.instance) {
      TokenRefreshService.instance = new TokenRefreshService();
    }
    return TokenRefreshService.instance;
  }

  /**
   * Check if JWT token is expired or about to expire (within 5 minutes)
   */
  isTokenExpired(token: string): boolean {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return true;

      const payload = JSON.parse(atob(parts[1]));
      const exp = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const buffer = 5 * 60 * 1000; // 5 minute buffer

      return now >= exp - buffer;
    } catch {
      return true; // If we can't parse, assume expired
    }
  }

  /**
   * Check if user has an authentication session
   * Used to determine if token refresh should be attempted
   *
   * Note: We check for LastAuthUser cookie instead of refreshToken because
   * the refresh token is set with httpOnly=true and cannot be read via JavaScript.
   * If LastAuthUser exists, the refresh token should also exist (both set during login).
   */
  hasRefreshToken(): boolean {
    try {
      const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
      if (!clientId) {
        return false;
      }

      const cookies = parseCookieHeader(document.cookie);
      return Boolean(cookies[`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`]);
    } catch {
      return false;
    }
  }

  /**
   * Read access token directly from cookies
   * This bypasses Amplify's cache which may be stale after manual refresh
   */
  readTokenFromCookies(): string | null {
    try {
      const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
      if (!clientId) {
        return null;
      }

      return readCognitoAccessTokenFromCookieMap(parseCookieHeader(document.cookie), clientId);
    } catch (error) {
      console.error("[TokenRefreshService] Error reading token from cookies:", error);
      return null;
    }
  }

  /**
   * Refresh access token using refresh token from cookies
   * Prevents multiple simultaneous refresh attempts using a promise lock
   * Returns the new access token or null if refresh fails
   */
  async refreshToken(): Promise<string | null> {
    // Check if refresh token exists before attempting refresh
    // This prevents errors during initial login when cookies haven't been set yet
    if (!this.hasRefreshToken()) {
      // eslint-disable-next-line no-console
      console.log("[TokenRefreshService] No refresh token found in cookies, skipping refresh");
      return null;
    }

    // If already refreshing, wait for existing refresh to complete
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this._doRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Execute the actual token refresh
   * Private method called by refreshToken()
   * Calls backend endpoint which securely handles Cognito client secret
   */
  private async _doRefresh(): Promise<string | null> {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      // eslint-disable-next-line no-console
      console.log("[TokenRefreshService] Calling backend refresh endpoint...");

      const response = await fetch(`${apiUrl}/v1/auth/refresh-token`, {
        method: "POST",
        credentials: "include", // Send cookies to backend
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        let errorDetail = `Status ${response.status}`;
        try {
          const errorData = await response.json();
          errorDetail = `${response.status} - ${errorData.error?.message || errorData.message || JSON.stringify(errorData)}`;
        } catch {
          // Response wasn't JSON
        }

        // Don't log as error if it's a "no session" error - this is expected during initial login
        if (response.status === 401 && errorDetail.includes("No authentication session found")) {
          // eslint-disable-next-line no-console
          console.log(
            "[TokenRefreshService] No authentication session found (expected during login)"
          );
        } else {
          console.error("[TokenRefreshService] Token refresh failed:", errorDetail);
        }
        return null;
      }

      const data = await response.json();

      if (data.success && data.data?.accessToken) {
        // eslint-disable-next-line no-console
        console.log("[TokenRefreshService] Token refreshed successfully via backend");
        return data.data.accessToken;
      }

      return null;
    } catch (error) {
      console.error("[TokenRefreshService] Token refresh error:", error);
      return null;
    }
  }
}

function readCookieTokenSafely(readTokenFromCookies: () => string | null): string | null {
  try {
    return readTokenFromCookies();
  } catch {
    return null;
  }
}

/**
 * Resolve a portal access token. When fetchAuthSession throws or returns an
 * empty/expired token, backend refresh is attempted before falling back to the
 * Amplify cookie. Cookie reads must not throw (SSR / non-browser).
 */
export async function resolveAccessTokenWithCookieFallback(options: {
  fetchSessionToken: () => Promise<string | null>;
  refreshToken: () => Promise<string | null>;
  readTokenFromCookies: () => string | null;
  isTokenExpired: (token: string) => boolean;
}): Promise<string | null> {
  let token: string | null = null;
  try {
    token = await options.fetchSessionToken();
  } catch {
    token = null;
  }

  if (token && !options.isTokenExpired(token)) {
    return token;
  }

  try {
    const refreshed = await options.refreshToken();
    if (refreshed) {
      return refreshed;
    }
  } catch {
    // Backend refresh unavailable; fall through to cookie.
  }

  return readCookieTokenSafely(options.readTokenFromCookies);
}

// Export singleton instance
export const tokenRefreshService = TokenRefreshService.getInstance();
