import { useMutation } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface RequestApplicationDocumentUploadUrlInput {
  fileName: string;
  contentType: string;
  fileSize: number;
}

export interface ApplicationDocumentUploadUrlResponse {
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}

/**
 * Hook to request presigned upload URL for application documents
 * Use this to get a temporary URL to upload files to S3
 */
export function useRequestApplicationDocumentUploadUrl() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      input,
    }: {
      applicationId: string;
      input: RequestApplicationDocumentUploadUrlInput;
    }) => {
      const response = await apiClient.post<ApplicationDocumentUploadUrlResponse>(
        `/v1/applications/${applicationId}/upload-document-url`,
        input
      );
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
  });
}
