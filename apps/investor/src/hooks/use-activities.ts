import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken, useOrganization } from "@cashsouk/config";
import type { GetActivitiesParams } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useActivities(params: Omit<GetActivitiesParams, "organizationId" | "portalType">) {
  const { getAccessToken } = useAuthToken();
  const { activeOrganization, portalType } = useOrganization();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["activities", { ...params, organizationId: activeOrganization?.id, portalType }],
    queryFn: async () => {
      const response = await apiClient.getActivities({
        ...params,
        organizationId: activeOrganization?.id,
        portalType: portalType as "investor" | "issuer",
      });
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: !!activeOrganization?.id,
    staleTime: 1000 * 60, // 1 minute
  });
}
