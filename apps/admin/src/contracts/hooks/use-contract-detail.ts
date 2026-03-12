import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { contractsKeys } from "@/contracts/query-keys";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useContractDetail(contractId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: contractId ? contractsKeys.detail(contractId) : [...contractsKeys.all, "detail", "pending"],
    queryFn: async () => {
      if (!contractId) {
        throw new Error("Contract ID is required");
      }
      const response = await apiClient.getAdminContractDetail(contractId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: Boolean(contractId),
    staleTime: 0,
    refetchOnMount: true,
  });
}
