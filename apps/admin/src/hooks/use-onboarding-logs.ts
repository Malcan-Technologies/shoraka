import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { OnboardingEventType, GetOnboardingLogsParams } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface UseOnboardingLogsOptions extends GetOnboardingLogsParams {
  allowedEventTypes?: OnboardingEventType[];
}

export function useOnboardingLogs(params: UseOnboardingLogsOptions) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const { allowedEventTypes, ...queryParams } = params;

  // If allowedEventTypes is provided and no specific eventType filter is set,
  // filter by the allowed event types
  const finalParams: GetOnboardingLogsParams = {
    ...queryParams,
    eventTypes:
      allowedEventTypes && (!queryParams.eventType || queryParams.eventType === ("all" as OnboardingEventType))
        ? allowedEventTypes
        : queryParams.eventTypes,
  };

  return useQuery({
    queryKey: ["admin", "onboarding-logs", finalParams],
    queryFn: async () => {
      const response = await apiClient.getOnboardingLogs(finalParams);
      if (!response.success) {
        // Handle authentication errors
        if (response.error.code === "UNAUTHORIZED" || response.error.code === "FORBIDDEN") {
          // Only redirect in production or if auth is enabled
          // In development with DISABLE_AUTH, just show the error
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
      // Don't retry on auth errors
      if (error instanceof Error && (error.message.includes("UNAUTHORIZED") || error.message.includes("FORBIDDEN"))) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useOnboardingLog(id: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "onboarding-logs", id],
    queryFn: async () => {
      const response = await apiClient.getOnboardingLog(id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data.log;
    },
    enabled: !!id,
  });
}

