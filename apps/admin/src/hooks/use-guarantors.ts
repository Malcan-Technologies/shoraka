import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { GetGuarantorsParams } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useGuarantors(params: GetGuarantorsParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "guarantors", params],
    queryFn: async () => {
      const response = await apiClient.getGuarantors(params);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useInvalidateGuarantors() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "guarantors"] });
  };
}
