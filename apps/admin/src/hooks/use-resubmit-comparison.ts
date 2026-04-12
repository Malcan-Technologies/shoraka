/**
 * SECTION: Fetch revision snapshots for admin resubmit before/after modal
 * WHY: Dedicated GET wraps two ApplicationRevision rows for a resubmit cycle.
 * INPUT: applicationId, reviewCycle (from APPLICATION_RESUBMITTED log), open flag
 * OUTPUT: TanStack query with previous/next snapshot payload
 * WHERE USED: ResubmitComparisonModal
 */

import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const resubmitComparisonQueryKeys = {
  detail: (applicationId: string, reviewCycle: number) =>
    ["admin", "application-resubmit-comparison", applicationId, reviewCycle] as const,
};

export function useResubmitComparison(
  applicationId: string | null,
  reviewCycle: number | null,
  open: boolean
) {
  const { getAccessToken } = useAuthToken();

  return useQuery({
    queryKey:
      applicationId != null && reviewCycle != null
        ? resubmitComparisonQueryKeys.detail(applicationId, reviewCycle)
        : ["admin", "application-resubmit-comparison", "disabled"],
    queryFn: async () => {
      if (!applicationId || reviewCycle == null) throw new Error("Missing application or cycle");
      console.log("Fetching resubmit comparison", { applicationId, reviewCycle });
      const apiClient = createApiClient(API_URL, getAccessToken);
      const response = await apiClient.getAdminApplicationResubmitComparison(
        applicationId,
        reviewCycle
      );
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: Boolean(open && applicationId && reviewCycle != null && reviewCycle >= 2),
  });
}
