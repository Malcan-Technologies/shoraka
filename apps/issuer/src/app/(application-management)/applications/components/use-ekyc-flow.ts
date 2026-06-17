"use client";

import * as React from "react";
import type { ApiClient } from "@cashsouk/config";
import type { ApiError, EkycSessionStatus } from "@cashsouk/types";

type UseEkycFlowOptions = {
  apiClient: ApiClient;
  apiBaseUrl: string;
  issuerOrganizationId: string | undefined;
};

type GenerateSessionOptions = {
  force?: boolean;
};

type UseEkycFlowResult = {
  captureUrl: string | null;
  status: EkycSessionStatus["status"] | null;
  error: string | null;
  requiresSupport: boolean;
  isGenerating: boolean;
  isPendingStale: boolean;
  generateSession: (options?: GenerateSessionOptions) => Promise<boolean>;
  reset: () => void;
};

const PENDING_STALE_MS = 60_000;
const EKYC_PROVIDER_UNAVAILABLE_CODE = "EKYC_PROVIDER_UNAVAILABLE";

function getErrorCode(response: ApiError | unknown): string | null {
  if (
    response &&
    typeof response === "object" &&
    "success" in response &&
    response.success === false &&
    "error" in response &&
    response.error &&
    typeof response.error === "object" &&
    "code" in response.error &&
    typeof response.error.code === "string"
  ) {
    return response.error.code;
  }

  return null;
}

function getErrorMessage(response: ApiError | Error | unknown, fallback: string): string {
  if (response instanceof Error) {
    return response.message;
  }

  if (
    response &&
    typeof response === "object" &&
    "success" in response &&
    response.success === false &&
    "error" in response &&
    response.error &&
    typeof response.error === "object" &&
    "message" in response.error &&
    typeof response.error.message === "string"
  ) {
    return response.error.message;
  }

  return fallback;
}

export function useEkycFlow({
  apiClient,
  apiBaseUrl,
  issuerOrganizationId,
}: UseEkycFlowOptions): UseEkycFlowResult {
  const [token, setToken] = React.useState<string | null>(null);
  const [endpoint, setEndpoint] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<EkycSessionStatus["status"] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [errorCode, setErrorCode] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [pendingSince, setPendingSince] = React.useState<number | null>(null);
  const [isPendingStale, setIsPendingStale] = React.useState(false);

  const requiresSupport = errorCode === EKYC_PROVIDER_UNAVAILABLE_CODE;

  const captureUrl = React.useMemo(() => {
    if (!token || !endpoint || typeof window === "undefined") {
      return null;
    }

    const captureParams = new URLSearchParams({
      token,
      endpoint,
      api: apiBaseUrl,
    });

    return `${window.location.origin}/ekyc/capture.html?${captureParams.toString()}`;
  }, [apiBaseUrl, endpoint, token]);

  React.useEffect(() => {
    if (status !== "pending" || pendingSince === null) {
      setIsPendingStale(false);
      return undefined;
    }

    const elapsed = Date.now() - pendingSince;
    if (elapsed >= PENDING_STALE_MS) {
      setIsPendingStale(true);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setIsPendingStale(true);
    }, PENDING_STALE_MS - elapsed);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pendingSince, status]);

  const reset = React.useCallback(() => {
    setToken(null);
    setEndpoint(null);
    setStatus(null);
    setError(null);
    setErrorCode(null);
    setIsGenerating(false);
    setPendingSince(null);
    setIsPendingStale(false);
  }, []);

  const generateSession = React.useCallback(
    async (options?: GenerateSessionOptions) => {
      const force = options?.force === true;
      if (!issuerOrganizationId) {
        setStatus("error");
        setError("Select an organization before starting identity verification.");
        setErrorCode(null);
        setPendingSince(null);
        return false;
      }

      setIsGenerating(true);
      setError(null);
      setErrorCode(null);

      try {
        const response = await apiClient.createEkycSession({ issuerOrganizationId, force });
        if (!response.success) {
          setStatus("error");
          setErrorCode(getErrorCode(response));
          setError(getErrorMessage(response, "Failed to create eKYC session"));
          setPendingSince(null);
          return false;
        }

        setToken(response.data.token);
        setEndpoint(response.data.url);
        setStatus("pending");
        setPendingSince(Date.now());
        setIsPendingStale(false);
        return true;
      } catch (sessionError) {
        setStatus("error");
        setErrorCode(getErrorCode(sessionError));
        setError(getErrorMessage(sessionError, "Failed to create eKYC session"));
        setPendingSince(null);
        return false;
      } finally {
        setIsGenerating(false);
      }
    },
    [apiClient, issuerOrganizationId]
  );

  React.useEffect(() => {
    if (!token || status !== "pending") {
      return undefined;
    }

    let active = true;

    const pollStatus = async () => {
      const response = await apiClient.getEkycSessionStatus(token);
      if (!active) {
        return;
      }

      if (!response.success) {
        setStatus("error");
        setErrorCode(getErrorCode(response));
        setError(getErrorMessage(response, "Failed to poll eKYC status"));
        setPendingSince(null);
        return;
      }

      setStatus(response.data.status);
      setError(response.data.error);
      setErrorCode(null);

      if (response.data.status !== "pending") {
        setPendingSince(null);
      }
    };

    pollStatus().catch((pollError) => {
      if (!active) {
        return;
      }
      setStatus("error");
      setErrorCode(getErrorCode(pollError));
      setError(getErrorMessage(pollError, "Failed to poll eKYC status"));
      setPendingSince(null);
    });

    const timer = window.setInterval(() => {
      pollStatus().catch((pollError) => {
        if (!active) {
          return;
        }
        setStatus("error");
        setErrorCode(getErrorCode(pollError));
        setError(getErrorMessage(pollError, "Failed to poll eKYC status"));
        setPendingSince(null);
      });
    }, 2500);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [apiClient, status, token]);

  return {
    captureUrl,
    status,
    error,
    requiresSupport,
    isGenerating,
    isPendingStale,
    generateSession,
    reset,
  };
}
