"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@cashsouk/config";
import type {
  GatewayPaymentDetailDto,
  GatewayPaymentListResponse,
  GatewayPaymentPendingCountResponse,
} from "@cashsouk/types";
import { useAuthToken } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const gatewayPaymentsRootKey = ["admin", "gateway-payments"] as const;

export const gatewayPaymentsKeys = {
  all: gatewayPaymentsRootKey,
  list: (params: Record<string, unknown>) =>
    [...gatewayPaymentsRootKey, "list", params] as const,
  detail: (id: string) => [...gatewayPaymentsRootKey, "detail", id] as const,
  exceptionCount: [...gatewayPaymentsRootKey, "exception-count"] as const,
};

function useGatewayPaymentsApiClient() {
  const { getAccessToken } = useAuthToken();
  return createApiClient(API_URL, getAccessToken);
}

export function useGatewayPaymentsExceptionCount({ enabled = true }: { enabled?: boolean } = {}) {
  const apiClient = useGatewayPaymentsApiClient();
  return useQuery({
    queryKey: gatewayPaymentsKeys.exceptionCount,
    queryFn: async () => {
      const response = await apiClient.getAdminGatewayPaymentsExceptionCount();
      if (!response.success) throw new Error(response.error.message);
      return response.data as GatewayPaymentPendingCountResponse;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled,
  });
}

export function useGatewayPayments(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  purpose?: string;
  filter?: "needs_attention" | "review" | "refunding" | "refunded" | "completed";
  search?: string;
}) {
  const apiClient = useGatewayPaymentsApiClient();
  return useQuery({
    queryKey: gatewayPaymentsKeys.list(params ?? {}),
    queryFn: async () => {
      const response = await apiClient.listAdminGatewayPayments(params);
      if (!response.success) throw new Error(response.error.message);
      return response.data as GatewayPaymentListResponse;
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useGatewayPayment(id: string | null) {
  const apiClient = useGatewayPaymentsApiClient();
  return useQuery({
    queryKey: gatewayPaymentsKeys.detail(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("Missing gateway payment id");
      const response = await apiClient.getAdminGatewayPayment(id);
      if (!response.success) throw new Error(response.error.message);
      return response.data as GatewayPaymentDetailDto;
    },
    enabled: Boolean(id),
    staleTime: 0,
    refetchOnMount: true,
  });
}

function useInvalidateGatewayPayments() {
  const queryClient = useQueryClient();
  return async (id?: string) => {
    await queryClient.invalidateQueries({ queryKey: gatewayPaymentsKeys.all });
    if (id) {
      await queryClient.invalidateQueries({ queryKey: gatewayPaymentsKeys.detail(id) });
    }
  };
}

export function useRetryGatewayPaymentRefund() {
  const apiClient = useGatewayPaymentsApiClient();
  const invalidate = useInvalidateGatewayPayments();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.retryAdminGatewayPaymentRefund(id);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (_data, id) => void invalidate(id),
  });
}

export function useInitiateGatewayPaymentRefund() {
  const apiClient = useGatewayPaymentsApiClient();
  const invalidate = useInvalidateGatewayPayments();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiClient.initiateAdminGatewayPaymentRefund(id, reason);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (_data, variables) => void invalidate(variables.id),
  });
}

export function useApproveGatewayNameCheck() {
  const apiClient = useGatewayPaymentsApiClient();
  const invalidate = useInvalidateGatewayPayments();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.approveAdminGatewayNameCheck(id);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (_data, id) => void invalidate(id),
  });
}

export function useRejectGatewayNameCheck() {
  const apiClient = useGatewayPaymentsApiClient();
  const invalidate = useInvalidateGatewayPayments();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.rejectAdminGatewayNameCheck(id);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (_data, id) => void invalidate(id),
  });
}
