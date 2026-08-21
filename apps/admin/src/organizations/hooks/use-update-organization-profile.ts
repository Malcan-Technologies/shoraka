import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { PortalType, UpdateAdminOrganizationProfileInput } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useUpdateOrganizationProfile() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      portal,
      id,
      data,
    }: {
      portal: PortalType;
      id: string;
      data: UpdateAdminOrganizationProfileInput;
    }) => {
      const response = await apiClient.updateAdminOrganizationProfile(portal, id, data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "organization-detail"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "organization-logs"] });
    },
  });
}
