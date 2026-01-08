import { createApiClient, useAuthToken } from "@cashsouk/config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GetProductsParams } from "@cashsouk/types";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useProducts(params: GetProductsParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "products"],
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

export function useDeleteProduct() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId }: { productId: string }) => {
      const response = await apiClient.delete(`/v1/admin/products/${productId}`);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      toast.success("Product deleted successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete product", {
        description: error.message,
      });
    },
  });
}
