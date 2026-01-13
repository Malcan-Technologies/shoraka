import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { GetActivitiesParams } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useActivities(params: GetActivitiesParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["activities", params],
    queryFn: async () => {
      const response = await apiClient.getActivities(params);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 1000 * 60, // 1 minute
  });
}
