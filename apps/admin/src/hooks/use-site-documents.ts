import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type {
  GetSiteDocumentsParams,
  RequestUploadUrlInput,
  CreateSiteDocumentInput,
  UpdateSiteDocumentInput,
  RequestReplaceUrlInput,
  ConfirmReplaceInput,
} from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useSiteDocuments(params: GetSiteDocumentsParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "site-documents", params],
    queryFn: async () => {
      const response = await apiClient.getSiteDocuments(params);
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

export function useSiteDocument(id: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "site-documents", id],
    queryFn: async () => {
      const response = await apiClient.getSiteDocument(id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data.document;
    },
    enabled: !!id,
  });
}

export function useRequestUploadUrl() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async (data: RequestUploadUrlInput) => {
      const response = await apiClient.requestSiteDocumentUploadUrl(data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
  });
}

export function useCreateSiteDocument() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSiteDocumentInput) => {
      const response = await apiClient.createSiteDocument(data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data.document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "site-documents"] });
    },
  });
}

export function useUpdateSiteDocument() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSiteDocumentInput }) => {
      const response = await apiClient.updateSiteDocument(id, data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data.document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "site-documents"] });
    },
  });
}

export function useRequestReplaceUrl() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RequestReplaceUrlInput }) => {
      const response = await apiClient.requestSiteDocumentReplaceUrl(id, data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
  });
}

export function useConfirmReplace() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ConfirmReplaceInput }) => {
      const response = await apiClient.confirmSiteDocumentReplace(id, data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data.document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "site-documents"] });
    },
  });
}

export function useArchiveSiteDocument() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.deleteSiteDocument(id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "site-documents"] });
    },
  });
}

// Alias for backwards compatibility
export const useDeleteSiteDocument = useArchiveSiteDocument;

export function useRestoreSiteDocument() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.restoreSiteDocument(id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data.document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "site-documents"] });
    },
  });
}

export function useDownloadSiteDocument() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.getAdminDocumentDownloadUrl(id);
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
export async function uploadFileToS3(
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

