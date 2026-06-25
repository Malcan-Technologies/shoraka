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
  pendingCount: [...gatewayPaymentsRootKey, "held-pending-count"] as const,
};

function useGatewayPaymentsApiClient() {
  const { getAccessToken } = useAuthToken();
  return createApiClient(API_URL, getAccessToken);
}

export function useHeldGatewayPaymentsPendingCount({ enabled = true }: { enabled?: boolean } = {}) {
  const apiClient = useGatewayPaymentsApiClient();
  return useQuery({
    queryKey: gatewayPaymentsKeys.pendingCount,
    queryFn: async () => {
      const response = await apiClient.getAdminHeldGatewayPaymentsPendingCount();
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
  queue?: "held";
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

export function useApproveGatewayPaymentNameCheck() {
  const apiClient = useGatewayPaymentsApiClient();
  const invalidate = useInvalidateGatewayPayments();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiClient.approveGatewayPaymentNameCheck(id, reason);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (_data, variables) => void invalidate(variables.id),
  });
}

export function useRejectGatewayPaymentNameCheck() {
  const apiClient = useGatewayPaymentsApiClient();
  const invalidate = useInvalidateGatewayPayments();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiClient.rejectGatewayPaymentNameCheck(id, reason);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (_data, variables) => void invalidate(variables.id),
  });
}

export function useProposeGatewayPaymentOverride() {
  const apiClient = useGatewayPaymentsApiClient();
  const invalidate = useInvalidateGatewayPayments();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiClient.proposeGatewayPaymentOverride(id, reason);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (_data, variables) => void invalidate(variables.id),
  });
}

export function useApproveGatewayPaymentOverride() {
  const apiClient = useGatewayPaymentsApiClient();
  const invalidate = useInvalidateGatewayPayments();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.approveGatewayPaymentOverride(id);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (_data, id) => void invalidate(id),
  });
}

export function useRejectGatewayPaymentOverride() {
  const apiClient = useGatewayPaymentsApiClient();
  const invalidate = useInvalidateGatewayPayments();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiClient.rejectGatewayPaymentOverride(id, reason);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (_data, variables) => void invalidate(variables.id),
  });
}

export function useRecordGatewayPaymentRefund() {
  const apiClient = useGatewayPaymentsApiClient();
  const invalidate = useInvalidateGatewayPayments();
  return useMutation({
    mutationFn: async ({
      id,
      reference,
      notes,
    }: {
      id: string;
      reference: string;
      notes?: string;
    }) => {
      const response = await apiClient.recordGatewayPaymentRefund(id, { reference, notes });
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (_data, variables) => void invalidate(variables.id),
  });
}

export function useCompleteGatewayPaymentRefund() {
  const apiClient = useGatewayPaymentsApiClient();
  const invalidate = useInvalidateGatewayPayments();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const response = await apiClient.completeGatewayPaymentRefund(id, { notes });
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (_data, variables) => void invalidate(variables.id),
  });
}
