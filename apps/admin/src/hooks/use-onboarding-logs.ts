import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { OnboardingEventType, GetOnboardingLogsParams } from "@cashsouk/types";
import {
  handleAdminApiQueryError,
  shouldRetryAdminApiQuery,
} from "../lib/handle-api-auth-error";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface UseOnboardingLogsOptions extends GetOnboardingLogsParams {
  allowedEventTypes?: OnboardingEventType[];
}

export function useOnboardingLogs(params: UseOnboardingLogsOptions) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const { allowedEventTypes, ...queryParams } = params;

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
        handleAdminApiQueryError(response.error);
      }
      return response.data;
    },
    staleTime: 0,
    refetchOnMount: true,
    retry: shouldRetryAdminApiQuery,
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
        handleAdminApiQueryError(response.error);
      }
      return response.data.log;
    },
    enabled: !!id,
  });
}
