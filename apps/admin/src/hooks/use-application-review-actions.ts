import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { ApiError } from "@cashsouk/types";
import { applicationLogsKeys } from "./use-application-logs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const pendingAmendmentKeys = {
  all: ["admin", "pending-amendments"] as const,
  list: (applicationId: string) =>
    [...pendingAmendmentKeys.all, applicationId] as const,
};

export function useApproveReviewSection() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      section,
      remark,
    }: {
      applicationId: string;
      section: string;
      remark?: string;
    }) => {
      const response = await apiClient.approveReviewSection(applicationId, section, remark);
      if (!response.success) {
        throw new Error((response as ApiError).error?.message ?? "Failed to approve section");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
      queryClient.invalidateQueries({
        queryKey: pendingAmendmentKeys.list(variables.applicationId),
      });
      queryClient.invalidateQueries({
        queryKey: applicationLogsKeys.list(variables.applicationId),
      });
    },
  });
}

export function useRejectReviewSection() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      section,
      remark,
    }: {
      applicationId: string;
      section: string;
      remark: string;
    }) => {
      const response = await apiClient.rejectReviewSection(applicationId, section, remark);
      if (!response.success) {
        throw new Error((response as ApiError).error?.message ?? "Failed to reject section");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
      queryClient.invalidateQueries({
        queryKey: pendingAmendmentKeys.list(variables.applicationId),
      });
      queryClient.invalidateQueries({
        queryKey: applicationLogsKeys.list(variables.applicationId),
      });
    },
  });
}

export function useAddSectionComment() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      section,
      comment,
    }: {
      applicationId: string;
      section: string;
      comment: string;
    }) => {
      const response = await apiClient.addSectionComment(applicationId, section, comment);
      if (!response.success) {
        throw new Error((response as ApiError).error?.message ?? "Failed to add section comment");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
    },
  });
}

export function useResetSectionReviewToPending() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      section,
    }: {
      applicationId: string;
      section: string;
    }) => {
      const response = await apiClient.resetSectionReviewToPending(applicationId, section);
      if (!response.success) {
        throw new Error((response as ApiError).error?.message ?? "Failed to reset section");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
      queryClient.invalidateQueries({
        queryKey: pendingAmendmentKeys.list(variables.applicationId),
      });
      queryClient.invalidateQueries({
        queryKey: applicationLogsKeys.list(variables.applicationId),
      });
    },
  });
}

export function useApproveReviewItem() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      itemType,
      itemId,
      remark,
    }: {
      applicationId: string;
      itemType: "invoice" | "document";
      itemId: string;
      remark?: string;
    }) => {
      const response = await apiClient.approveReviewItem(
        applicationId,
        itemType,
        itemId,
        remark
      );
      if (!response.success) {
        throw new Error((response as ApiError).error?.message ?? "Failed to approve item");
      }
      return response.data;
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
      queryClient.invalidateQueries({
        queryKey: pendingAmendmentKeys.list(variables.applicationId),
      });
      queryClient.invalidateQueries({
        queryKey: applicationLogsKeys.list(variables.applicationId),
      });
      await queryClient.refetchQueries({
        queryKey: ["admin", "applications", variables.applicationId],
      });
    },
  });
}

export function useRejectReviewItem() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      itemType,
      itemId,
      remark,
    }: {
      applicationId: string;
      itemType: "invoice" | "document";
      itemId: string;
      remark: string;
    }) => {
      const response = await apiClient.rejectReviewItem(applicationId, itemType, itemId, remark);
      if (!response.success) {
        throw new Error((response as ApiError).error?.message ?? "Failed to reject item");
      }
      return response.data;
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
      queryClient.invalidateQueries({
        queryKey: pendingAmendmentKeys.list(variables.applicationId),
      });
      queryClient.invalidateQueries({
        queryKey: applicationLogsKeys.list(variables.applicationId),
      });
      await queryClient.refetchQueries({
        queryKey: ["admin", "applications", variables.applicationId],
      });
    },
  });
}

