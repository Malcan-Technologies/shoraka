import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { InvestmentNoteCertificatePdfPayload } from "@cashsouk/types";
import { notesKeys } from "../query-keys";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function investmentNoteCertificateKey(noteId?: string) {
  return [...notesKeys.detail(noteId), "investment-note-certificate"] as const;
}

async function openSignedPdfInNewTab(loadUrl: () => Promise<string>, blockedMessage: string) {
  const tab = window.open("about:blank", "_blank");
  if (!tab) {
    throw new Error(blockedMessage);
  }
  tab.opener = null;
  try {
    tab.location.href = await loadUrl();
  } catch (error) {
    tab.close();
    throw error;
  }
}

export function useAdminInvestmentNoteCertificate(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  return useQuery({
    queryKey: investmentNoteCertificateKey(noteId),
    enabled: Boolean(noteId),
    queryFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const response = await apiClient.getAdminInvestmentNoteCertificate(noteId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useOpenAdminInvestmentNoteCertificate(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  return useMutation({
    mutationFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      await openSignedPdfInNewTab(async () => {
        const res = await apiClient.getAdminInvestmentNoteCertificate(noteId);
        if (!res.success) throw new Error(res.error.message);
        if (!res.data.viewUrl) throw new Error("Investment Note Certificate is not available");
        return res.data.viewUrl;
      }, "Pop-up blocked. Allow pop-ups for this site to view the certificate PDF.");
    },
  });
}

export function useDownloadAdminInvestmentNoteCertificate(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  return useMutation({
    mutationFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      await openSignedPdfInNewTab(async () => {
        const res = await apiClient.getAdminInvestmentNoteCertificate(noteId);
        if (!res.success) throw new Error(res.error.message);
        if (!res.data.downloadUrl) throw new Error("Investment Note Certificate is not available");
        return res.data.downloadUrl;
      }, "Pop-up blocked. Allow pop-ups for this site to download the certificate PDF.");
    },
  });
}

export function useRetryAdminInvestmentNoteCertificate(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const res = await apiClient.retryAdminInvestmentNoteCertificate(noteId);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data: InvestmentNoteCertificatePdfPayload) => {
      qc.setQueryData(investmentNoteCertificateKey(noteId), data);
    },
  });
}

export function useReissueAdminInvestmentNoteCertificate(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const res = await apiClient.reissueAdminInvestmentNoteCertificate(noteId);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data: InvestmentNoteCertificatePdfPayload) => {
      qc.setQueryData(investmentNoteCertificateKey(noteId), data);
    },
  });
}
