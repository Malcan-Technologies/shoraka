import { useInfiniteQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { OnboardingEventType, GetOnboardingLogsParams } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// TNC_ACCEPTED, KYC_APPROVED, and KYB_APPROVED were removed: no production writer emits these
// event_type values (only TNC_APPROVED and ONBOARDING_STATUS_UPDATED{trigger:"KYC_APPROVED"} are
// live); they only ever appeared in dev seed fixtures, never as real onboarding_logs rows.
// COD_REJECTED (corporate onboarding data rejection, cod-handler.ts) is a live onboarding_logs
// writer that was missing here — issuer/investor Activity and the raw admin onboarding export
// already surface it; only this org-detail-scoped query excluded it.
const ONBOARDING_EVENT_TYPES: OnboardingEventType[] = [
  "ONBOARDING_STARTED",
  "ONBOARDING_RESUMED",
  "ONBOARDING_STATUS_UPDATED",
  "ONBOARDING_CANCELLED",
  "ONBOARDING_REJECTED",
  "COD_REJECTED",
  "SOPHISTICATED_STATUS_UPDATED",
  "FINAL_APPROVAL_COMPLETED",
  "FORM_FILLED",
  "ONBOARDING_APPROVED",
  "AML_APPROVED",
  "TNC_APPROVED",
  "SSM_APPROVED",
  "PROFILE_UPDATED",
];

const PAGE_SIZE = 10;

export const ORGANIZATION_ACTIVITY_EVENT_TYPES: OnboardingEventType[] = ONBOARDING_EVENT_TYPES;

export function useOrganizationLogs(organizationId: string | null) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useInfiniteQuery({
    queryKey: ["admin", "organization-logs", organizationId],
    queryFn: async ({ pageParam = 1 }) => {
      if (!organizationId) throw new Error("Organization ID is required");

      const params: GetOnboardingLogsParams = {
        page: pageParam,
        pageSize: PAGE_SIZE,
        organizationId,
        eventTypes: ONBOARDING_EVENT_TYPES,
      };

      const response = await apiClient.getOnboardingLogs(params);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.reduce((sum, page) => sum + page.logs.length, 0);
      if (totalLoaded >= lastPage.pagination.totalCount) return undefined;
      return allPages.length + 1;
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 2,
  });
}
