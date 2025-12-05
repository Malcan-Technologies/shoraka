import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@cashsouk/config";
import type { EventType, GetAccessLogsParams } from "@cashsouk/types";

const apiClient = createApiClient();

export interface UseAccessLogsOptions extends GetAccessLogsParams {
  allowedEventTypes?: EventType[];
}

export function useAccessLogs(params: UseAccessLogsOptions) {
  const { allowedEventTypes, ...queryParams } = params;

  // If allowedEventTypes is provided and no specific eventType filter is set,
  // filter by the allowed event types
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
        // Handle authentication errors
        if (response.error.code === "UNAUTHORIZED" || response.error.code === "FORBIDDEN") {
          // Only redirect in production or if auth is enabled
          // In development with DISABLE_AUTH, just show the error
          if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
            const landingUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";
            window.location.href = landingUrl;
          }
        }
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 0,
    refetchOnMount: true,
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error instanceof Error && (error.message.includes("UNAUTHORIZED") || error.message.includes("FORBIDDEN"))) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useAccessLog(id: string) {
  return useQuery({
    queryKey: ["admin", "access-logs", id],
    queryFn: async () => {
      const response = await apiClient.getAccessLog(id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data.log;
    },
    enabled: !!id,
  });
}

