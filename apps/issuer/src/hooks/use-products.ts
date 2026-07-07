import { createApiClient, useAuthToken } from "@cashsouk/config";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import type { GetProductsParams, GetProductsResponse } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Issuer portal: active products catalog (no admin role required). */
export function useIssuerProducts(
  params: GetProductsParams,
  queryOptions?: { staleTime?: number; refetchOnMount?: boolean }
) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  const result = useQuery<GetProductsResponse>({
    queryKey: ["issuer-products", params.page, params.pageSize, params.search],
    queryFn: async () => {
      const response = await apiClient.getIssuerProducts({
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
      });
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: queryOptions?.staleTime ?? 5 * 60 * 1000,
    refetchOnMount: queryOptions?.refetchOnMount ?? true,
  });

  useEffect(() => {
    if (result.isError && result.error) {
      toast.error(result.error instanceof Error ? result.error.message : "Failed to load products");
    }
  }, [result.isError, result.error]);

  return result;
}

export function useIssuerProduct(id: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  const result = useQuery({
    queryKey: ["issuer-product", id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiClient.getIssuerProduct(id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (result.isError && result.error) {
      toast.error(result.error instanceof Error ? result.error.message : "Failed to load product");
    }
  }, [result.isError, result.error]);

  return result;
}
