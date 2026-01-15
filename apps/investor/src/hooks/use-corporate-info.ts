import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useCorporateInfo(organizationId: string | undefined) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["corporate-info", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      // Corporate info is part of organization detail
      const result = await apiClient.get<{
        corporateOnboardingData?: {
          basicInfo?: {
            tinNumber?: string;
            industry?: string;
            entityType?: string;
            businessName?: string;
            numberOfEmployees?: number;
            ssmRegisterNumber?: string;
          };
          addresses?: {
            businessAddress?: string;
            registeredAddress?: string;
          };
        };
      }>(`/v1/organizations/investor/${organizationId}`);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data.corporateOnboardingData;
    },
    enabled: !!organizationId,
  });

  const updateMutation = useMutation({
    mutationFn: async (input: {
      tinNumber?: string | null;
      industry?: string | null;
      entityType?: string | null;
      businessName?: string | null;
      numberOfEmployees?: number | null;
      ssmRegisterNumber?: string | null;
      businessAddress?: string | null;
      registeredAddress?: string | null;
    }) => {
      if (!organizationId) throw new Error("No organization selected");
      const result = await apiClient.patch(
        `/v1/organizations/investor/${organizationId}/corporate-info`,
        input
      );
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corporate-info", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["organization-detail", organizationId] });
      toast.success("Corporate info updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update corporate info", { description: error.message });
    },
  });

  return {
    corporateInfo: data,
    isLoading,
    error,
    update: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
