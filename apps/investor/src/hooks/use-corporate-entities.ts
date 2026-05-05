import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type CorporateEntityDirector = {
  name?: string;
  position?: string;
  shareholdingPercentage?: number;
  idNumber?: string;
  nationality?: string;
  address?: string;
};

export type CorporateEntityShareholder = {
  name?: string;
  shareholdingPercentage?: number;
  idNumber?: string;
  nationality?: string;
  address?: string;
};

export type CorporateEntityBusinessShareholder = {
  businessName?: string;
  shareholdingPercentage?: number;
  registrationNumber?: string;
  country?: string;
  address?: string;
};

export function useCorporateEntities(organizationId: string | undefined) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["corporate-entities", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const result = await apiClient.get<{
        directors: CorporateEntityDirector[];
        shareholders: CorporateEntityShareholder[];
        corporateShareholders: CorporateEntityBusinessShareholder[];
      }>(`/v1/organizations/investor/${organizationId}/corporate-entities`);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    enabled: !!organizationId,
  });
}
