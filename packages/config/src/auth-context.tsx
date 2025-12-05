"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface AuthContextType {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  clearAccessToken: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider component that manages access token in memory
 * Tokens are stored in React state (memory), not localStorage
 * This provides better security as tokens are cleared on page refresh/tab close
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);

  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
  }, []);

  const clearAccessToken = useCallback(() => {
    setAccessTokenState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        setAccessToken,
        clearAccessToken,
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

