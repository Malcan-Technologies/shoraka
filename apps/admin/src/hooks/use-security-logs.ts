import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { GetSecurityLogsParams, SecurityEventType } from "@cashsouk/types";
import {
  handleAdminApiQueryError,
  shouldRetryAdminApiQuery,
} from "../lib/handle-api-auth-error";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface UseSecurityLogsOptions extends GetSecurityLogsParams {
  allowedEventTypes?: SecurityEventType[];
}

export function useSecurityLogs(params: UseSecurityLogsOptions) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const { allowedEventTypes, ...queryParams } = params;

  const finalParams: GetSecurityLogsParams = {
    ...queryParams,
    eventTypes:
      allowedEventTypes && !queryParams.eventType
        ? allowedEventTypes
        : queryParams.eventTypes,
  };

  return useQuery({
    queryKey: ["admin", "security-logs", finalParams],
    queryFn: async () => {
      const response = await apiClient.getSecurityLogs(finalParams);
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

export function useSecurityLog(id: string) {
  return useQuery({
    queryKey: ["admin", "security-logs", id],
    queryFn: async () => {
      throw new Error("Individual security log endpoint not implemented");
    },
    enabled: false,
  });
}
