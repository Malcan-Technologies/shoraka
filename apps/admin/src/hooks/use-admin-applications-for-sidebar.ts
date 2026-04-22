import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { ApplicationListItem } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export function useAdminApplicationsForSidebar() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "applications", "sidebar-all"] as const,
    queryFn: async (): Promise<ApplicationListItem[]> => {
      const all: ApplicationListItem[] = [];
      let page = 1;
      for (let i = 0; i < MAX_PAGES; i += 1) {
        const res = await apiClient.getAdminApplications({ page, pageSize: PAGE_SIZE });
        if (!res.success) {
          throw new Error(res.error.message);
        }
        const { applications, pagination } = res.data;
        all.push(...applications);
        if (all.length >= pagination.totalCount || applications.length === 0) {
          break;
        }
        page += 1;
      }
      return all;
    },
    staleTime: 60_000,
  });
}
