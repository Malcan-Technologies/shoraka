"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@cashsouk/config";
import type {
  GatewayReconExceptionDto,
  GatewayReconExceptionListResponse,
  GatewayReconPendingCountResponse,
  GatewayReconRunDetailDto,
  GatewayReconRunListResponse,
} from "@cashsouk/types";
import { useAuthToken } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const gatewayReconRootKey = ["admin", "gateway-recon"] as const;

export const gatewayReconKeys = {
  all: gatewayReconRootKey,
  runs: (params: Record<string, unknown>) => [...gatewayReconRootKey, "runs", params] as const,
  runDetail: (id: string) => [...gatewayReconRootKey, "run", id] as const,
  exceptions: (params: Record<string, unknown>) =>
    [...gatewayReconRootKey, "exceptions", params] as const,
  pendingCount: [...gatewayReconRootKey, "pending-count"] as const,
};

function useGatewayReconApiClient() {
  const { getAccessToken } = useAuthToken();
  return createApiClient(API_URL, getAccessToken);
}

export function useGatewayReconPendingCount({ enabled = true }: { enabled?: boolean } = {}) {
  const apiClient = useGatewayReconApiClient();
  return useQuery({
    queryKey: gatewayReconKeys.pendingCount,
    queryFn: async () => {
      const response = await apiClient.getAdminGatewayReconPendingCount();
      if (!response.success) throw new Error(response.error.message);
      return response.data as GatewayReconPendingCountResponse;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled,
  });
}

export function useGatewayReconRuns(params?: { page?: number; pageSize?: number }) {
  const apiClient = useGatewayReconApiClient();
  return useQuery({
    queryKey: gatewayReconKeys.runs(params ?? {}),
    queryFn: async () => {
      const response = await apiClient.listAdminGatewayReconRuns(params);
      if (!response.success) throw new Error(response.error.message);
      return response.data as GatewayReconRunListResponse;
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useGatewayReconExceptions(params?: {
  page?: number;
  pageSize?: number;
  resolved?: boolean;
  runId?: string;
}) {
  const apiClient = useGatewayReconApiClient();
  return useQuery({
    queryKey: gatewayReconKeys.exceptions(params ?? {}),
    queryFn: async () => {
      const response = await apiClient.listAdminGatewayReconExceptions(params);
      if (!response.success) throw new Error(response.error.message);
      return response.data as GatewayReconExceptionListResponse;
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useGatewayReconRun(id: string | null) {
  const apiClient = useGatewayReconApiClient();
  return useQuery({
    queryKey: gatewayReconKeys.runDetail(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("Missing recon run id");
      const response = await apiClient.getAdminGatewayReconRun(id);
      if (!response.success) throw new Error(response.error.message);
      return response.data as GatewayReconRunDetailDto;
    },
    enabled: Boolean(id),
  });
}

function useInvalidateGatewayRecon() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: gatewayReconKeys.all });
  };
}

export function useTriggerGatewayReconRun() {
  const apiClient = useGatewayReconApiClient();
  const invalidate = useInvalidateGatewayRecon();
  return useMutation({
    mutationFn: async (input?: { runDate?: string }) => {
      const response = await apiClient.triggerAdminGatewayReconRun(input);
      if (!response.success) throw new Error(response.error.message);
      return response.data as GatewayReconRunDetailDto;
    },
    onSuccess: () => void invalidate(),
  });
}

export function useResolveGatewayReconException() {
  const apiClient = useGatewayReconApiClient();
  const invalidate = useInvalidateGatewayRecon();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiClient.resolveAdminGatewayReconException(id, reason);
      if (!response.success) throw new Error(response.error.message);
      return response.data as GatewayReconExceptionDto;
    },
    onSuccess: () => void invalidate(),
  });
}
