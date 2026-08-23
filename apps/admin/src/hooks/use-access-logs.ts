import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { GetAccessLogsParams } from "@cashsouk/types";
import {
  handleAdminApiQueryError,
  shouldRetryAdminApiQuery,
} from "../lib/handle-api-auth-error";

export function useAccessLogs(params: GetAccessLogsParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(undefined, getAccessToken);

  return useQuery({
    queryKey: ["admin", "access-logs", params],
    queryFn: async () => {
      const response = await apiClient.getAccessLogs(params);
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

export function useAccessLog(id: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(undefined, getAccessToken);

  return useQuery({
    queryKey: ["admin", "access-logs", id],
    queryFn: async () => {
      const response = await apiClient.getAccessLog(id);
      if (!response.success) {
        handleAdminApiQueryError(response.error);
      }
      return response.data.log;
    },
    enabled: !!id,
  });
}
