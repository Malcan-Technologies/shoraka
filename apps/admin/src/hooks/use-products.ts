import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  handleAdminApiQueryError,
  shouldRetryAdminApiQuery,
} from "../lib/handle-api-auth-error";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useProducts(params: {
  page: number;
  pageSize: number;
  search?: string;
  active?: boolean;
  includeDeleted?: boolean;
  enabled?: boolean;
}) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const { enabled = true, ...queryParams } = params;

  return useQuery({
    queryKey: ["admin", "products", queryParams],
    queryFn: async () => {
      const response = await apiClient.getProducts(queryParams);
      if (!response.success) {
        handleAdminApiQueryError(response.error);
      }
      return response.data;
    },
    enabled,
    retry: shouldRetryAdminApiQuery,
  });
}
