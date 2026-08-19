import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { InvestorBalanceActivityResponse } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const ACTIVITY_FETCH_PAGE_SIZE = 100;

export function useOrganizationWalletActivity(
  organizationId: string | null,
  options?: { enabled?: boolean }
) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const allowFetch = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<InvestorBalanceActivityResponse>({
    queryKey: ["admin", "organization-wallet-activity", organizationId],
    enabled: allowFetch,
    queryFn: async () => {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }
      const first = await apiClient.getAdminInvestorBalanceActivity(organizationId, {
        page: 1,
        pageSize: ACTIVITY_FETCH_PAGE_SIZE,
      });
      if (!first.success) throw new Error(first.error.message);

      const allEntries = [...first.data.entries];
      const { totalPages } = first.data.pagination;
      if (totalPages > 1) {
        const remainingPages = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) =>
            apiClient.getAdminInvestorBalanceActivity(organizationId, {
              page: index + 2,
              pageSize: ACTIVITY_FETCH_PAGE_SIZE,
            })
          )
        );
        for (const response of remainingPages) {
          if (!response.success) throw new Error(response.error.message);
          allEntries.push(...response.data.entries);
        }
      }

      return { ...first.data, entries: allEntries };
    },
  });
}
