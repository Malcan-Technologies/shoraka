import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { GetProductLogsParams, ProductEventType, ProductLogsResponse } from "@cashsouk/types";
import {
  handleAdminApiQueryError,
  shouldRetryAdminApiQuery,
} from "../lib/handle-api-auth-error";

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
        handleAdminApiQueryError(response.error);
      }
      return response.data;
    },
    staleTime: 0,
    refetchOnMount: true,
    retry: shouldRetryAdminApiQuery,
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
