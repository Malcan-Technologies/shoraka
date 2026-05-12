import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { GetAdminInvestmentsParams } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function useInvestmentsApiClient() {
  const { getAccessToken } = useAuthToken();
  return createApiClient(API_URL, getAccessToken);
}

export const adminInvestmentsKeys = {
  all: ["admin-investments"] as const,
  list: (params: GetAdminInvestmentsParams) => [...adminInvestmentsKeys.all, "list", params] as const,
};

export function useAdminInvestments(params: GetAdminInvestmentsParams) {
  const apiClient = useInvestmentsApiClient();
  return useQuery({
    queryKey: adminInvestmentsKeys.list(params),
    queryFn: async () => {
      const response = await apiClient.getAdminInvestments(params);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}
