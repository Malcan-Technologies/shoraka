import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { OrganizationDetailResponse, PortalType } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useOrganizationDetail(
  portal: PortalType | null,
  id: string | null
) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery<OrganizationDetailResponse>({
    queryKey: ["admin", "organization-detail", portal, id],
    queryFn: async () => {
      if (!portal || !id) {
        throw new Error("Portal and ID are required");
      }
      const response = await apiClient.getOrganizationDetail(portal, id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: !!portal && !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useUpdateSophisticatedStatus() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      isSophisticatedInvestor,
    }: {
      organizationId: string;
      isSophisticatedInvestor: boolean;
    }) => {
      const response = await apiClient.updateSophisticatedStatus(
        organizationId,
        isSophisticatedInvestor
      );
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate organization queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["admin", "organization-detail"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
    },
  });
}

