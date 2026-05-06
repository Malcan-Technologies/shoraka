import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const marketplaceKeys = {
  all: ["marketplace-notes"] as const,
  list: (params: { search: string; page: number; pageSize: number; featuredOnly: boolean }) =>
    [...marketplaceKeys.all, "list", params] as const,
  detail: (id?: string) => [...marketplaceKeys.all, "detail", id] as const,
  portfolio: ["investor-portfolio"] as const,
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

