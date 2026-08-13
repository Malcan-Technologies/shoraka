import { useInfiniteQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { OnboardingEventType, GetOnboardingLogsParams } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const ONBOARDING_EVENT_TYPES: OnboardingEventType[] = [
  "ONBOARDING_STARTED",
  "ONBOARDING_RESUMED",
  "ONBOARDING_RESTARTED",
  "ONBOARDING_RESET",
  "USER_ONBOARDING_STATUS_UPDATED",
  "ONBOARDING_STATUS_CHANGED",
  "ONBOARDING_APPROVED",
  "ONBOARDING_REJECTED",
  "ONBOARDING_FINAL_APPROVAL_COMPLETED",
  "ONBOARDING_COMPLETED",
  "AML_APPROVED",
  "SSM_APPROVED",
  "INVESTOR_SOPHISTICATED_STATUS_UPDATED",
  "CTOS_REPORT_RECEIVED",
  "CORPORATE_ENTITIES_UPDATED",
  "DIRECTOR_ONBOARDING_INVITATION_SENT",
  "DIRECTOR_KYC_STATUS_UPDATED",
];

const PAGE_SIZE = 10;

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
