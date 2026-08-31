"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { PaymasterVerificationStatus } from "@cashsouk/types";
import { applicationsKeys } from "@/applications/query-keys";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const paymastersKeys = {
  all: ["admin", "paymasters"] as const,
  list: (params: {
    q?: string;
    verificationStatus?: PaymasterVerificationStatus;
    page?: number;
    pageSize?: number;
  }) => [...paymastersKeys.all, "list", params] as const,
  detail: (id: string) => [...paymastersKeys.all, "detail", id] as const,
};

export function useAdminPaymasters(params: {
  q?: string;
  verificationStatus?: PaymasterVerificationStatus;
  page?: number;
  pageSize?: number;
}) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  return useQuery({
    queryKey: paymastersKeys.list(params),
    queryFn: async () => {
      const response = await apiClient.listAdminPaymasters(params);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useAdminPaymasterDetail(id: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  return useQuery({
    queryKey: paymastersKeys.detail(id),
    queryFn: async () => {
      const response = await apiClient.getAdminPaymasterDetail(id);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useVerifyPaymaster() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { paymasterId: string; applicationId?: string }) => {
      const response = await apiClient.verifyAdminPaymaster(params.paymasterId, {
        applicationId: params.applicationId,
      });
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymastersKeys.all });
      queryClient.invalidateQueries({ queryKey: applicationsKeys.all });
    },
  });
}
