import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { GetProductLogsParams, ProductEventType, ProductLogsResponse } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface UseProductLogsOptions extends GetProductLogsParams {
  allowedEventTypes?: ProductEventType[];
}

export function useProductLogs(params: UseProductLogsOptions) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery<ProductLogsResponse>({
    queryKey: ["admin", "product-logs", params],
    queryFn: async () => {
      const response = await apiClient.getProductLogs(params);
      if (!response.success) {
        if (response.error.code === "UNAUTHORIZED" || response.error.code === "FORBIDDEN") {
          if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
            const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000";
            window.location.href = landingUrl;
          }
        }
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 0,
    refetchOnMount: true,
    retry: (failureCount, error) => {
      if (error instanceof Error && (error.message.includes("UNAUTHORIZED") || error.message.includes("FORBIDDEN"))) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useExportProductLogs() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return async (params: {
    search?: string;
    eventType?: ProductEventType;
    eventTypes?: ProductEventType[];
    dateRange?: "24h" | "7d" | "30d" | "all";
    format?: "csv" | "json";
  }) => {
    return apiClient.exportProductLogs(params);
  };
}
