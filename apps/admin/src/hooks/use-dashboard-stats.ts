import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@cashsouk/config";
import type { DashboardStatsResponse } from "@cashsouk/types";

const apiClient = createApiClient();

export function useDashboardStats() {
  return useQuery<DashboardStatsResponse>({
    queryKey: ["admin", "dashboard", "stats"],
    queryFn: async () => {
      const response = await apiClient.getDashboardStats();
      if (!response.success) {
        if (response.error.code === "UNAUTHORIZED" || response.error.code === "FORBIDDEN") {
          if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
            const landingUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";
            window.location.href = landingUrl;
          }
        }
        throw new Error(response.error.message);
      }
      return response.data;
    },
    retry: (failureCount, error) => {
      if (error instanceof Error && (error.message.includes("UNAUTHORIZED") || error.message.includes("FORBIDDEN"))) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
}

