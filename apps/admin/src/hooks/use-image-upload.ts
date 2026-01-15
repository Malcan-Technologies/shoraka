import { useMutation, useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { uploadFileToS3 } from "./use-site-documents";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useImageUpload() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({ file, financingTypeName }: { file: File; financingTypeName: string }): Promise<string> => {
      const uploadUrlResponse = await apiClient.post("/v1/products/images/upload-url", {
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        financingTypeName,
      });

      if (!uploadUrlResponse.success) {
        throw new Error(uploadUrlResponse.error.message || "Failed to request upload URL");
      }

      const { uploadUrl, s3Key } = uploadUrlResponse.data as { uploadUrl: string; s3Key: string };
      await uploadFileToS3(uploadUrl, file);

      return s3Key;
    },
  });
}

export function useImageViewUrl(s3Key: string | null | undefined) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["image-view-url", s3Key],
    queryFn: async () => {
      if (!s3Key) return null;

      const response = await apiClient.get<{ viewUrl: string }>(`/v1/products/images/view-url?s3Key=${encodeURIComponent(s3Key)}`);
      if (!response.success) {
        throw new Error(response.error.message || "Failed to get image view URL");
      }
      return (response.data as { viewUrl: string }).viewUrl;
    },
    enabled: !!s3Key,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
