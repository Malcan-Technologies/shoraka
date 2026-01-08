import { createApiClient, useAuthToken } from "@cashsouk/config";
import { GetProductsParams } from "@cashsouk/types";
import { useQuery } from "@tanstack/react-query";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useProducts(params: GetProductsParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      queryParams.append("page", params.page.toString());
      queryParams.append("pageSize", params.pageSize.toString());
      if (params.search) {
        queryParams.append("search", params.search);
      }
      const response = await apiClient.get(`/v1/admin/products?${queryParams.toString()}`);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}