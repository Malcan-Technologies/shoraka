import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { contractsKeys } from "@/contracts/query-keys";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useResignContractOffer(contractId: string) {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.resignAdminContractOffer(contractId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: contractsKeys.detail(contractId) });
    },
  });
}
