import { useInfiniteQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { GetActivitiesParams } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PAGE_SIZE = 10;

export function useApplicationActivities(organizationId: string | null) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useInfiniteQuery({
    queryKey: ["admin", "application-activities", organizationId],
    queryFn: async ({ pageParam = 1 }) => {
      if (!organizationId) throw new Error("Organization ID is required");

      const params: GetActivitiesParams = {
        page: pageParam,
        limit: PAGE_SIZE,
        organizationId,
      };

      const response = await apiClient.getActivities(params);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.reduce((sum, page) => sum + page.activities.length, 0);
      if (totalLoaded >= lastPage.pagination.total) return undefined;
      return allPages.length + 1;
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 2,
  });
}

