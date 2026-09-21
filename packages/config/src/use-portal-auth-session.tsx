"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createApiClient } from "./api-client";
import {
  applyAuthSessionOutcome,
  createFixedAccessTokenGetter,
  runPortalAuthSessionCheck,
} from "./auth-session-check";
import { useAuthToken } from "./auth-context";

type PortalAuthSessionValue = {
  isAuthenticated: boolean | null;
  sessionUnavailable: boolean;
  retrySessionCheck: () => void;
};

const PortalAuthSessionContext = createContext<PortalAuthSessionValue | null>(null);

function usePortalAuthSessionState(options: {
  enabled: boolean;
  apiUrl: string;
  redirectToLogin: () => void;
}): PortalAuthSessionValue {
  const { enabled, apiUrl, redirectToLogin } = options;
  const { getAccessToken, signOut } = useAuthToken();
  const [status, setStatus] = useState<
    "checking" | "authenticated" | "unauthenticated" | "unavailable"
  >("checking");
  const [retryKey, setRetryKey] = useState(0);

  const retrySessionCheck = useCallback(() => {
    setStatus("checking");
    setRetryKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    const checkAuth = async () => {
      const result = await runPortalAuthSessionCheck({
        getAccessToken,
        fetchMe: (accessToken) => {
          const apiClient = createApiClient(apiUrl, createFixedAccessTokenGetter(accessToken));
          return apiClient.get("/v1/auth/me");
        },
        isCancelled: () => cancelled,
      });

      if (cancelled) {
        return;
      }

      applyAuthSessionOutcome(result, {
        onAuthenticated: () => setStatus("authenticated"),
        onUnauthorized: () => {
          setStatus("unauthenticated");
          void signOut().finally(() => {
            if (!cancelled) {
              redirectToLogin();
            }
          });
        },
        onUnauthenticated: () => {
          setStatus("unauthenticated");
          redirectToLogin();
        },
        onRetryable: () => setStatus("unavailable"),
      });
    };

    void checkAuth();
    return () => {
      cancelled = true;
    };
  }, [enabled, apiUrl, getAccessToken, signOut, redirectToLogin, retryKey]);

  if (!enabled) {
    return { isAuthenticated: null, sessionUnavailable: false, retrySessionCheck };
  }

  return {
    isAuthenticated:
      status === "authenticated" ? true : status === "unauthenticated" ? false : null,
    sessionUnavailable: status === "unavailable",
    retrySessionCheck,
  };
}

export function PortalAuthSessionProvider({
  children,
  enabled,
  disabledAuthenticated = false,
  apiUrl,
  redirectToLogin,
}: {
  children: ReactNode;
  enabled: boolean;
  disabledAuthenticated?: boolean;
  apiUrl: string;
  redirectToLogin: () => void;
}) {
  const session = usePortalAuthSessionState({ enabled, apiUrl, redirectToLogin });
  const value: PortalAuthSessionValue = enabled
    ? session
    : {
        isAuthenticated: disabledAuthenticated ? true : null,
        sessionUnavailable: false,
        retrySessionCheck: session.retrySessionCheck,
      };

  return (
    <PortalAuthSessionContext.Provider value={value}>{children}</PortalAuthSessionContext.Provider>
  );
}

export function usePortalAuthSession(): PortalAuthSessionValue {
  const context = useContext(PortalAuthSessionContext);
  if (!context) {
    throw new Error("usePortalAuthSession must be used within a PortalAuthSessionProvider");
  }
  return context;
}
