import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { InvestorPortfolioHistoryRange } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const marketplaceKeys = {
  all: ["marketplace-notes"] as const,
  list: (params: { search: string; page: number; pageSize: number; featuredOnly: boolean }) =>
    [...marketplaceKeys.all, "list", params] as const,
  detail: (id?: string) => [...marketplaceKeys.all, "detail", id] as const,
  portfolioRoot: ["investor-portfolio"] as const,
  portfolio: (investorOrganizationId?: string) =>
    [...marketplaceKeys.portfolioRoot, investorOrganizationId] as const,
  portfolioHistoryRoot: ["investor-portfolio-history"] as const,
  portfolioHistory: (range: InvestorPortfolioHistoryRange, investorOrganizationId?: string) =>
    [...marketplaceKeys.portfolioHistoryRoot, range, investorOrganizationId] as const,
  investorBalanceActivityRoot: ["investor-balance-activity"] as const,
  investorBalanceActivity: (params: {
    page: number;
    pageSize: number;
    investorOrganizationId?: string;
  }) => [...marketplaceKeys.investorBalanceActivityRoot, params] as const,
  investorBalanceActivityAll: (investorOrganizationId?: string) =>
    [...marketplaceKeys.investorBalanceActivityRoot, "all", investorOrganizationId] as const,
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

export function useMarketplaceNote(noteId?: string, options?: { enabled?: boolean }) {
  const apiClient = useMarketplaceApiClient();
  const allowFetch = options?.enabled ?? true;
  return useQuery({
    queryKey: marketplaceKeys.detail(noteId),
    enabled: Boolean(noteId) && allowFetch,
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
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.portfolioRoot });
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.portfolioHistoryRoot });
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.investorBalanceActivityRoot });
    },
  });
}

export function useInvestorPortfolio(investorOrganizationId?: string) {
  const apiClient = useMarketplaceApiClient();
  return useQuery({
    queryKey: marketplaceKeys.portfolio(investorOrganizationId),
    enabled: Boolean(investorOrganizationId),
    queryFn: async () => {
      const response = await apiClient.getInvestorPortfolio(investorOrganizationId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useInvestorPortfolioHistory(
  range: InvestorPortfolioHistoryRange,
  investorOrganizationId?: string
) {
  const apiClient = useMarketplaceApiClient();
  return useQuery({
    queryKey: marketplaceKeys.portfolioHistory(range, investorOrganizationId),
    enabled: Boolean(investorOrganizationId),
    queryFn: async () => {
      const response = await apiClient.getInvestorPortfolioHistory(range, investorOrganizationId);
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

export function useInvestorBalanceActivity(
  {
    page = 1,
    pageSize = 20,
    investorOrganizationId,
  }: {
    page?: number;
    pageSize?: number;
    investorOrganizationId?: string;
  } = {},
  options?: { enabled?: boolean }
) {
  const apiClient = useMarketplaceApiClient();
  const allowFetch = (options?.enabled ?? true) && Boolean(investorOrganizationId);
  return useQuery({
    queryKey: marketplaceKeys.investorBalanceActivity({ page, pageSize, investorOrganizationId }),
    enabled: allowFetch,
    queryFn: async () => {
      const response = await apiClient.getInvestorBalanceActivity({
        page,
        pageSize,
        investorOrganizationId,
      });
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

const ACTIVITY_FETCH_PAGE_SIZE = 100;

/** Loads every balance-activity page for the active org (API caps pageSize at 100). */
export function useInvestorBalanceActivityAll(
  investorOrganizationId?: string,
  options?: { enabled?: boolean }
) {
  const apiClient = useMarketplaceApiClient();
  const allowFetch = (options?.enabled ?? true) && Boolean(investorOrganizationId);
  return useQuery({
    queryKey: marketplaceKeys.investorBalanceActivityAll(investorOrganizationId),
    enabled: allowFetch,
    queryFn: async () => {
      const first = await apiClient.getInvestorBalanceActivity({
        page: 1,
        pageSize: ACTIVITY_FETCH_PAGE_SIZE,
        investorOrganizationId,
      });
      if (!first.success) throw new Error(first.error.message);

      const allEntries = [...first.data.entries];
      const { totalPages } = first.data.pagination;

      if (totalPages > 1) {
        const remainingPages = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) =>
            apiClient.getInvestorBalanceActivity({
              page: index + 2,
              pageSize: ACTIVITY_FETCH_PAGE_SIZE,
              investorOrganizationId,
            })
          )
        );
        for (const response of remainingPages) {
          if (!response.success) throw new Error(response.error.message);
          allEntries.push(...response.data.entries);
        }
      }

      return { ...first.data, entries: allEntries };
    },
  });
}

