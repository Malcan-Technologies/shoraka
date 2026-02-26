import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { ApiError } from "@cashsouk/types";

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
    },
  });
}

export function useRequestAmendmentReviewSection() {
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
      const response = await apiClient.requestAmendmentReviewSection(applicationId, section, remark);
      if (!response.success) {
        throw new Error((response as ApiError).error?.message ?? "Failed to request amendment");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
      queryClient.invalidateQueries({
        queryKey: pendingAmendmentKeys.list(variables.applicationId),
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
      queryClient.invalidateQueries({
        queryKey: pendingAmendmentKeys.list(variables.applicationId),
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
      queryClient.invalidateQueries({
        queryKey: pendingAmendmentKeys.list(variables.applicationId),
      });
    },
  });
}

export function useRequestAmendmentReviewItem() {
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
      const response = await apiClient.requestAmendmentReviewItem(
        applicationId,
        itemType,
        itemId,
        remark
      );
      if (!response.success) {
        throw new Error((response as ApiError).error?.message ?? "Failed to request amendment");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
      queryClient.invalidateQueries({
        queryKey: pendingAmendmentKeys.list(variables.applicationId),
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
      queryClient.invalidateQueries({
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

export function useUpdatePendingAmendment() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      scope,
      scopeKey,
      remark,
    }: {
      applicationId: string;
      scope: string;
      scopeKey: string;
      remark: string;
    }) => {
      const response = await apiClient.updatePendingAmendment(
        applicationId,
        scope,
        scopeKey,
        remark
      );
      if (!response.success) {
        throw new Error(
          (response as ApiError).error?.message ?? "Failed to update pending amendment"
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
    },
  });
}
