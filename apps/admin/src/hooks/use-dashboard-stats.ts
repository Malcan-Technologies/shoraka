import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { DashboardStatsResponse } from "@cashsouk/types";
import {
  handleAdminApiQueryError,
  shouldRetryAdminApiQuery,
} from "../lib/handle-api-auth-error";

export function useDashboardStats() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(undefined, getAccessToken);

  return useQuery<DashboardStatsResponse>({
    queryKey: ["admin", "dashboard", "stats"],
    queryFn: async () => {
      const response = await apiClient.getDashboardStats();
      if (!response.success) {
        handleAdminApiQueryError(response.error);
      }
      return response.data;
    },
    retry: shouldRetryAdminApiQuery,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}
