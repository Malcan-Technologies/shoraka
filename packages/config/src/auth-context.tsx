"use client";

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { fetchAuthSession, signOut as amplifySignOut } from "aws-amplify/auth";
import { tokenRefreshService } from "./token-refresh-service";

interface AuthContextType {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  clearAccessToken: () => void;
  getAccessToken: () => Promise<string | null>;
  isAuthenticated: boolean | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider component that manages authentication using AWS Amplify
 * Tokens are stored by Amplify in cookies (configured via cookieStorage)
 * This provides better security as tokens are managed by AWS Cognito
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  /**
   * Get access token with automatic refresh support
   *
   * Flow:
   * 1. Try Amplify's fetchAuthSession first
   * 2. If token expired/missing, attempt manual refresh via tokenRefreshService
   * 3. Fallback to reading directly from cookies
   * 4. Update state and return token
   */
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      // Try Amplify first
      const session = await fetchAuthSession();
      let token = session.tokens?.accessToken?.toString() || null;

      // If no token or token is expired, try manual refresh
      if (!token || tokenRefreshService.isTokenExpired(token)) {
        // eslint-disable-next-line no-console
        console.log("[AuthProvider] Token expired or missing, attempting refresh...");
        token = await tokenRefreshService.refreshToken();

        // If still no token, try reading directly from cookies as last resort
        if (!token) {
          token = tokenRefreshService.readTokenFromCookies();
        }
      }

      if (token) {
        setAccessTokenState(token);
        setIsAuthenticated(true);
        return token;
      } else {
        setAccessTokenState(null);
        setIsAuthenticated(false);
        return null;
      }
    } catch (error) {
      console.error("[AuthProvider] Failed to get access token:", error);
      setAccessTokenState(null);
      setIsAuthenticated(false);
      return null;
    }
  }, []);

  /**
   * Check authentication status on mount
   */
  useEffect(() => {
    getAccessToken();
  }, [getAccessToken]);

  /**
   * Add visibility change detection
   * Triggers token check when:
   * - Tab gains focus
   * - Laptop wakes from sleep
   * - Screen unlocks
   */
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        // eslint-disable-next-line no-console
        console.log("[AuthProvider] Page visible, checking token...");
        await getAccessToken(); // Will refresh if needed
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [getAccessToken]);

  /**
   * Proactive token refresh interval
   * Checks token expiry every 5 minutes and refreshes if needed
   * This prevents tokens from expiring during long active sessions
   */
  useEffect(() => {
    const interval = setInterval(
      async () => {
        const token = accessToken || tokenRefreshService.readTokenFromCookies();
        if (token && tokenRefreshService.isTokenExpired(token)) {
          // eslint-disable-next-line no-console
          console.log("[AuthProvider] Proactive refresh triggered");
          await getAccessToken();
        }
      },
      5 * 60 * 1000
    ); // Every 5 minutes

    return () => clearInterval(interval);
  }, [accessToken, getAccessToken]);

  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
    setIsAuthenticated(!!token);
  }, []);

  const clearAccessToken = useCallback(() => {
    setAccessTokenState(null);
    setIsAuthenticated(false);
  }, []);

  /**
   * Sign out from Amplify
   * This clears the Cognito session and all tokens
   */
  const signOut = useCallback(async () => {
    try {
      await amplifySignOut({ global: true });
      clearAccessToken();
    } catch (error) {
      console.error("[AuthProvider] Failed to sign out:", error);
      // Still clear local state even if Amplify sign out fails
      clearAccessToken();
    }
  }, [clearAccessToken]);

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        setAccessToken,
        clearAccessToken,
        getAccessToken,
        isAuthenticated,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth token from context
 * Returns the access token and functions to set/clear it
 */
export function useAuthToken() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthToken must be used within an AuthProvider");
  }
  return context;
}
