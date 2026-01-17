import { useMutation } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { RequestProductImageDownloadUrlInput } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Hook to request presigned download URL for product images
 * Use this to get a temporary URL to display images from S3
 */
export function useRequestProductImageDownloadUrl() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async (data: RequestProductImageDownloadUrlInput) => {
      const response = await apiClient.requestProductImageDownloadUrl(data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
  });
}
