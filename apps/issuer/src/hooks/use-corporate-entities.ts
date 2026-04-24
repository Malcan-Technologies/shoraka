import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface DirectorKycEntry {
  name: string;
  email: string;
  role: string;
  kycStatus: string;
  kycId?: string;
  lastUpdated: string;
  eodRequestId?: string;
  shareholderEodRequestId?: string;
}

export interface DirectorKycStatus {
  directors: DirectorKycEntry[];
  lastSyncedAt: string;
  corpIndvDirectorCount: number;
  corpIndvShareholderCount: number;
  corpBizShareholderCount: number;
}

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
        directorKycStatus?: DirectorKycStatus | null;
        latestOrganizationCtosCompanyJson?: unknown | null;
        ctosPartySupplements?: { partyKey: string; onboardingJson?: unknown }[] | null;
      }>(`/v1/organizations/issuer/${organizationId}/corporate-entities`);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      const raw = result.data;
      const directorKycStatus = raw.directorKycStatus ?? null;

      return {
        ...raw,
        directorKycStatus,
      };
    },
    enabled: !!organizationId,
  });
}
