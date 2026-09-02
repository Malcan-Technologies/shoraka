import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { AdminInvestmentSettlementConfirmationsPayload } from "@cashsouk/types";
import { notesKeys } from "../query-keys";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function investmentSettlementConfirmationsKey(noteId?: string) {
  return [...notesKeys.detail(noteId), "investment-settlement-confirmations"] as const;
}

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

export function useAdminInvestmentSettlementConfirmations(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  return useQuery({
    queryKey: investmentSettlementConfirmationsKey(noteId),
    enabled: Boolean(noteId),
    refetchInterval: (query) =>
      (query.state.data?.pendingCount ?? 0) > 0 || (query.state.data?.failedCount ?? 0) > 0
        ? 5000
        : false,
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
    mutationFn: async (investorOrganizationId: string) => {
      if (!noteId) throw new Error("Note ID is required");
      await openSignedPdfInNewTab(async () => {
        const res = await apiClient.getAdminInvestmentSettlementConfirmations(noteId);
        if (!res.success) throw new Error(res.error.message);
        const item = res.data.confirmations.find(
          (row) => row.investorOrganizationId === investorOrganizationId
        );
        if (!item?.viewUrl) throw new Error("Settlement confirmation is not available");
        return item.viewUrl;
      });
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
