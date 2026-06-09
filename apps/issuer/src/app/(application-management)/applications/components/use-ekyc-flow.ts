"use client";

import * as React from "react";
import type { ApiClient } from "@cashsouk/config";
import type { ApiError, EkycSessionStatus } from "@cashsouk/types";

type UseEkycFlowOptions = {
  apiClient: ApiClient;
  apiBaseUrl: string;
};

type UseEkycFlowResult = {
  captureUrl: string | null;
  status: EkycSessionStatus["status"] | null;
  error: string | null;
  isGenerating: boolean;
  generateSession: () => Promise<boolean>;
  reset: () => void;
};

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
}: UseEkycFlowOptions): UseEkycFlowResult {
  const [token, setToken] = React.useState<string | null>(null);
  const [endpoint, setEndpoint] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<EkycSessionStatus["status"] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const captureUrl = React.useMemo(() => {
    if (!token || !endpoint || typeof window === "undefined") {
      return null;
    }

    const captureParams = new URLSearchParams({
      token,
      endpoint,
      docType: "mykad",
      api: apiBaseUrl,
    });

    return `${window.location.origin}/ekyc/capture.html?${captureParams.toString()}`;
  }, [apiBaseUrl, endpoint, token]);

  const reset = React.useCallback(() => {
    setToken(null);
    setEndpoint(null);
    setStatus(null);
    setError(null);
    setIsGenerating(false);
  }, []);

  const generateSession = React.useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await apiClient.createEkycSession({ docType: "mykad" });
      if (!response.success) {
        throw new Error(getErrorMessage(response, "Failed to create eKYC session"));
      }

      setToken(response.data.token);
      setEndpoint(response.data.url);
      setStatus("pending");
      return true;
    } catch (sessionError) {
      setStatus("error");
      setError(getErrorMessage(sessionError, "Failed to create eKYC session"));
      return false;
    } finally {
      setIsGenerating(false);
    }
  }, [apiClient]);

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
        setError(getErrorMessage(response, "Failed to poll eKYC status"));
        return;
      }

      setStatus(response.data.status);
      setError(response.data.error);
    };

    pollStatus().catch((pollError) => {
      if (!active) {
        return;
      }
      setStatus("error");
      setError(getErrorMessage(pollError, "Failed to poll eKYC status"));
    });

    const timer = window.setInterval(() => {
      pollStatus().catch((pollError) => {
        if (!active) {
          return;
        }
        setStatus("error");
        setError(getErrorMessage(pollError, "Failed to poll eKYC status"));
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
    isGenerating,
    generateSession,
    reset,
  };
}
