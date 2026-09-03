import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { AdminInvestmentSettlementConfirmationsPayload } from "@cashsouk/types";
import { notesKeys } from "../query-keys";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function investmentSettlementConfirmationsKey(noteId?: string) {
  return [...notesKeys.detail(noteId), "investment-settlement-confirmations"] as const;
}

type ConfirmationPdfTarget = {
  investorOrganizationId: string;
  target?: "current" | "review";
};

async function openSignedPdfInNewTab(loadUrl: () => Promise<string>) {
  const tab = window.open("about:blank", "_blank");
  if (!tab) {
    throw new Error("Pop-up blocked. Allow pop-ups for this site to view the confirmation PDF.");
  }
  tab.opener = null;
  try {
    tab.location.href = await loadUrl();
  } catch (error) {
    tab.close();
    throw error;
  }
}

function resolveConfirmationTarget(
  input: string | ConfirmationPdfTarget
): ConfirmationPdfTarget {
  return typeof input === "string" ? { investorOrganizationId: input, target: "current" } : input;
}

export function useAdminInvestmentSettlementConfirmations(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  return useQuery({
    queryKey: investmentSettlementConfirmationsKey(noteId),
    enabled: Boolean(noteId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      if (data.pendingCount > 0) return 5000;
      if (data.confirmations.some((row) => row.reviewVersion?.status === "PENDING")) return 5000;
      return false;
    },
    queryFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const response = await apiClient.getAdminInvestmentSettlementConfirmations(noteId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useOpenAdminInvestmentSettlementConfirmation(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  return useMutation({
    mutationFn: async (input: string | ConfirmationPdfTarget) => {
      if (!noteId) throw new Error("Note ID is required");
      const { investorOrganizationId, target = "current" } = resolveConfirmationTarget(input);
      await openSignedPdfInNewTab(async () => {
        const res = await apiClient.getAdminInvestmentSettlementConfirmations(noteId);
        if (!res.success) throw new Error(res.error.message);
        const item = res.data.confirmations.find(
          (row) => row.investorOrganizationId === investorOrganizationId
        );
        const url = target === "review" ? item?.reviewVersion?.viewUrl : item?.viewUrl;
        if (!url) throw new Error("Settlement confirmation is not available");
        return url;
      });
    },
  });
}

export function useDownloadAdminInvestmentSettlementConfirmation(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  return useMutation({
    mutationFn: async (input: string | ConfirmationPdfTarget) => {
      if (!noteId) throw new Error("Note ID is required");
      const { investorOrganizationId, target = "current" } = resolveConfirmationTarget(input);
      await openSignedPdfInNewTab(async () => {
        const res = await apiClient.getAdminInvestmentSettlementConfirmations(noteId);
        if (!res.success) throw new Error(res.error.message);
        const item = res.data.confirmations.find(
          (row) => row.investorOrganizationId === investorOrganizationId
        );
        const url = target === "review" ? item?.reviewVersion?.downloadUrl : item?.downloadUrl;
        if (!url) throw new Error("Settlement confirmation is not available");
        return url;
      });
    },
  });
}

export function useGenerateAdminInvestmentSettlementConfirmation(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (investorOrganizationId: string) => {
      if (!noteId) throw new Error("Note ID is required");
      const res = await apiClient.generateAdminInvestmentSettlementConfirmation(
        noteId,
        investorOrganizationId
      );
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data: AdminInvestmentSettlementConfirmationsPayload) => {
      qc.setQueryData(investmentSettlementConfirmationsKey(noteId), data);
    },
  });
}

export function useGenerateAllAdminInvestmentSettlementConfirmations(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const res = await apiClient.generateAllAdminInvestmentSettlementConfirmations(noteId);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data: AdminInvestmentSettlementConfirmationsPayload) => {
      qc.setQueryData(investmentSettlementConfirmationsKey(noteId), data);
    },
  });
}

export function useRetryAdminInvestmentSettlementConfirmation(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (investorOrganizationId: string) => {
      if (!noteId) throw new Error("Note ID is required");
      const res = await apiClient.retryAdminInvestmentSettlementConfirmation(
        noteId,
        investorOrganizationId
      );
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data: AdminInvestmentSettlementConfirmationsPayload) => {
      qc.setQueryData(investmentSettlementConfirmationsKey(noteId), data);
    },
  });
}

export function useReissueAdminInvestmentSettlementConfirmation(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (investorOrganizationId: string) => {
      if (!noteId) throw new Error("Note ID is required");
      const res = await apiClient.reissueAdminInvestmentSettlementConfirmation(
        noteId,
        investorOrganizationId
      );
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data: AdminInvestmentSettlementConfirmationsPayload) => {
      qc.setQueryData(investmentSettlementConfirmationsKey(noteId), data);
    },
  });
}

export function usePublishAdminInvestmentSettlementConfirmation(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (investorOrganizationId: string) => {
      if (!noteId) throw new Error("Note ID is required");
      const res = await apiClient.publishAdminInvestmentSettlementConfirmation(
        noteId,
        investorOrganizationId
      );
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data: AdminInvestmentSettlementConfirmationsPayload) => {
      qc.setQueryData(investmentSettlementConfirmationsKey(noteId), data);
    },
  });
}
