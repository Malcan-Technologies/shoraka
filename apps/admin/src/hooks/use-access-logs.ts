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
// selectable/query filter.
//
// ROLE_ADDED / ROLE_REMOVED / PROFILE_UPDATED / ONBOARDING_RESET were previously
// missing here, which silently excluded any stored row from the default "All
// events" admin view. They were added back to this allowlist 2026-08-24, but they
// are NOT all equally reachable from the current Admin UI (verified via rg — see
// docs/audit/audit-event-surface-matrix.md §2.1):
//   - PROFILE_UPDATED: LIVE_UI_REACHABLE — AdminService.updateUserProfile, wired to
//     useUpdateUserProfile, called from user-account-profile-panel.tsx (and the
//     organization member edit dialog).
//   - ROLE_ADDED / ROLE_REMOVED: backend writer + route (PATCH /users/:id/roles) +
//     SDK method + useUpdateUserRoles hook all exist, but zero .tsx components call
//     that hook — UNREACHABLE from the current Admin UI. ROLE_ADDED is also not
//     literally "a role was added": AdminService.updateUserRoles emits
//     `adminRoleRemoved ? "ROLE_REMOVED" : "ROLE_ADDED"`, so ROLE_ADDED is the
//     fallback for every outcome that isn't specifically the ADMIN role being
//     stripped (including a call that only removed INVESTOR/ISSUER).
//   - ONBOARDING_RESET: AdminService.resetOnboarding has a route
//     (POST /users/:id/reset-onboarding, documented in its own Swagger comment as
//     "temporary feature for testing") but no SDK method, no hook, and no UI
//     caller — route-only, UNREACHABLE from the UI.
// They stay in this allowlist anyway: it gates which stored rows the query can
// return, not which buttons exist, so removing them would silently hide any row
// created by direct API/script usage.
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