export function useResetItemReviewToPending() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      itemType,
      itemId,
    }: {
      applicationId: string;
      itemType: "invoice" | "document";
      itemId: string;
    }) => {
      const response = await apiClient.resetItemReviewToPending(
        applicationId,
        itemType,
        itemId
      );
      if (!response.success) {
        throw new Error((response as ApiError).error?.message ?? "Failed to reset item");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
      queryClient.invalidateQueries({
        queryKey: pendingAmendmentKeys.list(variables.applicationId),
      });
      queryClient.invalidateQueries({
        queryKey: applicationLogsKeys.list(variables.applicationId),
      });
    },
  });
}

export function useSendContractOffer() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      offeredFacility,
      expiresAt,
    }: {
      applicationId: string;
      offeredFacility: number;
      expiresAt?: string | null;
    }) => {
      const response = await apiClient.sendContractOffer(applicationId, offeredFacility, expiresAt);
      if (!response.success) {
        throw new Error((response as ApiError).error?.message ?? "Failed to send contract offer");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
      queryClient.invalidateQueries({
        queryKey: applicationLogsKeys.list(variables.applicationId),
      });
    },
  });
}

export function useSendInvoiceOffer() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      invoiceId,
      offeredAmount,
      offeredRatioPercent,
      offeredProfitRatePercent,
      expiresAt,
    }: {
      applicationId: string;
      invoiceId: string;
      offeredAmount: number;
      offeredRatioPercent?: number | null;
      offeredProfitRatePercent?: number | null;
      expiresAt?: string | null;
    }) => {
      const response = await apiClient.sendInvoiceOffer(applicationId, invoiceId, {
        offeredAmount,
        offeredRatioPercent,
        offeredProfitRatePercent,
        expiresAt,
      });
      if (!response.success) {
        throw new Error((response as ApiError).error?.message ?? "Failed to send invoice offer");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
      queryClient.invalidateQueries({
        queryKey: applicationLogsKeys.list(variables.applicationId),
      });
    },
  });
}

export function useAddPendingAmendment() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      scope,
      scopeKey,
      remark,
      itemType,
      itemId,
    }: {
      applicationId: string;
      scope: "section" | "item";
      scopeKey?: string;
      remark: string;
      itemType?: "invoice" | "document";
      itemId?: string;
    }) => {
      const response = await apiClient.addPendingAmendment(applicationId, {
        scope,
        scopeKey,
        remark,
        itemType,
        itemId,
      });
      if (!response.success) {
        throw new Error(
          (response as ApiError).error?.message ?? "Failed to add pending amendment"
        );
      }
      return response.data;
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
      queryClient.invalidateQueries({
        queryKey: applicationLogsKeys.list(variables.applicationId),
      });
      await queryClient.refetchQueries({
        queryKey: pendingAmendmentKeys.list(variables.applicationId),
      });
    },
  });
}

export function useListPendingAmendments(applicationId: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: pendingAmendmentKeys.list(applicationId),
    queryFn: async () => {
      const response = await apiClient.listPendingAmendments(applicationId);
      if (!response.success) {
        throw new Error(
          (response as ApiError).error?.message ?? "Failed to list pending amendments"
        );
      }
      return response.data ?? [];
    },
    enabled: !!applicationId,
  });
}

export function useRemovePendingAmendment() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      scope,
      scopeKey,
    }: {
      applicationId: string;
      scope: string;
      scopeKey: string;
    }) => {
      const response = await apiClient.removePendingAmendment(
        applicationId,
        scope,
        scopeKey
      );
      if (!response.success) {
        throw new Error(
          (response as ApiError).error?.message ?? "Failed to remove pending amendment"
        );
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: pendingAmendmentKeys.list(variables.applicationId),
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
    },
  });
}

export function useSubmitAmendmentRequest() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({ applicationId }: { applicationId: string }) => {
      const response = await apiClient.submitAmendmentRequest(applicationId);
      if (!response.success) {
        throw new Error(
          (response as ApiError).error?.message ?? "Failed to submit amendment request"
        );
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: pendingAmendmentKeys.list(variables.applicationId),
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
      queryClient.invalidateQueries({
        queryKey: applicationLogsKeys.list(variables.applicationId),
      });
    },
  });
}
