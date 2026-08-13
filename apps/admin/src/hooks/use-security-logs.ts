import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { GetSecurityLogsParams } from "@cashsouk/types";
import {
  handleAdminApiQueryError,
  shouldRetryAdminApiQuery,
} from "../lib/handle-api-auth-error";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useSecurityLogs(params: GetSecurityLogsParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "security-logs", params],
    queryFn: async () => {
      const response = await apiClient.getSecurityLogs(params);
      if (!response.success) {
        handleAdminApiQueryError(response.error);
      }
      return response.data;
    },
    staleTime: 0,
    refetchOnMount: true,
    retry: shouldRetryAdminApiQuery,
  });
}
