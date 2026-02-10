import { useInfiniteQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { OnboardingEventType, GetOnboardingLogsParams } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const ONBOARDING_EVENT_TYPES: OnboardingEventType[] = [
  "ONBOARDING_STARTED",
  "ONBOARDING_RESUMED",
  "ONBOARDING_STATUS_UPDATED",
  "ONBOARDING_CANCELLED",
  "ONBOARDING_REJECTED",
  "SOPHISTICATED_STATUS_UPDATED",
  "FINAL_APPROVAL_COMPLETED",
  "FORM_FILLED",
  "ONBOARDING_APPROVED",
  "AML_APPROVED",
  "TNC_APPROVED",
  "SSM_APPROVED",
  "TNC_ACCEPTED",
  "KYC_APPROVED",
  "KYB_APPROVED",
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
