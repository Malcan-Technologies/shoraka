"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { fetchAuthSession, signOut as amplifySignOut } from "aws-amplify/auth";

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
   * Get access token from Amplify session
   * Fetches the current session and extracts the access token
   */
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.accessToken?.toString() || null;
      
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
      console.error("[AuthProvider] Failed to fetch auth session:", error);
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
