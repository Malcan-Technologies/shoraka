import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { GetSecurityLogsParams, SecurityEventType } from "@cashsouk/types";

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
        if (response.error.code === "UNAUTHORIZED" || response.error.code === "FORBIDDEN") {
          if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
            const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000";
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
      if (error instanceof Error && (error.message.includes("UNAUTHORIZED") || error.message.includes("FORBIDDEN"))) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useSecurityLog(id: string) {
  return useQuery({
    queryKey: ["admin", "security-logs", id],
    queryFn: async () => {
      // Note: Individual security log endpoint not implemented yet
      // This is a placeholder for future use
      throw new Error("Individual security log endpoint not implemented");
    },
    enabled: false,
  });
}


