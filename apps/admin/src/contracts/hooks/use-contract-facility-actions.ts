import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { contractsKeys } from "@/contracts/query-keys";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function useContractApiClient() {
  const { getAccessToken } = useAuthToken();
  return createApiClient(API_URL, getAccessToken);
}

function invalidateContract(queryClient: ReturnType<typeof useQueryClient>, contractId: string) {
  queryClient.invalidateQueries({ queryKey: contractsKeys.detail(contractId) });
  queryClient.invalidateQueries({ queryKey: contractsKeys.all });
}

export function useWaiveContractFacilityFee() {
  const apiClient = useContractApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiClient.waiveAdminContractFacilityFee(id, reason);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (detail) => {
      invalidateContract(queryClient, detail.id);
    },
  });
}

export function useSetContractFacilityEnabled() {
  const apiClient = useContractApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      enabled,
      reason,
    }: {
      id: string;
      enabled: boolean;
      reason?: string;
    }) => {
      const response = await apiClient.setAdminContractFacilityEnabled(id, enabled, reason);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (detail) => {
      invalidateContract(queryClient, detail.id);
    },
  });
}
