import { useAuthToken, createApiClient } from "@cashsouk/config";
import { useQuery } from "@tanstack/react-query";
import type { IssuerDashboardData } from "@/types/issuer-dashboard";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useIssuerDashboard(organizationId: string | undefined) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["issuer-dashboard", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const res = await apiClient.get<IssuerDashboardData>(
        `/v1/issuer/dashboard?organizationId=${encodeURIComponent(organizationId)}`
      );
      if (!res.success) {
        throw new Error(res.error.message || "Failed to load dashboard");
      }
      return res.data;
    },
    enabled: !!organizationId,
  });
}

export function useIssuerDashboardContract(organizationId: string | undefined, contractId: string | undefined) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["issuer-dashboard-contract", organizationId, contractId],
    queryFn: async () => {
      if (!organizationId || !contractId) return null;
      const res = await apiClient.get<{
        contract: IssuerDashboardData["contracts"][0] | null;
        invoices: IssuerDashboardData["invoices"];
      }>(
        `/v1/issuer/dashboard/contracts/${encodeURIComponent(contractId)}?organizationId=${encodeURIComponent(organizationId)}`
      );
      if (!res.success) {
        throw new Error(res.error.message || "Failed to load contract");
      }
      return res.data;
    },
    enabled: !!organizationId && !!contractId,
  });
}
