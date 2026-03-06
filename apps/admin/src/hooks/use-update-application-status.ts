import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { applicationLogsKeys } from "./use-application-logs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useUpdateApplicationStatus() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiClient.updateAdminApplicationStatus(id, status);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.id] });
      queryClient.invalidateQueries({ queryKey: applicationLogsKeys.list(variables.id) });
    },
  });
}

export function useReopenApplicationForCorrection() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiClient.reopenAdminApplicationForCorrection(id, reason);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.id] });
      queryClient.invalidateQueries({ queryKey: applicationLogsKeys.list(variables.id) });
    },
  });
}
