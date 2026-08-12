import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { EventType, GetAccessLogsParams } from "@cashsouk/types";
import {
  handleAdminApiQueryError,
  shouldRetryAdminApiQuery,
} from "../lib/handle-api-auth-error";

export interface UseAccessLogsOptions extends GetAccessLogsParams {
  allowedEventTypes?: EventType[];
}

export function useAccessLogs(params: UseAccessLogsOptions) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(undefined, getAccessToken);
  const { allowedEventTypes, ...queryParams } = params;

  const finalParams: GetAccessLogsParams = {
    ...queryParams,
    eventTypes:
      allowedEventTypes && (!queryParams.eventType || queryParams.eventType === ("all" as EventType))
        ? allowedEventTypes
        : queryParams.eventTypes,
  };

  return useQuery({
    queryKey: ["admin", "access-logs", finalParams],
    queryFn: async () => {
      const response = await apiClient.getAccessLogs(finalParams);
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
