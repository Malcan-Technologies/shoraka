import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { ApplicationAuditLogDto } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const applicationAuditHistoryKeys = {
  all: ["admin", "application-audit-history"] as const,
  list: (applicationId: string | null) =>
    [...applicationAuditHistoryKeys.all, applicationId] as const,
};

export function useApplicationAuditHistory(applicationId: string | null) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: applicationAuditHistoryKeys.list(applicationId),
    queryFn: async () => {
      if (!applicationId) throw new Error("Application ID is required");
      const response = await apiClient.getApplicationAuditHistory(applicationId);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to load application audit history");
      }
      return response.data as ApplicationAuditLogDto[];
    },
    enabled: Boolean(applicationId),
    staleTime: 1000 * 60,
  });
}
