import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { ApplicationAuditLogDto } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const applicationAuditHistoryKeys = {
  all: ["admin", "application-audit-history"] as const,
  list: (applicationId: string | null, page: number, pageSize: number) =>
    [...applicationAuditHistoryKeys.all, applicationId, page, pageSize] as const,
};

export function useApplicationAuditHistory(
  applicationId: string | null,
  page = 1,
  pageSize = 15
) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: applicationAuditHistoryKeys.list(applicationId, page, pageSize),
    queryFn: async () => {
      if (!applicationId) throw new Error("Application ID is required");
      const response = await apiClient.getApplicationAuditHistory(applicationId, {
        page,
        pageSize,
      });
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to load application audit history");
      }
      return response.data as {
        logs: ApplicationAuditLogDto[];
        pagination: { page: number; pageSize: number; totalCount: number; totalPages: number };
      };
    },
    enabled: Boolean(applicationId),
    staleTime: 1000 * 60,
  });
}
