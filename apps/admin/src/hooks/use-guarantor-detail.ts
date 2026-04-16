import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { GuarantorDetailResponse } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useGuarantorDetail(id: string | null) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery<GuarantorDetailResponse>({
    queryKey: ["admin", "guarantor-detail", id],
    queryFn: async () => {
      if (!id) throw new Error("Guarantor ID is required");
      const response = await apiClient.getGuarantorDetail(id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  });
}

export function useRestartGuarantorOnboarding() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ guarantorId }: { guarantorId: string }) => {
      const response = await apiClient.restartGuarantorOnboarding(guarantorId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "guarantor-detail", variables.guarantorId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "guarantors"] });
    },
  });
}
