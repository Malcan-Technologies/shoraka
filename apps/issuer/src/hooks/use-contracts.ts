import { createApiClient, getReviewDetailRefreshPolicy, useAuthToken } from "@cashsouk/config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ContractDetails, CustomerDetails, IssuerPaymasterOption, PaymasterLookupResult } from "@cashsouk/types";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useApprovedContracts(organizationId: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["contracts", "approved", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const response = await apiClient.getApprovedContracts(organizationId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: !!organizationId,
  });
}

export function useIssuerPaymasters(organizationId: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["issuer-paymasters", organizationId],
    queryFn: async (): Promise<IssuerPaymasterOption[]> => {
      if (!organizationId) return [];
      const response = await apiClient.getIssuerPaymasters(organizationId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data.paymasters;
    },
    enabled: !!organizationId,
  });
}

export function useIssuerPaymasterLookup() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async (params: {
      organizationId: string;
      registrationNumber: string;
    }): Promise<PaymasterLookupResult> => {
      const response = await apiClient.lookupIssuerPaymaster(
        params.organizationId,
        params.registrationNumber
      );
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
  });
}

export function useContract(id: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const refreshPolicy = getReviewDetailRefreshPolicy();

  return useQuery({
    queryKey: ["contract", id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiClient.getContract(id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: !!id,
    ...refreshPolicy,
  });
}

export function useCreateContract() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await apiClient.createContract(applicationId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (data, applicationId) => {
      queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["contract", data.id] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}

export function useUpdateContract() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        contract_details?: ContractDetails | null;
        customer_details?: CustomerDetails;
        selectedPaymasterId?: string | null;
        status?: string;
      };
    }) => {
      const response = await apiClient.updateContract(id, data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contract", data.id] });
      queryClient.invalidateQueries({ queryKey: ["application", data.application_id] });
      queryClient.invalidateQueries({ queryKey: ["issuer-paymasters"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to update facility", {
        description: error.message,
      });
    },
  });
}

export function useUnlinkContract() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.unlinkContract(id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (_, applicationId) => {
      queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to unlink facility", {
        description: error.message,
      });
    },
  });
}
