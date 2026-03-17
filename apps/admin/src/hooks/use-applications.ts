import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, getReviewRefreshPolicy, useAuthToken } from "@cashsouk/config";
import type { GetAdminApplicationsParams } from "@cashsouk/types";
import { applicationsKeys } from "@/applications/query-keys";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useApplications(params: GetAdminApplicationsParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const refreshPolicy = getReviewRefreshPolicy();

  return useQuery({
    queryKey: applicationsKeys.list(params),
    queryFn: async () => {
      const response = await apiClient.getAdminApplications(params);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    ...refreshPolicy,
    refetchOnMount: true,
  });
}

export function useInvalidateApplications() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: applicationsKeys.all });
  };
}
