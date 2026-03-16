import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, getReviewRefreshPolicy, useAuthToken } from "@cashsouk/config";
import { applicationsKeys } from "@/applications/query-keys";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useApplicationDetail(id: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const refreshPolicy = getReviewRefreshPolicy();

  return useQuery({
    queryKey: applicationsKeys.detail(id),
    queryFn: async () => {
      const response = await apiClient.getAdminApplicationDetail(id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: !!id,
    ...refreshPolicy,
    refetchOnMount: true,
  });
}

export function useInvalidateApplicationDetail(id: string) {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: applicationsKeys.detail(id) });
  };
}
