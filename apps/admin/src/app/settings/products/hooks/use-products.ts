"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { GetProductsResponse } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface UseProductsParams {
  page: number;
  pageSize: number;
  search?: string;
}

export function useProducts(params: UseProductsParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "products", params],
    queryFn: async (): Promise<GetProductsResponse> => {
      const response = await apiClient.getProducts(params);
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

export function useProduct(id: string | null) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "products", id],
    queryFn: async () => {
      if (!id) throw new Error("No product id");
      const response = await apiClient.getProduct(id);
      if (!response.success) {
        if (response.error.code === "UNAUTHORIZED" || response.error.code === "FORBIDDEN") {
          if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
            const landingUrl = process.env.NODE_ENV === "production" ? (process.env.NEXT_PUBLIC_LANDING_URL || "/") : "/";
            window.location.href = landingUrl;
          }
        }
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: !!id,
    staleTime: 0,
  });
}

export function useInvalidateProducts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async (data: { version?: number; workflow: unknown[] }) => {
      const response = await apiClient.createProduct(data);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { workflow?: unknown[]; completeCreate?: boolean };
    }) => {
      const response = await apiClient.updateProduct(id, data);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.deleteProduct(id);
      if (!response.success) throw new Error(response.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });
}

/** Request presigned upload URL for product image. Same pattern as site-documents: then upload to S3 and call confirmProductImage. */
export function useProductImageUploadUrl() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      productId,
      fileName,
      contentType,
      fileSize,
    }: {
      productId: string;
      fileName: string;
      contentType: string;
      fileSize?: number;
    }) => {
      const response = await apiClient.requestProductImageUploadUrl(productId, {
        fileName,
        contentType,
        fileSize,
      });
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

/** Request presigned upload URL for product document template. Then upload to S3 and call confirmProductTemplate. */
export function useProductTemplateUploadUrl() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      productId,
      categoryKey,
      templateIndex,
      fileName,
      contentType,
      fileSize,
    }: {
      productId: string;
      categoryKey: string;
      templateIndex: number;
      fileName: string;
      contentType: string;
      fileSize?: number;
    }) => {
      const response = await apiClient.requestProductTemplateUploadUrl(productId, {
        categoryKey,
        templateIndex,
        fileName,
        contentType,
        fileSize,
      });
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

