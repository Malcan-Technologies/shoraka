import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { InvestorPortfolioHistoryRange } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const marketplaceKeys = {
  all: ["marketplace-notes"] as const,
  list: (params: { search: string; page: number; pageSize: number; featuredOnly: boolean }) =>
    [...marketplaceKeys.all, "list", params] as const,
  detail: (id?: string) => [...marketplaceKeys.all, "detail", id] as const,
  portfolio: ["investor-portfolio"] as const,
  portfolioHistoryRoot: ["investor-portfolio-history"] as const,
  portfolioHistory: (range: InvestorPortfolioHistoryRange) =>
    [...marketplaceKeys.portfolioHistoryRoot, range] as const,
  investorBalanceActivityRoot: ["investor-balance-activity"] as const,
  investorBalanceActivity: (params: { page: number; pageSize: number }) =>
    [...marketplaceKeys.investorBalanceActivityRoot, params] as const,
  investorInvestments: ["investor-investments"] as const,
};

function useMarketplaceApiClient() {
  const { getAccessToken } = useAuthToken();
  return createApiClient(API_URL, getAccessToken);
}

export function useMarketplaceNotes({
  search = "",
  page = 1,
  pageSize = 24,
  featuredOnly = false,
}: {
  search?: string;
  page?: number;
  pageSize?: number;
  featuredOnly?: boolean;
} = {}) {
  const apiClient = useMarketplaceApiClient();
  return useQuery({
    queryKey: marketplaceKeys.list({ search, page, pageSize, featuredOnly }),
    queryFn: async () => {
      const response = await apiClient.getMarketplaceNotes({ page, pageSize, search, featuredOnly });
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useMarketplaceNote(noteId?: string) {
  const apiClient = useMarketplaceApiClient();
  return useQuery({
    queryKey: marketplaceKeys.detail(noteId),
    enabled: Boolean(noteId),
    queryFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const response = await apiClient.getMarketplaceNote(noteId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useCommitInvestment() {
  const apiClient = useMarketplaceApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      noteId,
      amount,
      investorOrganizationId,
    }: {
      noteId: string;
      amount: number;
      investorOrganizationId: string;
    }) => {
      const response = await apiClient.createMarketplaceNoteInvestment(noteId, {
        amount,
        investorOrganizationId,
      });
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.all });
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.detail(variables.noteId) });
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.portfolio });
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.portfolioHistoryRoot });
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.investorBalanceActivityRoot });
    },
  });
}

export function useInvestorPortfolio() {
  const apiClient = useMarketplaceApiClient();
  return useQuery({
    queryKey: marketplaceKeys.portfolio,
    queryFn: async () => {
      const response = await apiClient.getInvestorPortfolio();
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useInvestorPortfolioHistory(range: InvestorPortfolioHistoryRange) {
  const apiClient = useMarketplaceApiClient();
  return useQuery({
    queryKey: marketplaceKeys.portfolioHistory(range),
    queryFn: async () => {
      const response = await apiClient.getInvestorPortfolioHistory(range);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useInvestorInvestments() {
  const apiClient = useMarketplaceApiClient();
  return useQuery({
    queryKey: marketplaceKeys.investorInvestments,
    queryFn: async () => {
      const response = await apiClient.getInvestorInvestments();
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useInvestorBalanceActivity({
  page = 1,
  pageSize = 20,
}: {
  page?: number;
  pageSize?: number;
} = {}) {
  const apiClient = useMarketplaceApiClient();
  return useQuery({
    queryKey: marketplaceKeys.investorBalanceActivity({ page, pageSize }),
    queryFn: async () => {
      const response = await apiClient.getInvestorBalanceActivity({ page, pageSize });
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

