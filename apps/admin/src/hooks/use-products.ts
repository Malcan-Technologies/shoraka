import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useProducts(params: { page: number; pageSize: number; search?: string }) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "products", params],
    queryFn: async () => {
      const response = await apiClient.getProducts(params);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
  });
}
