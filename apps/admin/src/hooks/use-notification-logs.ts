import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  handleAdminApiQueryError,
  shouldRetryAdminApiQuery,
} from "../lib/handle-api-auth-error";

export type NotificationLogsParams = {
  limit: number;
  offset: number;
  search?: string;
  type?: string;
  target?: string;
};

export function useNotificationLogs(params: NotificationLogsParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(undefined, getAccessToken);

  return useQuery({
    queryKey: ["admin", "notification-logs", params],
    queryFn: async () => {
      const response = await apiClient.getAdminNotificationLogs(params);
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
