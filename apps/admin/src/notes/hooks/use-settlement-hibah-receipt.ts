import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { SettlementHibahReceiptPdfPayload } from "@cashsouk/types";
import { notesKeys } from "../query-keys";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function settlementHibahReceiptKey(noteId?: string) {
  return [...notesKeys.detail(noteId), "settlement-hibah-receipt"] as const;
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

export function useAdminSettlementHibahReceipt(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  return useQuery({
    queryKey: settlementHibahReceiptKey(noteId),
    enabled: Boolean(noteId),
    refetchInterval: (query) =>
      query.state.data?.status === "PENDING" || query.state.data?.reviewVersion?.status === "PENDING"
        ? 5000
        : false,
    queryFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const response = await apiClient.getAdminSettlementHibahReceipt(noteId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useOpenAdminSettlementHibahReceipt(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  return useMutation({
    mutationFn: async (target: "current" | "review" = "current") => {
      if (!noteId) throw new Error("Note ID is required");
      await openSignedPdfInNewTab(async () => {
        const res = await apiClient.getAdminSettlementHibahReceipt(noteId);
        if (!res.success) throw new Error(res.error.message);
        const url =
          target === "review" ? res.data.reviewVersion?.viewUrl : res.data.viewUrl;
        if (!url) throw new Error("Settlement & Hibah Receipt is not available");
        return url;
      }, "Pop-up blocked. Allow pop-ups for this site to view the receipt PDF.");
    },
  });
}

export function useDownloadAdminSettlementHibahReceipt(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  return useMutation({
    mutationFn: async (target: "current" | "review" = "current") => {
      if (!noteId) throw new Error("Note ID is required");
      await openSignedPdfInNewTab(async () => {
        const res = await apiClient.getAdminSettlementHibahReceipt(noteId);
        if (!res.success) throw new Error(res.error.message);
        const url =
          target === "review" ? res.data.reviewVersion?.downloadUrl : res.data.downloadUrl;
        if (!url) throw new Error("Settlement & Hibah Receipt is not available");
        return url;
      }, "Pop-up blocked. Allow pop-ups for this site to download the receipt PDF.");
    },
  });
}

export function useGenerateAdminSettlementHibahReceipt(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const res = await apiClient.generateAdminSettlementHibahReceipt(noteId);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data: SettlementHibahReceiptPdfPayload) => {
      qc.setQueryData(settlementHibahReceiptKey(noteId), data);
    },
  });
}

export function useRetryAdminSettlementHibahReceipt(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const res = await apiClient.retryAdminSettlementHibahReceipt(noteId);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data: SettlementHibahReceiptPdfPayload) => {
      qc.setQueryData(settlementHibahReceiptKey(noteId), data);
    },
  });
}

export function useReissueAdminSettlementHibahReceipt(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const res = await apiClient.reissueAdminSettlementHibahReceipt(noteId);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data: SettlementHibahReceiptPdfPayload) => {
      qc.setQueryData(settlementHibahReceiptKey(noteId), data);
    },
  });
}

export function usePublishAdminSettlementHibahReceipt(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const res = await apiClient.publishAdminSettlementHibahReceipt(noteId);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data: SettlementHibahReceiptPdfPayload) => {
      qc.setQueryData(settlementHibahReceiptKey(noteId), data);
    },
  });
}
