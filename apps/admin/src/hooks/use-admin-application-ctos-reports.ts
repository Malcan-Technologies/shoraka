"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const ctosKeys = {
  all: ["admin", "ctos-reports"] as const,
  application: (applicationId: string) => [...ctosKeys.all, applicationId] as const,
};

export function useAdminApplicationCtosReports(applicationId: string | undefined) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ctosKeys.application(applicationId ?? ""),
    queryFn: async () => {
      const response = await apiClient.listAdminApplicationCtosReports(applicationId!);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: Boolean(applicationId),
  });
}

export function useCreateAdminApplicationCtosReport(applicationId: string | undefined) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.createAdminApplicationCtosReport(applicationId!);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      if (applicationId) {
        queryClient.invalidateQueries({ queryKey: ctosKeys.application(applicationId) });
      }
    },
  });
}
