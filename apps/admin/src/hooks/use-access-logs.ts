import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { EventType, GetAccessLogsParams } from "@cashsouk/types";
import {
  handleAdminApiQueryError,
  shouldRetryAdminApiQuery,
} from "../lib/handle-api-auth-error";

// KYC_STATUS_UPDATED intentionally excluded: no production writer emits it as an
// access_logs event_type (see docs/audit/audit-event-catalog.md) — kept in the
// EventType union and label maps only for historical row rendering, never as a
// selectable/query filter. ROLE_ADDED/ROLE_REMOVED/PROFILE_UPDATED/ONBOARDING_RESET
// are live access_logs writers (admin/service.ts) that were previously missing here,
// which silently excluded them from the default "All events" admin view.
export const ACCESS_EVENT_TYPES: EventType[] = [
  "LOGIN",
  "LOGOUT",
  "SIGNUP",
  "ROLE_ADDED",
  "ROLE_REMOVED",
  "PROFILE_UPDATED",
  "ONBOARDING_RESET",
];

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
