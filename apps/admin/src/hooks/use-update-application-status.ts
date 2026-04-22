import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { applicationLogsKeys } from "./use-application-logs";
import { applicationsKeys } from "@/applications/query-keys";
import { invalidateAdminApplicationNavQueries } from "@/lib/admin-application-nav-cache";

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
      invalidateAdminApplicationNavQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: applicationsKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: applicationLogsKeys.list(variables.id) });
    },
  });
}

