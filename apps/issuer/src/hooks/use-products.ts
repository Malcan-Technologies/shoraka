import { createApiClient, useAuthToken } from "@cashsouk/config";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import type { GetProductsParams, GetProductsResponse } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useProducts(
  params: GetProductsParams & { activeOnly?: boolean },
  queryOptions?: any
) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  const result = useQuery<GetProductsResponse>({
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
    staleTime: 5 * 60 * 1000, // 5 minutes (default)
    ...(queryOptions || {}),
  });

  /** Surface backend errors via toast; do not swallow silently. */
  useEffect(() => {
    if (result.isError && result.error) {
      toast.error(result.error instanceof Error ? result.error.message : "Failed to load products");
    }
  }, [result.isError, result.error]);

  return result;
}

export function useProduct(id: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  const result = useQuery({
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

  /** Surface backend errors via toast; do not swallow silently. */
  useEffect(() => {
    if (result.isError && result.error) {
      toast.error(result.error instanceof Error ? result.error.message : "Failed to load product");
    }
  }, [result.isError, result.error]);

  return result;
}
