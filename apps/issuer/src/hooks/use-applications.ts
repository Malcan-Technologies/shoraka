import { createApiClient, useAuthToken } from "@cashsouk/config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WithdrawReason } from "@cashsouk/types";
import type { CreateApplicationInput, UpdateApplicationStepInput } from "@cashsouk/types";
import { toast } from "sonner";
import { useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useApplication(id: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["application", id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiClient.getApplication(id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateApplication() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateApplicationInput) => {
      const response = await apiClient.createApplication(data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to create application", {
        description: error.message,
      });
    },
  });
}

export function useUpdateApplicationStep() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, stepData }: { id: string; stepData: UpdateApplicationStepInput }) => {
      const response = await apiClient.updateApplicationStep(id, stepData);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["application", variables.id] });
    },
    onError: (error: Error) => {
      toast.error("Failed to save progress", {
        description: error.message,
      });
    },
  });
}

export function useUpdateApplicationStatus() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiClient.updateApplicationStatus(id, status as any);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["application", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to update application status", {
        description: error.message,
      });
    },
  });
}

export function useResubmitApplication() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken();
      const response = await fetch(`${API_URL}/v1/applications/${id}/resubmit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? "Failed to resubmit");
      }
      return json.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["application", id] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to resubmit", {
        description: error.message,
      });
    },
  });
}

export function useArchiveApplication() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.archiveApplication(id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to archive application", {
        description: error.message,
      });
    },
  });
}

export function useDeleteDraftApplication() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.deleteDraftApplication(id);
      if (!response.success) {
        throw new Error((response as any).error?.message ?? "Failed to delete draft");
      }
      return { id };
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["application", id] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to delete draft", {
        description: error.message,
      });
    },
  });
}

export function useCancelApplication() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.cancelApplication(id);
      if (!response.success) {
        throw new Error((response as any).error?.message ?? "Failed to cancel");
      }
      return (response as any).data;
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ["application", id] });
      const organizationId = (data as any)?.issuer_organization_id as string | undefined;
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ["applications", organizationId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["applications"] });
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to withdraw application", {
        description: error.message,
      });
    },
  });
}

export function useWithdrawInvoice() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      applicationId,
      organizationId,
      reason,
    }: {
      invoiceId: string;
      applicationId: string;
      organizationId?: string;
      reason?: WithdrawReason;
    }) => {
      const response = await apiClient.withdrawInvoice(invoiceId, reason);
      if (!response.success) {
        throw new Error((response as any).error?.message ?? "Failed to withdraw invoice");
      }
      return { data: (response as any).data, applicationId, organizationId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["application", variables.applicationId] });
      if (variables.organizationId) {
        queryClient.invalidateQueries({ queryKey: ["applications", variables.organizationId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["applications"] });
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to withdraw invoice", {
        description: error.message,
      });
    },
  });
}

export function useWithdrawContract() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contractId,
      applicationId,
      organizationId,
    }: {
      contractId: string;
      applicationId: string;
      organizationId?: string;
    }) => {
      const response = await apiClient.withdrawContract(contractId);
      if (!response.success) {
        throw new Error((response as any).error?.message ?? "Failed to withdraw contract");
      }
      return { data: (response as any).data, applicationId, organizationId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["application", variables.applicationId] });
      if (variables.organizationId) {
        queryClient.invalidateQueries({ queryKey: ["applications", variables.organizationId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["applications"] });
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to withdraw contract", {
        description: error.message,
      });
    },
  });
}

export function useOrganizationApplications(organizationId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!organizationId) return;

    const controller = new AbortController();

    const run = async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;

        const streamUrl = `${API_URL}/v1/applications/offers/stream?organizationId=${encodeURIComponent(organizationId)}`;
        const response = await fetch(streamUrl, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let delimiterIndex = buffer.indexOf("\n\n");
          while (delimiterIndex !== -1) {
            const block = buffer.slice(0, delimiterIndex);
            buffer = buffer.slice(delimiterIndex + 2);

            const dataLine = block
              .split("\n")
              .find((line) => line.startsWith("data:"))
              ?.slice(5)
              .trim();

            if (dataLine) {
              try {
                const event = JSON.parse(dataLine) as { applicationId?: string };
                queryClient.invalidateQueries({ queryKey: ["applications", organizationId] });
                queryClient.invalidateQueries({ queryKey: ["applications"] });
                if (event.applicationId) {
                  queryClient.invalidateQueries({ queryKey: ["application", event.applicationId] });
                }
              } catch {
                // Ignore malformed SSE payloads.
              }
            }

            delimiterIndex = buffer.indexOf("\n\n");
          }
        }
      } catch {
        // Ignore stream interruptions; mutation invalidations still keep data consistent.
      }
    };

    void run();

    return () => controller.abort();
  }, [organizationId, getAccessToken, queryClient]);

  return useQuery({
    queryKey: ["applications", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const response = await apiClient.get(`/v1/applications?organizationId=${encodeURIComponent(organizationId)}`);
      if (!response.success) {
        throw new Error((response as any).error?.message || "Failed to list applications");
      }
      return response.data as any[];
    },
    enabled: !!organizationId,
  });
}

function getOfferError(res: { success?: boolean; error?: { message?: string } }): string {
  if (res.success) return "";
  return (res as any).error?.message ?? "Offer operation failed";
}

export function useAcceptContractOffer() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (applicationId: string) => {
      const res = await apiClient.acceptContractOffer(applicationId);
      if (!res.success) throw new Error(getOfferError(res));
      return res.data;
    },
    onSuccess: async (data, applicationId) => {
      queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
      const organizationId = (data as any)?.issuer_organization_id as string | undefined;
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ["applications", organizationId] });
      }
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      await queryClient.refetchQueries({ queryKey: ["applications"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to accept offer", { description: error.message });
    },
  });
}

export function useRejectContractOffer() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (applicationId: string) => {
      const res = await apiClient.rejectContractOffer(applicationId);
      if (!res.success) throw new Error(getOfferError(res));
      return res.data;
    },
    onSuccess: async (data, applicationId) => {
      queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
      const organizationId = (data as any)?.issuer_organization_id as string | undefined;
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ["applications", organizationId] });
      }
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      await queryClient.refetchQueries({ queryKey: ["applications"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to reject offer", { description: error.message });
    },
  });
}

export function useAcceptInvoiceOffer() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ applicationId, invoiceId }: { applicationId: string; invoiceId: string }) => {
      const res = await apiClient.acceptInvoiceOffer(applicationId, invoiceId);
      if (!res.success) throw new Error(getOfferError(res));
      return res.data;
    },
    onSuccess: async (data, { applicationId }) => {
      queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
      const organizationId = (data as any)?.issuer_organization_id as string | undefined;
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ["applications", organizationId] });
      }
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      await queryClient.refetchQueries({ queryKey: ["applications"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to accept offer", { description: error.message });
    },
  });
}

export function useRejectInvoiceOffer() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ applicationId, invoiceId }: { applicationId: string; invoiceId: string }) => {
      const res = await apiClient.rejectInvoiceOffer(applicationId, invoiceId);
      if (!res.success) throw new Error(getOfferError(res));
      return res.data;
    },
    onSuccess: async (data, { applicationId }) => {
      queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
      const organizationId = (data as any)?.issuer_organization_id as string | undefined;
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ["applications", organizationId] });
      }
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      await queryClient.refetchQueries({ queryKey: ["applications"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to reject offer", { description: error.message });
    },
  });
}
