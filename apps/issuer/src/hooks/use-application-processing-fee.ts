"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { ApplicationProcessingFeeResponse } from "@cashsouk/types";
import {
  parseProcessingFeePendingStore,
  processingFeeConfirmPollIntervalMs,
  processingFeeConfirmQueryRefresh,
  readProcessingFeePendingStoreEntry,
  removeProcessingFeePendingStoreEntry,
  shouldReconcileProcessingFeeDetail,
  upsertProcessingFeePendingStore,
  type ProcessingFeePendingConfirmation,
} from "@/lib/application-processing-fee-confirmation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const ISSUER_PENDING_SUBMIT_AFTER_FEE_KEY = "issuerPendingSubmitAfterFee";

export type IssuerPendingSubmitAfterFee = ProcessingFeePendingConfirmation;

export { isTerminalProcessingFeeStatus } from "@/lib/application-processing-fee-confirmation";

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
export function useApplicationProcessingFeeOrder(
  applicationId?: string,
  enabled = true,
  options?: { pollWhileConfirming?: boolean }
) {
  const apiClient = useApplicationProcessingFeeApiClient();
  const pollStartedAtRef = useRef<number | null>(null);
  const knownFeeRef = useRef<{
    applicationId: string;
    feeId: string;
    status: ApplicationProcessingFeeResponse["status"];
  } | null>(null);

  return useQuery({
    queryKey: [...applicationProcessingFeeKeys.all, "order", applicationId] as const,
    enabled: Boolean(applicationId && enabled),
    queryFn: async () => {
      if (!applicationId) throw new Error("Application ID is required");
      const knownFee =
        knownFeeRef.current?.applicationId === applicationId ? knownFeeRef.current : null;
      const response =
        knownFee &&
        shouldReconcileProcessingFeeDetail(
          knownFee.status,
          options?.pollWhileConfirming === true
        )
          ? await apiClient.getApplicationProcessingFee(applicationId, knownFee.feeId)
          : await apiClient.createApplicationProcessingFee(applicationId);
      if (!response.success) {
        const error = new Error(response.error.message) as Error & { code?: string };
        error.code = response.error.code;
        throw error;
      }
      knownFeeRef.current = {
        applicationId,
        feeId: response.data.id,
        status: response.data.status,
      };
      return response.data;
    },
    staleTime: options?.pollWhileConfirming ? 0 : 30_000,
    refetchOnWindowFocus: (query) =>
      Boolean(options?.pollWhileConfirming) || query.state.data?.status === "PAID",
    refetchIntervalInBackground: false,
    placeholderData: (previousData) => previousData,
    refetchInterval: (query) => {
      const err = query.state.error as (Error & { code?: string }) | null;
      if (
        err?.code === "PROCESSING_FEE_CAPTURE_MISMATCH_HELD" ||
        query.state.data?.status === "HELD"
      ) {
        pollStartedAtRef.current = null;
        return 5_000;
      }
      const status = query.state.data?.status;
      const confirming = shouldReconcileProcessingFeeDetail(
        status,
        options?.pollWhileConfirming === true
      );
      if (!confirming) {
        pollStartedAtRef.current = null;
        return false;
      }
      pollStartedAtRef.current ??= Date.now();
      return processingFeeConfirmPollIntervalMs({
        status,
        pollUntilTerminal: true,
        elapsedMs: Date.now() - pollStartedAtRef.current,
      });
    },
    retry: (failureCount, error) => {
      if (isProcessingFeeCaptureMismatchHeldError(error)) return false;
      return failureCount < 4;
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

export function useApplicationProcessingFeeQuery(
  applicationId?: string,
  feeId?: string,
  options?: { pollUntilTerminal?: boolean }
) {
  const apiClient = useApplicationProcessingFeeApiClient();
  const pollStartedAtRef = useRef<number | null>(null);

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
      if (!options?.pollUntilTerminal) {
        pollStartedAtRef.current = null;
        return false;
      }
      pollStartedAtRef.current ??= Date.now();
      return processingFeeConfirmPollIntervalMs({
        status: query.state.data?.status,
        pollUntilTerminal: true,
        elapsedMs: Date.now() - pollStartedAtRef.current,
      });
    },
    placeholderData: (previousData) => previousData,
    retry: (failureCount) => failureCount < 4,
    retryDelay: (attemptIndex) => Math.min(1_000 * 2 ** attemptIndex, 8_000),
    ...processingFeeConfirmQueryRefresh,
  });
}

export function storeIssuerPendingSubmitAfterFee(payload: IssuerPendingSubmitAfterFee) {
  if (typeof window === "undefined") return;
  const current = parseProcessingFeePendingStore(
    sessionStorage.getItem(ISSUER_PENDING_SUBMIT_AFTER_FEE_KEY)
  );
  sessionStorage.setItem(
    ISSUER_PENDING_SUBMIT_AFTER_FEE_KEY,
    JSON.stringify(upsertProcessingFeePendingStore(current, payload))
  );
}

export function readIssuerPendingSubmitAfterFee(
  applicationId?: string
): IssuerPendingSubmitAfterFee | null {
  if (typeof window === "undefined") return null;
  const store = parseProcessingFeePendingStore(
    sessionStorage.getItem(ISSUER_PENDING_SUBMIT_AFTER_FEE_KEY)
  );
  return readProcessingFeePendingStoreEntry(store, applicationId);
}

export function clearIssuerPendingSubmitAfterFee(applicationId?: string) {
  if (typeof window === "undefined") return;
  if (!applicationId) {
    sessionStorage.removeItem(ISSUER_PENDING_SUBMIT_AFTER_FEE_KEY);
    return;
  }
  const current = parseProcessingFeePendingStore(
    sessionStorage.getItem(ISSUER_PENDING_SUBMIT_AFTER_FEE_KEY)
  );
  const next = removeProcessingFeePendingStoreEntry(current, applicationId);
  if (Object.keys(next.entries).length === 0) {
    sessionStorage.removeItem(ISSUER_PENDING_SUBMIT_AFTER_FEE_KEY);
    return;
  }
  sessionStorage.setItem(ISSUER_PENDING_SUBMIT_AFTER_FEE_KEY, JSON.stringify(next));
}

/** Set by the edit-application page; invoked by the return listener after successful FPX payment. */
export const issuerProcessingFeeSubmitRef = {
  current: async (_applicationId: string): Promise<void> => {},
};

export type { ApplicationProcessingFeeResponse };
