import { useMutation } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type {
  RequestProductImageDownloadUrlInput,
  RequestProductImageUploadUrlInput,
} from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Hook to request presigned upload URL for product images
 * Use this to get a temporary URL to upload images to S3
 */
export function useRequestProductImageUploadUrl() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async (data: RequestProductImageUploadUrlInput) => {
      const response = await apiClient.requestProductImageUploadUrl(data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
  });
}

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

/**
 * Upload a file to S3 using a presigned URL
 */
export async function uploadImageToS3(
  uploadUrl: string,
  file: File
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type,
    },
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }
}
