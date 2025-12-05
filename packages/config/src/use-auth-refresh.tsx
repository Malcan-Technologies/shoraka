"use client";

import { useEffect, useState, useRef } from "react";
import { useAuthToken } from "./auth-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Hook to automatically refresh access token when it's missing from memory
 * Used on page load and portal switching to restore authentication
 * 
 * Returns:
 * - isLoading: true while attempting to refresh
 * - needsLogin: true if refresh failed (user needs to login)
 * - isRefreshing: true if currently refreshing token
 */
export function useAuthRefresh() {
  const { accessToken, setAccessToken } = useAuthToken();
  const [isLoading, setIsLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasAttemptedRef = useRef(false);

  useEffect(() => {
    // Only attempt refresh once per mount
    if (hasAttemptedRef.current) {
      return;
    }

    // If we already have an access token, no need to refresh
    if (accessToken) {
      setIsLoading(false);
      hasAttemptedRef.current = true;
      return;
    }

    // Attempt silent refresh
    const attemptRefresh = async () => {
      setIsRefreshing(true);
      hasAttemptedRef.current = true;

      try {
        // Call silent refresh endpoint (uses refresh_token cookie)
        const response = await fetch(`${API_URL}/v1/auth/silent-refresh`, {
          method: "GET",
          credentials: "include", // Include cookies (refresh_token)
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.accessToken) {
            // Store new access token in memory
            setAccessToken(data.data.accessToken);
            setIsLoading(false);
            setNeedsLogin(false);
            setIsRefreshing(false);
            return;
          }
        }

        // Refresh failed - user needs to login
        setNeedsLogin(true);
        setIsLoading(false);
        setIsRefreshing(false);
      } catch (error) {
        // Network error or other failure
        console.error("[useAuthRefresh] Failed to refresh token:", error);
        setNeedsLogin(true);
        setIsLoading(false);
        setIsRefreshing(false);
      }
    };

    attemptRefresh();
  }, [accessToken, setAccessToken]);

  return {
    isLoading,
    needsLogin,
    isRefreshing,
  };
}

