import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { SiteDocumentResponse } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useAccountDocuments() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["account-documents"],
    queryFn: async () => {
      const response = await apiClient.getAccountDocuments();
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data.documents;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useDocumentDownloadUrl(id: string | null, enabled = false) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["document-download", id],
    queryFn: async () => {
      if (!id) throw new Error("Document ID required");
      const response = await apiClient.getDocumentDownloadUrl(id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: !!id && enabled,
    staleTime: 1000 * 60 * 30, // 30 minutes (URL expires in 1 hour)
  });
}

export type { SiteDocumentResponse };

