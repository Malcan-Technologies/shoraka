"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { ApplicationProcessingFeeResponse, GatewayPaymentStatus } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const ISSUER_PENDING_SUBMIT_AFTER_FEE_KEY = "issuerPendingSubmitAfterFee";

export type IssuerPendingSubmitAfterFee = {
  applicationId: string;
  returnTo: string;
  /** Set when declarations were persisted before leaving for FPX. */
  declarationsSaved?: boolean;
};

const TERMINAL_FEE_STATUSES = new Set<GatewayPaymentStatus>([
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
  "REFUND_INITIATED",
]);

export function isTerminalProcessingFeeStatus(status: GatewayPaymentStatus): boolean {
  return TERMINAL_FEE_STATUSES.has(status);
}

export const applicationProcessingFeeKeys = {
  all: ["application-processing-fee"] as const,
  detail: (applicationId?: string, feeId?: string) =>
    [...applicationProcessingFeeKeys.all, applicationId, feeId] as const,
};

function useApplicationProcessingFeeApiClient() {
  const { getAccessToken } = useAuthToken();
  return createApiClient(API_URL, getAccessToken);
}

export function useCreateApplicationProcessingFeeMutation() {
  const apiClient = useApplicationProcessingFeeApiClient();
  return useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await apiClient.createApplicationProcessingFee(applicationId);
      if (!response.success) {
        const error = new Error(response.error.message) as Error & { code?: string };
        error.code = response.error.code;
        throw error;
      }
      return response.data;
    },
  });
}

/** Idempotent create/load — used to show the server-derived fee amount on the pay step. */
export function useApplicationProcessingFeeOrder(applicationId?: string, enabled = true) {
  const apiClient = useApplicationProcessingFeeApiClient();
  return useQuery({
    queryKey: [...applicationProcessingFeeKeys.all, "order", applicationId] as const,
    enabled: Boolean(applicationId && enabled),
    queryFn: async () => {
      if (!applicationId) throw new Error("Application ID is required");
      const response = await apiClient.createApplicationProcessingFee(applicationId);
      if (!response.success) {
        const error = new Error(response.error.message) as Error & { code?: string };
        error.code = response.error.code;
        throw error;
      }
      return response.data;
    },
    staleTime: 30_000,
    refetchInterval: (query) => {
      const err = query.state.error as (Error & { code?: string }) | null;
      if (
        err?.code === "PROCESSING_FEE_CAPTURE_MISMATCH_HELD" ||
        query.state.data?.status === "HELD"
      ) {
        return 5_000;
      }
      return false;
    },
    retry: (failureCount, error) => {
      if (isProcessingFeeCaptureMismatchHeldError(error)) return false;
      return failureCount < 2;
    },
  });
}

function isProcessingFeeCaptureMismatchHeldError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  return code === "PROCESSING_FEE_CAPTURE_MISMATCH_HELD";
}

export function normalizeProcessingFeeAmount(amount: unknown): number | null {
  if (typeof amount === "number" && Number.isFinite(amount)) return amount;
  if (typeof amount === "string") {
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const PAYMENT_RETURN_POLL_INTERVAL_MS = 1_000;

export function useApplicationProcessingFeeQuery(
  applicationId?: string,
  feeId?: string,
  options?: { pollUntilTerminal?: boolean }
) {
  const apiClient = useApplicationProcessingFeeApiClient();
  return useQuery({
    queryKey: applicationProcessingFeeKeys.detail(applicationId, feeId),
    enabled: Boolean(applicationId && feeId),
    queryFn: async () => {
      if (!applicationId || !feeId) {
        throw new Error("Application ID and processing fee ID are required");
      }
      const response = await apiClient.getApplicationProcessingFee(applicationId, feeId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    refetchInterval: (query) => {
      if (!options?.pollUntilTerminal) return false;
      const status = query.state.data?.status;
      // HELD is settled under review — stop confirm polling; not a pay failure.
      if (status === "HELD") return false;
      if (status && isTerminalProcessingFeeStatus(status)) return false;
      return PAYMENT_RETURN_POLL_INTERVAL_MS;
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function storeIssuerPendingSubmitAfterFee(payload: IssuerPendingSubmitAfterFee) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ISSUER_PENDING_SUBMIT_AFTER_FEE_KEY, JSON.stringify(payload));
}

export function readIssuerPendingSubmitAfterFee(): IssuerPendingSubmitAfterFee | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(ISSUER_PENDING_SUBMIT_AFTER_FEE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as IssuerPendingSubmitAfterFee;
  } catch {
    return null;
  }
}

export function clearIssuerPendingSubmitAfterFee() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ISSUER_PENDING_SUBMIT_AFTER_FEE_KEY);
}

/** Set by the edit-application page; invoked by the return listener after successful FPX payment. */
export const issuerProcessingFeeSubmitRef = {
  current: async (_applicationId: string): Promise<void> => {},
};

export type { ApplicationProcessingFeeResponse };
