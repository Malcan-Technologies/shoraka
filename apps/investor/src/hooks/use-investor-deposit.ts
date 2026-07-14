"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { GatewayPaymentStatus } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const DEPOSIT_INTENT_STORAGE_PREFIX = "investor-deposit-intent";

type PersistedDepositIntent = {
  intentId: string;
  amount: number;
};

type ApiErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

const TERMINAL_DEPOSIT_STATUSES = new Set<GatewayPaymentStatus>([
  "COMPLETED",
  "HELD",
  "NAME_CHECK_PENDING",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
  "REFUND_INITIATED",
]);

export function isTerminalDepositStatus(status: GatewayPaymentStatus): boolean {
  return TERMINAL_DEPOSIT_STATUSES.has(status);
}

export const investorDepositKeys = {
  all: ["investor-deposit"] as const,
  detail: (depositId?: string) => [...investorDepositKeys.all, depositId] as const,
  limits: () => [...investorDepositKeys.all, "limits"] as const,
};

function useInvestorDepositApiClient() {
  const { getAccessToken } = useAuthToken();
  return createApiClient(API_URL, getAccessToken);
}

function getDepositIntentStorageKey(investorOrganizationId: string) {
  return `${DEPOSIT_INTENT_STORAGE_PREFIX}:${investorOrganizationId}`;
}

function makeDepositIntentId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readPersistedDepositIntent(investorOrganizationId: string): PersistedDepositIntent | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(getDepositIntentStorageKey(investorOrganizationId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PersistedDepositIntent;
    if (!parsed.intentId || typeof parsed.amount !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersistedDepositIntent(
  investorOrganizationId: string,
  value: PersistedDepositIntent
) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(getDepositIntentStorageKey(investorOrganizationId), JSON.stringify(value));
}

export function getOrCreateInvestorDepositIntent(
  investorOrganizationId: string,
  amount: number
): string {
  const existing = readPersistedDepositIntent(investorOrganizationId);
  if (existing && existing.amount === amount) {
    return existing.intentId;
  }

  const intentId = makeDepositIntentId();
  writePersistedDepositIntent(investorOrganizationId, { intentId, amount });
  return intentId;
}

export function clearInvestorDepositIntent(investorOrganizationId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(getDepositIntentStorageKey(investorOrganizationId));
}

export class InvestorDepositCreateError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "InvestorDepositCreateError";
  }
}

export function isDepositIntentTerminalError(error: unknown): error is InvestorDepositCreateError {
  return (
    error instanceof InvestorDepositCreateError && error.code === "DEPOSIT_INTENT_TERMINAL"
  );
}

export function useCreateInvestorDepositMutation() {
  const apiClient = useInvestorDepositApiClient();
  return useMutation({
    mutationFn: async (input: {
      investorOrganizationId: string;
      amount: number;
      depositIntentId: string;
    }) => {
      const response = await apiClient.createInvestorDeposit(input);
      if (!response.success) {
        const payload = response.error as ApiErrorPayload;
        throw new InvestorDepositCreateError(payload.code, payload.message, payload.details);
      }
      return response.data;
    },
  });
}

export function useInvestorDepositLimitsQuery() {
  const apiClient = useInvestorDepositApiClient();
  return useQuery({
    queryKey: investorDepositKeys.limits(),
    queryFn: async () => {
      const response = await apiClient.getInvestorDepositLimits();
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useInvestorDepositQuery(
  depositId?: string,
  options?: { pollUntilTerminal?: boolean }
) {
  const apiClient = useInvestorDepositApiClient();
  return useQuery({
    queryKey: investorDepositKeys.detail(depositId),
    enabled: Boolean(depositId),
    queryFn: async () => {
      if (!depositId) throw new Error("Deposit ID is required");
      const response = await apiClient.getInvestorDeposit(depositId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    refetchInterval: (query) => {
      if (!options?.pollUntilTerminal) return false;
      const status = query.state.data?.status;
      if (status && isTerminalDepositStatus(status)) return false;
      return 2000;
    },
  });
}
