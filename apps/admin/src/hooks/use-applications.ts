import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { GetAdminApplicationsParams } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useApplications(params: GetAdminApplicationsParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "applications", params.productId, params],
    queryFn: async () => {
      const response = await apiClient.getAdminApplications(params);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useInvalidateApplications() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
  };
}
