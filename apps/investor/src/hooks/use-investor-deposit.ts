"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { GatewayPaymentStatus } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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

export function useCreateInvestorDepositMutation() {
  const apiClient = useInvestorDepositApiClient();
  return useMutation({
    mutationFn: async (input: { investorOrganizationId: string; amount: number }) => {
      const response = await apiClient.createInvestorDeposit(input);
      if (!response.success) throw new Error(response.error.message);
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
