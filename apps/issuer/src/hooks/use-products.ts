import { createApiClient, useAuthToken } from "@cashsouk/config";
import { useQuery } from "@tanstack/react-query";
import type { GetProductsParams } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useProducts(params: GetProductsParams & { activeOnly?: boolean }) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["products", params.page, params.pageSize, params.search, params.activeOnly],
    queryFn: async () => {
      const response = await apiClient.getProducts({
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        active: params.activeOnly,
      });
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useProduct(id: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiClient.getProduct(id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: !!id,
  });
}
