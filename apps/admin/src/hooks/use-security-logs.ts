import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { GetSecurityLogsParams, SecurityEventType } from "@cashsouk/types";
import {
  handleAdminApiQueryError,
  shouldRetryAdminApiQuery,
} from "../lib/handle-api-auth-error";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ROLE_REMOVED here is the admin-role CATALOGUE deletion event (RoleRepository/admin RBAC
// config), distinct from access_logs.ROLE_REMOVED (a user's portal role being removed) —
// same string, two unrelated tables/types; do not merge or rename either.
// ROLE_CREATED / ROLE_PERMISSIONS_UPDATED / INVITATION_REVOKED are live security_logs
// writers (admin/service.ts) that were previously missing here, which silently excluded
// them from the default "All events" admin view.
export const SECURITY_EVENT_TYPES: SecurityEventType[] = [
  "PASSWORD_CHANGED",
  "EMAIL_CHANGED",
  "ROLE_ADDED",
  "ROLE_REMOVED",
  "ROLE_SWITCHED",
  "ROLE_CREATED",
  "ROLE_PERMISSIONS_UPDATED",
  "INVITATION_REVOKED",
  "PROFILE_UPDATED",
  "PLATFORM_FINANCE_SETTINGS_UPDATED",
];

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
