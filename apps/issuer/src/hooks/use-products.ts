import { createApiClient, useAuthToken } from "@cashsouk/config";
import { useQuery } from "@tanstack/react-query";
import type { GetProductsParams } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useProducts(params: GetProductsParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["products", params.page, params.pageSize, params.search],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      queryParams.append("page", params.page.toString());
      queryParams.append("pageSize", params.pageSize.toString());
      if (params.search) {
        queryParams.append("search", params.search);
      }
      const response = await apiClient.get(`/v1/products?${queryParams.toString()}`);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 60 * 1000, // 1 minute
    // staleTime: 0, // Data is immediately stale, always refetch
    // gcTime: 0, // Don't cache data (formerly cacheTime)
    refetchOnMount: true,
  });
}
