import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useCorporateEntities(organizationId: string | undefined) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["corporate-entities", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const result = await apiClient.get<{
        directors: Array<Record<string, unknown>>;
        shareholders: Array<Record<string, unknown>>;
        corporateShareholders: Array<Record<string, unknown>>;
      }>(`/v1/organizations/investor/${organizationId}/corporate-entities`);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    enabled: !!organizationId,
  });
}
