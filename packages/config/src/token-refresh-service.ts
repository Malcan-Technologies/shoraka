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
   */
  private async _doRefresh(): Promise<string | null> {
    try {
      // Get refresh token from cookies
      const cookies = document.cookie.split(";");
      const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

      if (!clientId) {
        console.error("[TokenRefreshService] NEXT_PUBLIC_COGNITO_CLIENT_ID not set");
        return null;
      }

      // Find LastAuthUser cookie to get the user ID
      const lastAuthUserCookie = cookies.find((c) =>
        c.trim().startsWith(`CognitoIdentityServiceProvider.${clientId}.LastAuthUser=`)
      );

      if (!lastAuthUserCookie) {
        // eslint-disable-next-line no-console
        console.log("[TokenRefreshService] No LastAuthUser cookie found");
        return null;
      }

      const userId = lastAuthUserCookie.split("=")[1].trim();

      // Find refresh token
      const refreshTokenCookie = cookies.find((c) =>
        c.trim().startsWith(`CognitoIdentityServiceProvider.${clientId}.${userId}.refreshToken=`)
      );

      if (!refreshTokenCookie) {
        // eslint-disable-next-line no-console
        console.log("[TokenRefreshService] No refresh token found");
        return null;
      }

      const refreshToken = refreshTokenCookie.split("=")[1].trim();

      // Call Cognito token endpoint
      const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;

      if (!cognitoDomain) {
        console.error("[TokenRefreshService] NEXT_PUBLIC_COGNITO_DOMAIN not set");
        return null;
      }

      // eslint-disable-next-line no-console
      console.log("[TokenRefreshService] Refreshing access token...");

      const response = await fetch(`https://${cognitoDomain}/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        console.error("[TokenRefreshService] Token refresh failed:", response.status);
        return null;
      }

      const data = await response.json();

      // Update cookies with new tokens
      const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || "localhost";
      const isSecure = process.env.NODE_ENV === "production";
      const cookieOptions = `domain=${cookieDomain}; path=/; ${isSecure ? "secure;" : ""} samesite=lax`;

      // Set new access token
      document.cookie = `CognitoIdentityServiceProvider.${clientId}.${userId}.accessToken=${data.access_token}; max-age=3600; ${cookieOptions}`;

      // Set new ID token
      if (data.id_token) {
        document.cookie = `CognitoIdentityServiceProvider.${clientId}.${userId}.idToken=${data.id_token}; max-age=3600; ${cookieOptions}`;
      }

      // eslint-disable-next-line no-console
      console.log("[TokenRefreshService] Token refreshed successfully");
      
      // Return the new access token
      return data.access_token;
    } catch (error) {
      console.error("[TokenRefreshService] Token refresh error:", error);
      return null;
    }
  }
}

// Export singleton instance
export const tokenRefreshService = TokenRefreshService.getInstance();

