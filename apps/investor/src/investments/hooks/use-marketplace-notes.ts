import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const marketplaceKeys = {
  all: ["marketplace-notes"] as const,
  list: (search: string) => [...marketplaceKeys.all, "list", search] as const,
  detail: (id?: string) => [...marketplaceKeys.all, "detail", id] as const,
  portfolio: ["investor-portfolio"] as const,
};

function useMarketplaceApiClient() {
  const { getAccessToken } = useAuthToken();
  return createApiClient(API_URL, getAccessToken);
}

export function useMarketplaceNotes(search = "") {
  const apiClient = useMarketplaceApiClient();
  return useQuery({
    queryKey: marketplaceKeys.list(search),
    queryFn: async () => {
      const response = await apiClient.getMarketplaceNotes({ page: 1, pageSize: 24, search });
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

export function useCommitInvestment(noteId: string) {
  const apiClient = useMarketplaceApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ amount, investorOrganizationId }: { amount: number; investorOrganizationId: string }) => {
      const response = await apiClient.createMarketplaceNoteInvestment(noteId, {
        amount,
        investorOrganizationId,
      });
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.all });
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.detail(noteId) });
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

