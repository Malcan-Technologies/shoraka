import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { applicationsKeys } from "@/applications/query-keys";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useApplicationNavCounts({ enabled = true }: { enabled?: boolean } = {}) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: applicationsKeys.navCounts,
    queryFn: async () => {
      const response = await apiClient.getAdminApplicationNavCounts();
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 30000,
    refetchInterval: 60000,
    enabled,
  });
}
