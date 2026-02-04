import { createApiClient, useAuthToken } from "@cashsouk/config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InvoiceDetails } from "@cashsouk/types";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useInvoices(applicationId: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["invoices", applicationId],
    queryFn: async () => {
      if (!applicationId) return [];
      const response = await apiClient.getInvoicesByApplication(applicationId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: !!applicationId,
  });
}

export function useCreateInvoice() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      applicationId: string;
      contractId?: string;
      details: InvoiceDetails;
    }) => {
      const response = await apiClient.createInvoice(data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices", variables.applicationId] });
      queryClient.invalidateQueries({ queryKey: ["application", variables.applicationId] });
    },
    onError: (error: Error) => {
      toast.error("Failed to create invoice", {
        description: error.message,
      });
    },
  });
}

export function useUpdateInvoice() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      applicationId,
      details,
    }: {
      id: string;
      applicationId: string;
      details: Partial<InvoiceDetails>;
    }) => {
      const response = await apiClient.updateInvoice(id, details);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices", variables.applicationId] });
      queryClient.invalidateQueries({ queryKey: ["application", variables.applicationId] });
    },
    onError: (error: Error) => {
      toast.error("Failed to update invoice", {
        description: error.message,
      });
    },
  });
}

export function useDeleteInvoice() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; applicationId: string }) => {
      const response = await apiClient.deleteInvoice(id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices", variables.applicationId] });
      queryClient.invalidateQueries({ queryKey: ["application", variables.applicationId] });
    },
    onError: (error: Error) => {
      toast.error("Failed to delete invoice", {
        description: error.message,
      });
    },
  });
}
