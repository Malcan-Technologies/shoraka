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
   * Read access token directly from cookies
   * This bypasses Amplify's cache which may be stale after manual refresh
   */
  readTokenFromCookies(): string | null {
    try {
      const cookies = document.cookie.split(";");
      const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

      if (!clientId) {
        return null;
      }

      // Find LastAuthUser cookie to get the user ID
      const lastAuthUserCookie = cookies.find((c) =>
        c.trim().startsWith(`CognitoIdentityServiceProvider.${clientId}.LastAuthUser=`)
      );

      if (!lastAuthUserCookie) {
        return null;
      }

      const userId = lastAuthUserCookie.split("=")[1].trim();

      // Find access token cookie
      const accessTokenCookie = cookies.find((c) =>
        c.trim().startsWith(`CognitoIdentityServiceProvider.${clientId}.${userId}.accessToken=`)
      );

      if (!accessTokenCookie) {
        return null;
      }

      return accessTokenCookie.split("=")[1].trim();
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
        console.error("[TokenRefreshService] Token refresh failed:", errorDetail);
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

// Export singleton instance
export const tokenRefreshService = TokenRefreshService.getInstance();
