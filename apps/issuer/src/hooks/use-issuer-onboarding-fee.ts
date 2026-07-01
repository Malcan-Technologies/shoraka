"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { GatewayPaymentStatus } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const ISSUER_PENDING_ONBOARDING_KEY = "issuerPendingOnboarding";

export type IssuerPendingOnboarding = {
  orgId: string;
  companyName: string;
};

const TERMINAL_FEE_STATUSES = new Set<GatewayPaymentStatus>([
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
  "REFUND_INITIATED",
]);

export function isTerminalOnboardingFeeStatus(status: GatewayPaymentStatus): boolean {
  return TERMINAL_FEE_STATUSES.has(status);
}

export const issuerOnboardingFeeKeys = {
  all: ["issuer-onboarding-fee"] as const,
  detail: (feeId?: string) => [...issuerOnboardingFeeKeys.all, feeId] as const,
};

function useIssuerOnboardingFeeApiClient() {
  const { getAccessToken } = useAuthToken();
  return createApiClient(API_URL, getAccessToken);
}

export function useCreateIssuerOnboardingFeeMutation() {
  const apiClient = useIssuerOnboardingFeeApiClient();
  return useMutation({
    mutationFn: async (input: { issuerOrganizationId: string }) => {
      const response = await apiClient.createIssuerOnboardingFee(input);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

const PAYMENT_RETURN_POLL_INTERVAL_MS = 1_000;

export function useIssuerOnboardingFeeQuery(
  feeId?: string,
  options?: { pollUntilTerminal?: boolean }
) {
  const apiClient = useIssuerOnboardingFeeApiClient();
  return useQuery({
    queryKey: issuerOnboardingFeeKeys.detail(feeId),
    enabled: Boolean(feeId),
    queryFn: async () => {
      if (!feeId) throw new Error("Onboarding fee ID is required");
      const response = await apiClient.getIssuerOnboardingFee(feeId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    refetchInterval: (query) => {
      if (!options?.pollUntilTerminal) return false;
      const status = query.state.data?.status;
      if (status && isTerminalOnboardingFeeStatus(status)) return false;
      return PAYMENT_RETURN_POLL_INTERVAL_MS;
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function storeIssuerPendingOnboarding(payload: IssuerPendingOnboarding) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ISSUER_PENDING_ONBOARDING_KEY, JSON.stringify(payload));
}

export function readIssuerPendingOnboarding(): IssuerPendingOnboarding | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(ISSUER_PENDING_ONBOARDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as IssuerPendingOnboarding;
  } catch {
    return null;
  }
}

export function clearIssuerPendingOnboarding() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ISSUER_PENDING_ONBOARDING_KEY);
}
